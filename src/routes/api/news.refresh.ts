/**
 * POST /api/news.refresh
 *
 * On-demand trigger: harvests external intel for top pattern domains.
 * Fire-and-forget (returns 202 immediately). No mock data.
 *
 * Calls:
 *   - search_knowledge (fast, synchronous) per domain
 *   - research_harvest (slow, async S1-S4) per domain URL if provided
 */
import { createFileRoute } from "@tanstack/react-router";
import { callMcpTool } from "@/lib/widgetdc.server";

function jsonRes(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (result == null) return [];
  const r = result as Record<string, unknown>;
  const inner = (r.result as Record<string, unknown>) ?? r;
  const raw: unknown = inner.results ?? inner.rows ?? inner.records ?? inner.data;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

const DOMAIN_SEARCH_TOPICS: Record<string, string[]> = {
  Strategy: ["AI strategy 2026", "enterprise strategy trends", "Nordic strategy consulting"],
  Cybersecurity: ["cybersecurity threats 2026", "AI security vulnerabilities", "zero trust architecture"],
  Operations: ["operational excellence AI", "process optimization 2026", "lean digital operations"],
  "Financial": ["financial analysis AI", "CFO technology trends", "fintech 2026"],
  "Digital Transformation": ["digital transformation 2026", "enterprise AI adoption", "platform strategy"],
  "Supply Chain": ["supply chain resilience 2026", "AI supply chain optimization"],
};

export const Route = createFileRoute("/api/news/refresh")({
  server: {
    handlers: {
      POST: async () => {
        // Get top domains from graph
        const patternsCypher = `
          MATCH (e:Engagement)-[:UTILIZED_PATTERN]->(p:Pattern)
          WITH p.domain AS domain, count(DISTINCT e) AS cnt
          WHERE domain IS NOT NULL
          ORDER BY cnt DESC
          LIMIT 6
          RETURN DISTINCT domain
        `;

        const patResult = await callMcpTool<unknown>(
          "data_graph_read",
          { query: patternsCypher },
          { timeoutMs: 10000 },
        ).catch(() => null);

        const rows = extractRows(patResult);
        const domains = rows.map((r) => String(r.domain ?? "")).filter(Boolean);
        const searchDomains = domains.length > 0 ? domains : Object.keys(DOMAIN_SEARCH_TOPICS).slice(0, 4);

        // Fire-and-forget: kick off background harvests per domain
        const harvests: Promise<unknown>[] = [];

        for (const domain of searchDomains) {
          const topics = DOMAIN_SEARCH_TOPICS[domain] ?? [`${domain} trends 2026`, `${domain} AI insights`];

          for (const topic of topics.slice(0, 2)) {
            // search_knowledge is fast — include in parallel batch
            harvests.push(
              callMcpTool<unknown>("search_knowledge", { query: topic, limit: 10 }, { timeoutMs: 15000 }).catch(() => null),
            );

            // research_harvest is slow (S1-S4) — fire and forget
            callMcpTool<unknown>(
              "research_harvest",
              { topic, domain },
              { timeoutMs: 5000 },
            ).catch(() => null);
          }
        }

        // Await the fast searches, ignore research_harvest (async)
        await Promise.allSettled(harvests);

        return jsonRes(
          {
            ok: true,
            message: `Høst startet for ${searchDomains.length} domæner. Siden opdateres automatisk.`,
            domains: searchDomains,
          },
          202,
        );
      },
    },
  },
});
