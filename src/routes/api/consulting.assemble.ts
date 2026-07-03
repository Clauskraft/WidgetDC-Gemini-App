/**
 * POST /api/consulting/assemble — Assemble a BOM of AssemblyBlocks for a ConsultingProcess.
 * GET  /api/consulting/assemble — List available ConsultingProcess nodes (for picker).
 *
 * POST body: { cp_name?: string, brief: string, max_blocks?: number, domain_filter?: string }
 * Response: { bom: AssemblyBlockRow[], cp_name: string, total: number, error?: string }
 */
import { createFileRoute } from "@tanstack/react-router";
import { callMcpTool } from "@/lib/widgetdc.server";

export type AssemblyBlockRow = {
  id: string;
  content: string;
  domain: string | null;
  quality_score: number;
  title: string | null;
  relevance_score?: number;
  content_truncated?: boolean;
};

export type FallbackMode = "requires" | "domain_match" | "global_quality";

export type AssembleBody = {
  cp_name?: string;
  brief: string;
  max_blocks?: number;
  domain_filter?: string;
  engagement_id?: string;
};

export type AssembleResponse = {
  bom: AssemblyBlockRow[];
  cp_name: string;
  total: number;
  fallback_mode?: FallbackMode;
  error?: string;
};

export type CpListResponse = {
  cps: { name: string; domain: string | null }[];
  error?: string;
};

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

function briefRelevanceScore(brief: string, title: string | null, content: string): number {
  const terms = brief
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3);
  if (terms.length === 0) return 0;
  const haystack = `${(title ?? "").toLowerCase()} ${content.slice(0, 400).toLowerCase()}`;
  const hits = terms.filter((t) => haystack.includes(t)).length;
  return hits / terms.length;
}

