/**
 * GET /api/observability/summary — Observability Monitor (Phase 3).
 *
 * Returns a live fleet runtime snapshot (agents, requests, success-rate, per-tool
 * error rates) + Neo4j graph size, sourced from the platform `runtime_summary`
 * and `data_graph_stats` tools. Server-only; both calls are best-effort.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  isPlatformConfigured,
  fetchRuntimeSnapshot,
  fetchGraphSnapshot,
} from "@/lib/widgetdc.server";

function json(body: unknown, status: number, correlationId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-correlation-id": correlationId },
  });
}

export const Route = createFileRoute("/api/observability/summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();

        if (!isPlatformConfigured()) {
          return json(
            {
              error:
                "Platform not configured — set WIDGETDC_BEARER_TOKEN (legacy: WIDGETDC_API_KEY) + WIDGETDC_BACKEND_URL.",
            },
            503,
            correlationId,
          );
        }

        const [runtime, graph] = await Promise.all([
          fetchRuntimeSnapshot(correlationId),
          fetchGraphSnapshot(correlationId),
        ]);

        if (!runtime && !graph) {
          return json(
            { error: "Observability data unavailable from the platform." },
            502,
            correlationId,
          );
        }

        return json({ runtime, graph, correlationId }, 200, correlationId);
      },
    },
  },
});
