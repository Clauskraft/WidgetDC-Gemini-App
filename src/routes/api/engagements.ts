/**
 * GET /api/engagements — Engagement list + search.
 * POST /api/engagements — Create new Engagement.
 *
 * Reads/writes Engagement nodes in the WidgeTDC knowledge graph via MCP.
 * Response shape: { engagements: EngagementRow[], total: number, hasMore: boolean }
 */
import { createFileRoute } from "@tanstack/react-router";
import { callMcpTool } from "@/lib/widgetdc.server";

export type EngagementRow = {
  id: string;
  name: string;
  domain: string | null;
  description: string | null;
  status: string | null;
  client: string | null;
  created_at: string | null;
  pattern_count: number;
};

export type EngagementsResponse = {
  engagements: EngagementRow[];
  total: number;
  hasMore: boolean;
  error?: string;
};

export type CreateEngagementBody = {
  name: string;
  domain?: string;
  description?: string;
  status?: string;
  client?: string;
};

export type CreateEngagementResponse = {
  id?: string;
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

export const Route = createFileRoute("/api/engagements")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get("q")?.trim() ?? "";
        const domain = url.searchParams.get("domain")?.trim() ?? "";
        const status = url.searchParams.get("status")?.trim() ?? "";
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
            `(toLower(e.name) CONTAINS '${safe}' OR toLower(coalesce(e.description,'')) CONTAINS '${safe}' OR toLower(coalesce(e.client,'')) CONTAINS '${safe}')`,
          );
        }
        if (domain) {
          const safe = escCypher(domain.toLowerCase());
          whereClauses.push(`toLower(coalesce(e.domain,'')) CONTAINS '${safe}'`);
        }
        if (status) {
          const safe = escCypher(status.toLowerCase());
          whereClauses.push(`toLower(coalesce(e.status,'')) CONTAINS '${safe}'`);
        }
        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        const cypher = `
          MATCH (e:Engagement)
          ${whereClause}
          OPTIONAL MATCH (e)-[:UTILIZED_PATTERN]->(p:Pattern)
          WITH e, count(p) AS pattern_count
          ORDER BY e.created_at DESC, e.name ASC
          SKIP ${skip} LIMIT ${fetchCount}
          RETURN
            coalesce(e.id, toString(id(e))) AS id,
            coalesce(e.name, '') AS name,
            e.domain AS domain,
            e.description AS description,
            e.status AS status,
            e.client AS client,
            e.created_at AS created_at,
            pattern_count
        `;

        const result = await callMcpTool<unknown>(
          "data_graph_read",
          { query: cypher },
          { timeoutMs: 15000 },
        ).catch(() => null);

        if (result == null) {
          return jsonRes(
            {
              engagements: [],
              total: 0,
              hasMore: false,
              error: "Platform utilgængeligt",
            } satisfies EngagementsResponse,
            503,
          );
        }

        const r = result as Record<string, unknown>;
        const inner = (r.result as Record<string, unknown>) ?? r;
        const rawRows: unknown = inner.results ?? inner.rows ?? inner.records ?? inner.data;
        const rows = Array.isArray(rawRows) ? (rawRows as Array<Record<string, unknown>>) : [];

        const hasMore = rows.length > limit;
        const slice = hasMore ? rows.slice(0, limit) : rows;

        const engagements: EngagementRow[] = slice.map((row) => ({
          id: String(row.id ?? ""),
          name: String(row.name ?? ""),
          domain: row.domain != null ? String(row.domain) : null,
          description: row.description != null ? String(row.description).slice(0, 220) : null,
          status: row.status != null ? String(row.status) : null,
          client: row.client != null ? String(row.client) : null,
          created_at: row.created_at != null ? String(row.created_at) : null,
          pattern_count: neo4jNum(row.pattern_count),
        }));

        return jsonRes(
          { engagements, total: engagements.length, hasMore } satisfies EngagementsResponse,
          200,
        );
      },

      POST: async ({ request }: { request: Request }) => {
        let body: CreateEngagementBody;
        try {
          body = (await request.json()) as CreateEngagementBody;
        } catch {
          return jsonRes({ error: "Ugyldig JSON" } satisfies CreateEngagementResponse, 400);
        }

        const name = body.name?.trim();
        if (!name) {
          return jsonRes({ error: "name er påkrævet" } satisfies CreateEngagementResponse, 400);
        }

        const id = `eng-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();

        const cypher = `
          CREATE (e:Engagement {
            id: '${escCypher(id)}',
            name: '${escCypher(name)}',
            domain: ${body.domain ? `'${escCypher(body.domain)}'` : "null"},
            description: ${body.description ? `'${escCypher(body.description.slice(0, 500))}'` : "null"},
            status: '${escCypher(body.status ?? "active")}',
            client: ${body.client ? `'${escCypher(body.client)}'` : "null"},
            created_at: '${now}'
          })
          RETURN e.id AS id
        `;

        const result = await callMcpTool<unknown>(
          "data_graph_read",
          { query: cypher },
          { timeoutMs: 10000 },
        ).catch(() => null);

        if (result == null) {
          return jsonRes(
            { error: "Platform utilgængeligt" } satisfies CreateEngagementResponse,
            503,
          );
        }

        return jsonRes({ id } satisfies CreateEngagementResponse, 201);
      },
    },
  },
});
