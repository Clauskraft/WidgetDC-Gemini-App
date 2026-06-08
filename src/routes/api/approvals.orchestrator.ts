/**
 * Orchestrator plan-approval store proxy (LIN-1911 A2.2 Dashboard).
 *
 * Tunnels Dashboard ApprovalQueuePanel actions to orchestrator-production
 * HyperAgent endpoints without exposing the orchestrator bearer to the browser.
 *
 * GET  ?planId=<id>              → fetch one plan's approval record
 * POST { action:"approve", planId, approver }
 *
 * Note: orchestrator does NOT today expose a list-pending endpoint
 * symmetrical to backend's GET /pending. The Dashboard discovers candidate
 * plan_ids out-of-band (from a tool-call response) and the operator pastes /
 * confirms them here. When orchestrator adds a list endpoint, this route
 * can be extended.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  approveOrchestratorPlan,
  getOrchestratorApproval,
  isOrchestratorApprovalConfigured,
} from "@/lib/approvals.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

const PostSchema = z.object({
  action: z.literal("approve"),
  planId: z.string().min(1).max(200),
  approver: z.string().min(1).max(200),
});

export const Route = createFileRoute("/api/approvals/orchestrator")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      GET: async ({ request }) => {
        if (!isOrchestratorApprovalConfigured()) {
          return json({ error: "orchestrator_not_configured" }, { status: 503 });
        }
        const url = new URL(request.url);
        const planId = url.searchParams.get("planId")?.trim();
        if (!planId) {
          return json({ error: "planId required" }, { status: 400 });
        }
        const result = await getOrchestratorApproval(planId);
        if (!result.ok) {
          const status = result.status === 404 ? 404 : 502;
          return json({ error: result.error, upstream_status: result.status }, { status });
        }
        return json({ ok: true, record: result.record });
      },

      POST: async ({ request }) => {
        if (!isOrchestratorApprovalConfigured()) {
          return json({ error: "orchestrator_not_configured" }, { status: 503 });
        }
        let parsed: unknown;
        try {
          parsed = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const v = PostSchema.safeParse(parsed);
        if (!v.success) {
          return json({ error: "Invalid request", details: v.error.flatten() }, { status: 422 });
        }
        const result = await approveOrchestratorPlan(v.data.planId, v.data.approver);
        if (!result.ok) {
          return json({ error: result.error, upstream_status: result.status }, { status: 502 });
        }
        return json({ ok: true, record: result.record });
      },
    },
  },
});
