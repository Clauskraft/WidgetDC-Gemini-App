/**
 * Adoption Dashboard aggregate route (B19 — LIN-1915).
 *
 * Aggregates the 6 live MCP/health sources into one JSON snapshot for
 * the client. Each source is wrapped in a Result discriminated union so
 * the UI can render per-card error states without one degraded source
 * blanking the dashboard.
 *
 * GET /api/adoption/metrics
 *   → 200 { ok: true, snapshot: AdoptionDashboardSnapshot }
 *
 * Sources (per B19 spec):
 *   - audit.adoption_metrics       → DAU/WAU/activation/funnel/topTools
 *   - intent.stats                 → tool/pattern counts, avg confidence
 *   - audit.enforce                → enforcement + 24h violations
 *   - wonder.a2a.reconcile         → A2A bridge status
 *   - wonder.status                → wonder runtime status
 *   - /health                      → deployed commit_sha
 */
import { createFileRoute } from "@tanstack/react-router";
import { getAdoptionDashboardSnapshot } from "@/lib/adoption.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

export const Route = createFileRoute("/api/adoption/metrics")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      GET: async () => {
        const snapshot = await getAdoptionDashboardSnapshot();
        return json({ ok: true, snapshot });
      },
    },
  },
});
