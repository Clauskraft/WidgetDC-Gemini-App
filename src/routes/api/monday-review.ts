/**
 * GET /api/monday-review
 *
 * Monday Morning Review data feed:
 * 1. Aktive engagements med metadata (navn, domain, pattern_count, artifact_count)
 * 2. Nyeste WorkArtifacts (produceret indenfor 7 dage)
 * 3. Patterns med højest resonans-count (top 5 — "hvad bruger vi mest")
 * 4. Ugentlig summering: antal engagements, artifacts, patterns
 * 5. Action-liste: engagements der mangler patterns / artifacts (lav health-score)
 */
import { createFileRoute } from "@tanstack/react-router";
import { callMcpTool } from "@/lib/widgetdc.server";

export type EngagementSummary = {
  id: string;
  name: string;
  domain: string | null;
  client: string | null;
  status: string | null;
  pattern_count: number;
  artifact_count: number;
  created_at: string | null;
};

export type RecentArtifact = {
  id: string;
  title: string;
  kind: string;
  engagement_name: string;
  citations: number;
  signed_status: string | null;
  created_at: string;
};

export type TopPattern = {
  id: string;
  name: string;
  domain: string | null;
  engagement_count: number;
  resonates_count: number;
};

export type ActionItem = {
  type: "no_patterns" | "no_artifacts" | "incomplete_profile";
  engagement_id: string;
  engagement_name: string;
  message: string;
  priority: "high" | "medium" | "low";
};