function reRankByBrief(brief: string, blocks: AssemblyBlockRow[]): AssemblyBlockRow[] {
  return blocks
    .map((b) => ({ ...b, relevance_score: briefRelevanceScore(brief, b.title, b.content) }))
    .sort((a, b) => {
      const relevanceDiff = (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
      if (Math.abs(relevanceDiff) > 0.05) return relevanceDiff;
      return b.quality_score - a.quality_score;
    });
}

export const Route = createFileRoute("/api/consulting/assemble")({
  server: {
    handlers: {
      GET: async () => {
        // Return list of non-archived ConsultingProcess nodes for the picker
        const cypher = `
          MATCH (cp:ConsultingProcess)
          WHERE NOT cp:Archived
          OPTIONAL MATCH (cp)-[:BELONGS_TO]->(d)
          RETURN
            coalesce(cp.name, '') AS name,
            d.name AS domain
          ORDER BY cp.name ASC
          LIMIT 200
        `;

        const result = await callMcpTool<unknown>(
          "data_graph_read",
          { query: cypher },
          { timeoutMs: 10000 },
        ).catch(() => null);

        if (result == null) {
          return jsonRes(
            { cps: [], error: "Platform utilgængeligt" } satisfies CpListResponse,
            503,
          );
        }

        const r = result as Record<string, unknown>;
        const inner = (r.result as Record<string, unknown>) ?? r;
        const rawRows: unknown = inner.results ?? inner.rows ?? inner.records ?? inner.data;
        const rows = Array.isArray(rawRows) ? (rawRows as Array<Record<string, unknown>>) : [];

        const cps = rows.map((row) => ({
          name: String(row.name ?? ""),
          domain: row.domain != null ? String(row.domain) : null,
        }));

        return jsonRes({ cps } satisfies CpListResponse, 200);
      },

      POST: async ({ request }: { request: Request }) => {
        let body: AssembleBody;
        try {
          body = (await request.json()) as AssembleBody;
        } catch {
          return jsonRes(
            { bom: [], cp_name: "", total: 0, error: "Ugyldig JSON" } satisfies AssembleResponse,
            400,
          );
        }

        const cpName = body.cp_name?.trim() ?? "";
        const brief = body.brief?.trim();
        if (!brief) {
          return jsonRes(
            {
              bom: [],
              cp_name: cpName,
              total: 0,
              error: "brief er påkrævet",
            } satisfies AssembleResponse,
            400,
          );
        }

        // F1: NaN-safe parse — floor+fallback guards against non-numeric input
        const maxBlocks = Math.min(
          50,
          Math.max(1, Math.floor(Number(body.max_blocks ?? 10)) || 10),
        );
        const domainFilter = body.domain_filter?.trim() ?? "";

        // F2: parameterized Cypher — no string interpolation of user input
        const domainClause = domainFilter
          ? "AND toLower(coalesce(ab.domain,'')) CONTAINS toLower($domainFilter)"
          : "";

        // Brief-only mode: no cp_name provided — return top AssemblyBlocks by quality_score
        if (!cpName) {
          const briefOnlyCypher = `
            MATCH (ab:AssemblyBlock)
            WHERE ab.content IS NOT NULL ${domainClause}
            RETURN
              coalesce(ab.id, toString(id(ab))) AS id,
              ab.content AS content,
              ab.domain AS domain,
              coalesce(ab.quality_score, 0.5) AS quality_score,
              ab.title AS title
            ORDER BY quality_score DESC
            LIMIT ${maxBlocks}
          `;
          const boParams: Record<string, string> = {};
          if (domainFilter) boParams.domainFilter = domainFilter;

          const boResult = await callMcpTool<unknown>(
            "data_graph_read",
            { query: briefOnlyCypher, params: boParams },
            { timeoutMs: 15000 },
          ).catch(() => null);

          if (boResult == null) {
            return jsonRes(
              {
                bom: [],
                cp_name: "",
                total: 0,
                error: "Platform utilgængeligt",
              } satisfies AssembleResponse,
              503,
            );
          }

          const boR = boResult as Record<string, unknown>;
          const boI = (boR.result as Record<string, unknown>) ?? boR;
          const boRaw: unknown = boI.results ?? boI.rows ?? boI.records ?? boI.data;
          const boRows = Array.isArray(boRaw) ? (boRaw as Array<Record<string, unknown>>) : [];
          const boBomRaw: AssemblyBlockRow[] = boRows.map((row) => ({
            id: String(row.id ?? ""),
            content: String(row.content ?? "").slice(0, 800),
            domain: row.domain != null ? String(row.domain) : null,
            quality_score: Math.round(neo4jNum(row.quality_score) * 100) / 100,
            title: row.title != null ? String(row.title).slice(0, 120) : null,
            content_truncated: String(row.content ?? "").length > 800,
          }));
          const boBom = reRankByBrief(brief, boBomRaw);
          return jsonRes(
            {
              bom: boBom,
              cp_name: "",
              total: boBom.length,
              fallback_mode: "global_quality",
            } satisfies AssembleResponse,
            200,
          );
        }

        // First try REQUIRES edges (seeded by legofactory.seed_cp_ab_edges)
        const cypher = `
          MATCH (cp:ConsultingProcess)
          WHERE toLower(cp.name) = toLower($cpName)
          MATCH (cp)-[:REQUIRES]->(ab:AssemblyBlock)
          WITH DISTINCT ab
          WHERE ab.content IS NOT NULL ${domainClause}
          RETURN
            coalesce(ab.id, toString(id(ab))) AS id,
            ab.content AS content,
            ab.domain AS domain,
            coalesce(ab.quality_score, 0.5) AS quality_score,
            ab.title AS title
          ORDER BY quality_score DESC
          LIMIT ${maxBlocks}
        `;

        const params: Record<string, string> = { cpName };
        if (domainFilter) params.domainFilter = domainFilter;

        const result = await callMcpTool<unknown>(
          "data_graph_read",
          { query: cypher, params },
          { timeoutMs: 15000 },
        ).catch(() => null);

        if (result == null) {
          return jsonRes(
            {
              bom: [],
              cp_name: cpName,
              total: 0,
              error: "Platform utilgængeligt",
            } satisfies AssembleResponse,
            503,
          );
        }

        const r = result as Record<string, unknown>;
        const inner = (r.result as Record<string, unknown>) ?? r;
        const rawRows: unknown = inner.results ?? inner.rows ?? inner.records ?? inner.data;
        const rows = Array.isArray(rawRows) ? (rawRows as Array<Record<string, unknown>>) : [];

        if (rows.length === 0) {
          // Fallback: domain-based match (no REQUIRES edges yet — G5 gap)
          const fallbackCypher = `
            MATCH (cp:ConsultingProcess)
            WHERE toLower(cp.name) = toLower($cpName)
            OPTIONAL MATCH (cp)-[:BELONGS_TO]->(d)
            WITH cp, coalesce(d.name, cp.domain, '') AS cpDomain
            MATCH (ab:AssemblyBlock)
            WHERE ab.content IS NOT NULL
              AND toLower(coalesce(ab.domain,'')) CONTAINS toLower(cpDomain)
              ${domainClause}
            RETURN
              coalesce(ab.id, toString(id(ab))) AS id,
              ab.content AS content,
              ab.domain AS domain,
              coalesce(ab.quality_score, 0.5) AS quality_score,
              ab.title AS title
            ORDER BY quality_score DESC
            LIMIT ${maxBlocks}
          `;

          const fallbackResult = await callMcpTool<unknown>(
            "data_graph_read",
            { query: fallbackCypher, params },
            { timeoutMs: 15000 },
          ).catch(() => null);

          if (fallbackResult != null) {
            const fr = fallbackResult as Record<string, unknown>;
            const fi = (fr.result as Record<string, unknown>) ?? fr;
            const fbRaw: unknown = fi.results ?? fi.rows ?? fi.records ?? fi.data;
            const fbRows = Array.isArray(fbRaw) ? (fbRaw as Array<Record<string, unknown>>) : [];

            const fbBomRaw: AssemblyBlockRow[] = fbRows.map((row) => ({
              id: String(row.id ?? ""),
              content: String(row.content ?? "").slice(0, 800),
              domain: row.domain != null ? String(row.domain) : null,
              quality_score: Math.round(neo4jNum(row.quality_score) * 100) / 100,
              title: row.title != null ? String(row.title).slice(0, 120) : null,
            }));
            const bom = reRankByBrief(brief, fbBomRaw);

            return jsonRes(
              {
                bom,
                cp_name: cpName,
                total: bom.length,
                fallback_mode: "domain_match",
              } satisfies AssembleResponse,
              200,
            );
          }
        }

        const bomRaw: AssemblyBlockRow[] = rows.map((row) => ({
          id: String(row.id ?? ""),
          content: String(row.content ?? "").slice(0, 800),
          domain: row.domain != null ? String(row.domain) : null,
          quality_score: Math.round(neo4jNum(row.quality_score) * 100) / 100,
          title: row.title != null ? String(row.title).slice(0, 120) : null,
        }));
        const bom = reRankByBrief(brief, bomRaw);

        return jsonRes(
          {
            bom,
            cp_name: cpName,
            total: bom.length,
            fallback_mode: "requires",
          } satisfies AssembleResponse,
          200,
        );
      },
    },
  },
});
