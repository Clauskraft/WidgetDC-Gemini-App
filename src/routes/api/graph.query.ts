/**
 * POST /api/graph/query — read-only WidgeTDC knowledge-graph access (AUR-2).
 *
 * Governance invariant: the browser may ONLY pick from a whitelist of named,
 * parameterized read queries — never send raw Cypher. The server maps a name
 * (+ vetted params) to a fixed read query, runs it via the platform
 * `data_graph_read` tool, and shapes the result into a GraphSpec /
 * KnowledgeGraphSpec the existing GraphBlock / KnowledgeGraphBlock can render.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isPlatformConfigured, queryGraph } from "@/lib/widgetdc.server";
import type { GraphSpec, KnowledgeGraphSpec } from "@/lib/figureBlocks";

const RequestSchema = z.object({
  query: z.enum(["label-overview", "neighbors", "sample-subgraph"]),
  // neighbors only: a node label to explore around (whitelisted set below).
  label: z.string().min(1).max(64).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

// Only these labels may be used as a `neighbors` seed — prevents arbitrary
// label injection even though the Cypher itself is fixed.
const ALLOWED_LABELS = new Set([
  "Agent",
  "MCPTool",
  "Engagement",
  "Decision",
  "AgentMemory",
  "KnowledgePattern",
  "RLMDecision",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...(init.headers ?? {}) },
  });
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "");
}

export const Route = createFileRoute("/api/graph/query")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        if (!isPlatformConfigured()) {
          return json({ error: "Platform not configured" }, { status: 503 });
        }
        let parsed: unknown;
        try {
          parsed = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const v = RequestSchema.safeParse(parsed);
        if (!v.success) {
          return json({ error: "Invalid request", details: v.error.flatten() }, { status: 422 });
        }
        const { query } = v.data;
        const limit = v.data.limit ?? 25;
        const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();

        if (query === "label-overview") {
          const rows = await queryGraph(
            `MATCH (n) RETURN labels(n)[0] AS label, count(*) AS c ORDER BY c DESC LIMIT ${limit}`,
            correlationId,
          );
          if (!rows) return json({ error: "graph unavailable" }, { status: 502 });
          // Render as a knowledge graph: a central "Graph" hub linked to each label.
          const spec: KnowledgeGraphSpec = {
            caption: "Knowledge graph — node labels by count",
            layout: "concentric",
            nodes: [
              { id: "__root__", label: "Knowledge Graph", type: "root" },
              ...rows.map((r) => ({
                id: str(r.label) || "unknown",
                label: `${str(r.label) || "unknown"} (${num(r.c).toLocaleString()})`,
                type: "label",
                data: { count: num(r.c) },
              })),
            ],
            edges: rows.map((r) => ({
              source: "__root__",
              target: str(r.label) || "unknown",
            })),
          };
          return json({ kind: "knowledge-graph", spec, correlationId });
        }

        if (query === "neighbors") {
          const label = v.data.label && ALLOWED_LABELS.has(v.data.label) ? v.data.label : "Agent";
          // Fixed shape; `label` is interpolated only from the allow-list set.
          const rows = await queryGraph(
            `MATCH (a:${label})-[r]->(b) RETURN id(a) AS aid, coalesce(a.name,a.id,a.title,labels(a)[0]) AS a, type(r) AS rel, id(b) AS bid, coalesce(b.name,b.id,b.title,labels(b)[0]) AS b LIMIT ${limit}`,
            correlationId,
          );
          if (!rows) return json({ error: "graph unavailable" }, { status: 502 });
          const nodeIds = new Set<string>();
          const nodes: GraphSpec["nodes"] = [];
          const edges: GraphSpec["edges"] = [];
          for (const r of rows) {
            const aId = `n${num(r.aid)}`;
            const bId = `n${num(r.bid)}`;
            if (!nodeIds.has(aId)) {
              nodeIds.add(aId);
              nodes.push({ id: aId, label: str(r.a), type: label.toLowerCase() });
            }
            if (!nodeIds.has(bId)) {
              nodeIds.add(bId);
              nodes.push({ id: bId, label: str(r.b), type: "entity" });
            }
            edges.push({ source: aId, target: bId, label: str(r.rel) });
          }
          const spec: GraphSpec = {
            caption: `Neighbors of ${label}`,
            layout: "elk-layered",
            direction: "RIGHT",
            nodes,
            edges,
          };
          return json({ kind: "graph", spec, correlationId });
        }

        // sample-subgraph: a small connected slice for a visual overview.
        const rows = await queryGraph(
          `MATCH (a)-[r]->(b) RETURN id(a) AS aid, coalesce(a.name,a.id,labels(a)[0]) AS a, labels(a)[0] AS at, type(r) AS rel, id(b) AS bid, coalesce(b.name,b.id,labels(b)[0]) AS b, labels(b)[0] AS bt LIMIT ${limit}`,
          correlationId,
        );
        if (!rows) return json({ error: "graph unavailable" }, { status: 502 });
        const seen = new Set<string>();
        const nodes: GraphSpec["nodes"] = [];
        const edges: GraphSpec["edges"] = [];
        for (const r of rows) {
          const aId = `n${num(r.aid)}`;
          const bId = `n${num(r.bid)}`;
          if (!seen.has(aId)) {
            seen.add(aId);
            nodes.push({ id: aId, label: str(r.a), type: str(r.at).toLowerCase() });
          }
          if (!seen.has(bId)) {
            seen.add(bId);
            nodes.push({ id: bId, label: str(r.b), type: str(r.bt).toLowerCase() });
          }
          edges.push({ source: aId, target: bId, label: str(r.rel) });
        }
        const spec: GraphSpec = {
          caption: "Sample subgraph",
          layout: "elk-force",
          nodes,
          edges,
        };
        return json({ kind: "graph", spec, correlationId });
      },
    },
  },
});
