/**
 * GET /api/news
 *
 * Intelligence feed curated by most-used graph nodes.
 * 1. Top 8 patterns by engagement_count (same as monday-review, broader)
 * 2. For each pattern domain: semantic search via search_knowledge
 * 3. AssemblyBlock intel items tagged with matching domains
 * Returns only real data — no mock, no fallback fabrication.
 */
import { createFileRoute } from "@tanstack/react-router";
import { callMcpTool } from "@/lib/widgetdc.server";

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  domain: string;
  source: "intern" | "ekstern" | "marked";
  pattern_name: string | null;
  url: string | null;
  score: number;
  harvested_at: string | null;
};

export type NewsResponse = {
  items: NewsItem[];
  top_domains: string[];
  last_refreshed: string | null;
  error?: string;
};

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (result == null) return [];
  const r = result as Record<string, unknown>;
  const inner = (r.result as Record<string, unknown>) ?? r;
  const raw: unknown = inner.results ?? inner.rows ?? inner.records ?? inner.data;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

function neo4jNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.low === "number")
      return o.high ? (o.high as number) * 0x100000000 + (o.low as number) : (o.low as number);
  }
  return 0;
}

function str(v: unknown, fallback = ""): string {
  return v != null ? String(v) : fallback;
}

function jsonRes(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=120, stale-while-revalidate=300",
    },
  });
}

export const Route = createFileRoute("/api/news")({
  server: {
    handlers: {
      GET: async () => {
        // 1. Top patterns → derive active domains
        const patternsCypher = `
          MATCH (e:Engagement)-[:UTILIZED_PATTERN]->(p:Pattern)
          WITH p, count(DISTINCT e) AS engagement_count
          ORDER BY engagement_count DESC
          LIMIT 8
          RETURN
            coalesce(p.id, toString(id(p))) AS id,
            coalesce(p.name, '') AS name,
            p.domain AS domain,
            engagement_count
        `;

        // 2. AssemblyBlocks harvested from external sources (domain-tagged intel)
        const assemblyBlocksCypher = `
          MATCH (a:AssemblyBlock)
          WHERE a.domain IS NOT NULL AND a.content IS NOT NULL
            AND (a.source_type = 'external' OR a.harvested_at IS NOT NULL OR a.url IS NOT NULL)
          RETURN
            coalesce(a.id, toString(id(a))) AS id,
            coalesce(a.title, left(a.content, 80)) AS title,
            left(coalesce(a.content, ''), 240) AS summary,
            a.domain AS domain,
            a.source_type AS source_type,
            a.url AS url,
            coalesce(a.quality_score, 0) AS quality_score,
            a.harvested_at AS harvested_at
          ORDER BY a.harvested_at DESC
          LIMIT 40
        `;

        // 3. KnowledgeDocument nodes from research_harvest (external intel)
        const knowledgeDocsCypher = `
          MATCH (k:KnowledgeDocument)
          WHERE k.content IS NOT NULL
          RETURN
            coalesce(k.id, toString(id(k))) AS id,
            coalesce(k.title, left(k.content, 80)) AS title,
            left(coalesce(k.content, ''), 240) AS summary,
            coalesce(k.domain, k.topic, 'General') AS domain,
            'ekstern' AS source_type,
            k.url AS url,
            coalesce(k.relevance_score, k.quality_score, 0) AS quality_score,
            k.created_at AS harvested_at
          ORDER BY k.created_at DESC
          LIMIT 30
        `;

        const [patResult, abResult, kdResult] = await Promise.allSettled([
          callMcpTool<unknown>("data_graph_read", { query: patternsCypher }, { timeoutMs: 12000 }),
          callMcpTool<unknown>(
            "data_graph_read",
            { query: assemblyBlocksCypher },
            { timeoutMs: 12000 },
          ),
          callMcpTool<unknown>(
            "data_graph_read",
            { query: knowledgeDocsCypher },
            { timeoutMs: 12000 },
          ),
        ]);

        const patRows = patResult.status === "fulfilled" ? extractRows(patResult.value) : [];
        const abRows = abResult.status === "fulfilled" ? extractRows(abResult.value) : [];
        const kdRows = kdResult.status === "fulfilled" ? extractRows(kdResult.value) : [];

        if (patRows.length === 0 && abRows.length === 0 && kdRows.length === 0) {
          return jsonRes(
            {
              items: [],
              top_domains: [],
              last_refreshed: null,
              error: "Ingen data endnu — tryk Opdatér for at starte høst.",
            } satisfies NewsResponse,
            200,
          );
        }

        const topDomains = [...new Set(patRows.map((r) => str(r.domain)).filter(Boolean))].slice(
          0,
          6,
        );

        // Build pattern name lookup by domain
        const domainToPattern: Record<string, string> = {};
        for (const r of patRows) {
          const d = str(r.domain);
          if (d && !domainToPattern[d]) domainToPattern[d] = str(r.name);
        }

        const items: NewsItem[] = [];

        // AssemblyBlocks → intern or ekstern
        for (const r of abRows) {
          const domain = str(r.domain, "General");
          const srcType = str(r.source_type);
          const source: NewsItem["source"] =
            srcType === "external" || srcType === "ekstern"
              ? "ekstern"
              : srcType === "market" || srcType === "marked"
                ? "marked"
                : "intern";
          items.push({
            id: str(r.id),
            title: str(r.title) || "(uden titel)",
            summary: str(r.summary),
            domain,
            source,
            pattern_name: domainToPattern[domain] ?? null,
            url: r.url != null ? str(r.url) : null,
            score: neo4jNum(r.quality_score),
            harvested_at: r.harvested_at != null ? str(r.harvested_at) : null,
          });
        }

        // KnowledgeDocuments → ekstern
        for (const r of kdRows) {
          const domain = str(r.domain, "General");
          items.push({
            id: `kd-${str(r.id)}`,
            title: str(r.title) || "(uden titel)",
            summary: str(r.summary),
            domain,
            source: "ekstern",
            pattern_name: domainToPattern[domain] ?? null,
            url: r.url != null ? str(r.url) : null,
            score: neo4jNum(r.quality_score),
            harvested_at: r.harvested_at != null ? str(r.harvested_at) : null,
          });
        }

        // Deduplicate by title+domain
        const seen = new Set<string>();
        const deduped = items.filter((item) => {
          const key = `${item.domain}:${item.title.slice(0, 60).toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Sort: ekstern first (fresh market intel), then by score desc
        deduped.sort((a, b) => {
          const srcOrder = { ekstern: 0, marked: 1, intern: 2 };
          const sd = srcOrder[a.source] - srcOrder[b.source];
          if (sd !== 0) return sd;
          return b.score - a.score;
        });

        const lastRefreshed = deduped.find((i) => i.harvested_at)?.harvested_at ?? null;

        return jsonRes(
          {
            items: deduped.slice(0, 50),
            top_domains: topDomains,
            last_refreshed: lastRefreshed,
          } satisfies NewsResponse,
          200,
        );
      },
    },
  },
});
