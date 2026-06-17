/**
 * GET /api/patterns — Pattern Library query endpoint.
 *
 * Fetches Pattern nodes from the WidgeTDC knowledge graph via the platform
 * `data_graph_read` MCP tool. Supports search (q), domain filter, and
 * offset-based pagination (skip/limit). Read-only; server holds the bearer.
 *
 * Response shape: { patterns: PatternRow[], total: number, hasMore: boolean }
 */
import { createFileRoute } from "@tanstack/react-router";
import { callMcpTool } from "@/lib/widgetdc.server";

export type PatternRow = {
  id: string;
  name: string;
  domain: string | null;
  description: string | null;
  canonical_ref: string | null;
  resonates_count: number;
};

export type PatternsResponse = {
  patterns: PatternRow[];
  total: number;
  hasMore: boolean;
  error?: string;
};

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

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

export const Route = createFileRoute("/api/patterns")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get("q")?.trim() ?? "";
        const domain = url.searchParams.get("domain")?.trim() ?? "";
        const skip = Math.max(0, parseInt(url.searchParams.get("skip") ?? "0", 10) || 0);
        const limit = Math.min(
          MAX_LIMIT,
          Math.max(
            1,
            parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
          ),
        );
        const fetchCount = limit + 1;

        const whereClauses: string[] = [];
        if (q) {
          const safe = escCypher(q.toLowerCase());
          whereClauses.push(
            `(toLower(p.name) CONTAINS '${safe}' OR toLower(coalesce(p.description,'')) CONTAINS '${safe}')`,
          );
        }
        if (domain) {
          const safe = escCypher(domain.toLowerCase());
          whereClauses.push(`toLower(coalesce(p.domain,'')) CONTAINS '${safe}'`);
        }
        const whereClause =
          whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        const cypher = `
          MATCH (p:Pattern)
          ${whereClause}
          OPTIONAL MATCH (p)-[:RESONATES_WITH]->(ci:CodeImplementation)
          WITH p, count(ci) AS resonates_count
          ORDER BY resonates_count DESC, p.name ASC
          SKIP ${skip} LIMIT ${fetchCount}
          RETURN
            coalesce(p.id, toString(id(p))) AS id,
            coalesce(p.name, '') AS name,
            p.domain AS domain,
            p.description AS description,
            p.canonical_ref AS canonical_ref,
            resonates_count
        `;

        const result = await callMcpTool<unknown>(
          "data_graph_read",
          { query: cypher },
          { timeoutMs: 15000 },
        ).catch(() => null);

        if (result == null) {
          return jsonRes(
            { patterns: [], total: 0, hasMore: false, error: "Platform utilgængeligt" } satisfies PatternsResponse,
            503,
          );
        }

        const r = result as Record<string, unknown>;
        const inner = (r.result as Record<string, unknown>) ?? r;
        const rawRows: unknown = inner.results ?? inner.rows ?? inner.records ?? inner.data;
        const rows = Array.isArray(rawRows) ? (rawRows as Array<Record<string, unknown>>) : [];

        const hasMore = rows.length > limit;
        const slice = hasMore ? rows.slice(0, limit) : rows;

        const patterns: PatternRow[] = slice.map((row) => ({
          id: String(row.id ?? ""),
          name: String(row.name ?? ""),
          domain: row.domain != null ? String(row.domain) : null,
          description: row.description != null ? String(row.description).slice(0, 220) : null,
          canonical_ref: row.canonical_ref != null ? String(row.canonical_ref) : null,
          resonates_count: neo4jNum(row.resonates_count),
        }));

        return jsonRes({ patterns, total: patterns.length, hasMore } satisfies PatternsResponse, 200);
      },
    },
  },
});