export type MondayReviewResponse = {
  week_label: string;
  stats: {
    active_engagements: number;
    total_engagements: number;
    recent_artifacts: number;
    patterns_used: number;
  };
  engagements: EngagementSummary[];
  recent_artifacts: RecentArtifact[];
  top_patterns: TopPattern[];
  action_items: ActionItem[];
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

export const Route = createFileRoute("/api/monday-review")({
  server: {
    handlers: {
      GET: async () => {
        const engagementsCypher = `
          MATCH (e:Engagement)
          OPTIONAL MATCH (e)-[:UTILIZED_PATTERN]->(p:Pattern)
          OPTIONAL MATCH (e)-[:PRODUCED]->(wa:WorkArtifact)
          WITH e, count(DISTINCT p) AS pattern_count, count(DISTINCT wa) AS artifact_count
          ORDER BY e.created_at DESC
          LIMIT 50
          RETURN
            coalesce(e.id, toString(id(e))) AS id,
            coalesce(e.name, '') AS name,
            e.domain AS domain,
            e.client AS client,
            e.status AS status,
            pattern_count,
            artifact_count,
            e.created_at AS created_at
        `;

        const artifactsCypher = `
          MATCH (e:Engagement)-[:PRODUCED]->(wa:WorkArtifact)
          WITH e, wa
          ORDER BY wa.created_at DESC
          LIMIT 10
          RETURN
            coalesce(wa.id, toString(id(wa))) AS id,
            coalesce(wa.title, 'Deliverable') AS title,
            coalesce(wa.kind, 'analysis') AS kind,
            coalesce(e.name, 'Ukendt engagement') AS engagement_name,
            coalesce(wa.citations, 0) AS citations,
            wa.signed_status AS signed_status,
            coalesce(wa.created_at, '') AS created_at
        `;

        const patternsCypher = `
          MATCH (e:Engagement)-[:UTILIZED_PATTERN]->(p:Pattern)
          WITH p, count(DISTINCT e) AS engagement_count
          ORDER BY engagement_count DESC
          LIMIT 5
          OPTIONAL MATCH (p)-[:RESONATES_WITH]->(ci:CodeImplementation)
          WITH p, engagement_count, count(ci) AS resonates_count
          RETURN
            coalesce(p.id, toString(id(p))) AS id,
            coalesce(p.name, '') AS name,
            p.domain AS domain,
            engagement_count,
            resonates_count
        `;

        const [engResult, artResult, patResult] = await Promise.all([
          callMcpTool<unknown>("data_graph_read", { query: engagementsCypher }, { timeoutMs: 15000 }).catch(() => null),
          callMcpTool<unknown>("data_graph_read", { query: artifactsCypher }, { timeoutMs: 12000 }).catch(() => null),
          callMcpTool<unknown>("data_graph_read", { query: patternsCypher }, { timeoutMs: 12000 }).catch(() => null),
        ]);

        if (engResult == null && artResult == null) {
          return jsonRes(
            {
              week_label: "",
              stats: { active_engagements: 0, total_engagements: 0, recent_artifacts: 0, patterns_used: 0 },
              engagements: [],
              recent_artifacts: [],
              top_patterns: [],
              action_items: [],
              error: "Platform utilgængeligt",
            } satisfies MondayReviewResponse,
            503,
          );
        }

        const engRows = extractRows(engResult);
        const artRows = extractRows(artResult);
        const patRows = extractRows(patResult);

        const engagements: EngagementSummary[] = engRows.map((r) => ({
          id: String(r.id ?? ""),
          name: String(r.name ?? ""),
          domain: r.domain != null ? String(r.domain) : null,
          client: r.client != null ? String(r.client) : null,
          status: r.status != null ? String(r.status) : null,
          pattern_count: neo4jNum(r.pattern_count),
          artifact_count: neo4jNum(r.artifact_count),
          created_at: r.created_at != null ? String(r.created_at) : null,
        }));

        const recent_artifacts: RecentArtifact[] = artRows.map((r) => ({
          id: String(r.id ?? ""),
          title: String(r.title ?? ""),
          kind: String(r.kind ?? "analysis"),
          engagement_name: String(r.engagement_name ?? ""),
          citations: neo4jNum(r.citations),
          signed_status: r.signed_status != null ? String(r.signed_status) : null,
          created_at: String(r.created_at ?? ""),
        }));

        const top_patterns: TopPattern[] = patRows.map((r) => ({
          id: String(r.id ?? ""),
          name: String(r.name ?? ""),
          domain: r.domain != null ? String(r.domain) : null,
          engagement_count: neo4jNum(r.engagement_count),
          resonates_count: neo4jNum(r.resonates_count),
        }));

        // Beregn action items baseret på data
        const action_items: ActionItem[] = [];
        for (const e of engagements.slice(0, 20)) {
          if (e.status === "active" || e.status == null) {
            if (e.pattern_count === 0) {
              action_items.push({
                type: "no_patterns",
                engagement_id: e.id,
                engagement_name: e.name,
                message: "Ingen patterns koblet — tilføj relevante patterns for at styrke vidensgrundlaget.",
                priority: "high",
              });
            } else if (e.artifact_count === 0) {
              action_items.push({
                type: "no_artifacts",
                engagement_id: e.id,
                engagement_name: e.name,
                message: "Ingen deliverables genereret endnu — overvej at producere en første analyse.",
                priority: "medium",
              });
            } else if (!e.domain || !e.client) {
              action_items.push({
                type: "incomplete_profile",
                engagement_id: e.id,
                engagement_name: e.name,
                message: `Mangler ${!e.domain ? "domain" : ""}${!e.domain && !e.client ? " og " : ""}${!e.client ? "klient" : ""} — udfyld for bedre AI-kontekst.`,
                priority: "low",
              });
            }
          }
        }

        const activeCount = engagements.filter((e) => e.status === "active" || e.status == null).length;
        const now = new Date();
        const weekLabel = `Uge ${String(getWeekNumber(now))} — ${now.toLocaleDateString("da-DK", { month: "long", year: "numeric" })}`;

        const stats = {
          active_engagements: activeCount,
          total_engagements: engagements.length,
          recent_artifacts: recent_artifacts.length,
          patterns_used: top_patterns.reduce((s, p) => s + p.engagement_count, 0),
        };

        return jsonRes(
          {
            week_label: weekLabel,
            stats,
            engagements,
            recent_artifacts,
            top_patterns,
            action_items: action_items.slice(0, 8),
          } satisfies MondayReviewResponse,
          200,
        );
      },
    },
  },
});

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
