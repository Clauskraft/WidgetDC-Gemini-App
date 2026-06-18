/**
 * GET /api/engagements/$id/patterns — patterns for this engagement.
 *   Returns: { linked: PatternRef[], suggestions: PatternRef[] }
 *   linked   = patterns already connected via UTILIZED_PATTERN
 *   suggestions = top patterns NOT yet linked (by resonates_count)
 *
 * POST /api/engagements/$id/patterns — link a pattern.
 *   Body: { pattern_id: string }
 *   Creates [:UTILIZED_PATTERN] edge Engagement→Pattern.
 *   Idempotent (MERGE).
 */
import { createFileRoute } from "@tanstack/react-router";
import { callMcpTool } from "@/lib/widgetdc.server";

export type PatternRef = {
  id: string;
  name: string;
  domain: string | null;
  canonical_ref: string | null;
  resonates_count: number;
};

export type EngagementPatternsResponse = {
  linked: PatternRef[];
  suggestions: PatternRef[];
  error?: string;
};

export type LinkPatternBody = {
  pattern_id: string;
};

export type LinkPatternResponse = {
  ok: boolean;
  error?: string;
};

function escCypher(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function neo4jNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.low === "number") {
      return o.high ? (o.high as number) * 0x100000000 + (o.low as number) : (o.low as number);
    }
  }
  return 0;
}

function jsonRes(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function toPatternRef(row: Record<string, unknown>): PatternRef {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    domain: row.domain != null ? String(row.domain) : null,
    canonical_ref: row.canonical_ref != null ? String(row.canonical_ref) : null,
    resonates_count: neo4jNum(row.resonates_count),
  };
}

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (result == null) return [];
  const r = result as Record<string, unknown>;
  const inner = (r.result as Record<string, unknown>) ?? r;
  const raw: unknown = inner.results ?? inner.rows ?? inner.records ?? inner.data;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

export const Route = createFileRoute("/api/engagements/$id/patterns")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string } }) => {
        const engId = escCypher(params.id);

        const linkedCypher = `
          MATCH (e:Engagement)-[:UTILIZED_PATTERN]->(p:Pattern)
          WHERE coalesce(e.id, toString(id(e))) = '${engId}'
          OPTIONAL MATCH (p)-[:RESONATES_WITH]->(ci:CodeImplementation)
          WITH p, count(ci) AS resonates_count
          ORDER BY resonates_count DESC, p.name ASC
          LIMIT 50
          RETURN
            coalesce(p.id, toString(id(p))) AS id,
            coalesce(p.name, '') AS name,
            p.domain AS domain,
            p.canonical_ref AS canonical_ref,
            resonates_count
        `;

        const suggestCypher = `
          MATCH (e:Engagement)
          WHERE coalesce(e.id, toString(id(e))) = '${engId}'
          MATCH (p:Pattern)
          WHERE NOT (e)-[:UTILIZED_PATTERN]->(p)
            AND (
              e.domain IS NULL
              OR toLower(coalesce(p.domain, '')) CONTAINS toLower(coalesce(e.domain, ''))
              OR toLower(coalesce(e.domain, '')) CONTAINS toLower(coalesce(p.domain, ''))
            )
          OPTIONAL MATCH (p)-[:RESONATES_WITH]->(ci:CodeImplementation)
          WITH p, count(ci) AS resonates_count
          ORDER BY resonates_count DESC, p.name ASC
          LIMIT 20
          RETURN
            coalesce(p.id, toString(id(p))) AS id,
            coalesce(p.name, '') AS name,
            p.domain AS domain,
            p.canonical_ref AS canonical_ref,
            resonates_count
        `;

        const [linkedResult, suggestResult] = await Promise.all([
          callMcpTool<unknown>("data_graph_read", { query: linkedCypher }, { timeoutMs: 12000 }).catch(() => null),
          callMcpTool<unknown>("data_graph_read", { query: suggestCypher }, { timeoutMs: 12000 }).catch(() => null),
        ]);

        if (linkedResult == null && suggestResult == null) {
          return jsonRes(
            { linked: [], suggestions: [], error: "Platform utilgængeligt" } satisfies EngagementPatternsResponse,
            503,
          );
        }

        const linked = extractRows(linkedResult).map(toPatternRef);
        const suggestions = extractRows(suggestResult).map(toPatternRef);

        return jsonRes({ linked, suggestions } satisfies EngagementPatternsResponse, 200);
      },

      POST: async ({ request, params }: { request: Request; params: { id: string } }) => {
        let body: LinkPatternBody;
        try {
          body = (await request.json()) as LinkPatternBody;
        } catch {
          return jsonRes({ ok: false, error: "Ugyldig JSON" } satisfies LinkPatternResponse, 400);
        }

        const patternId = body.pattern_id?.trim();
        if (!patternId) {
          return jsonRes({ ok: false, error: "pattern_id er påkrævet" } satisfies LinkPatternResponse, 400);
        }

        const engId = escCypher(params.id);
        const patId = escCypher(patternId);

        const cypher = `
          MATCH (e:Engagement)
          WHERE coalesce(e.id, toString(id(e))) = '${engId}'
          MATCH (p:Pattern)
          WHERE coalesce(p.id, toString(id(p))) = '${patId}'
          MERGE (e)-[:UTILIZED_PATTERN]->(p)
          RETURN count(*) AS linked
        `;

        const result = await callMcpTool<unknown>(
          "data_graph_read",
          { query: cypher },
          { timeoutMs: 10000 },
        ).catch(() => null);

        if (result == null) {
          return jsonRes({ ok: false, error: "Platform utilgængeligt" } satisfies LinkPatternResponse, 503);
        }

        return jsonRes({ ok: true } satisfies LinkPatternResponse, 200);
      },
    },
  },
});
