/**
 * Backend human-approval store proxy (LIN-1911 A2.2 Dashboard).
 *
 * Tunnels Dashboard ApprovalQueuePanel actions to backend-production
 * `/api/approvals/*` without exposing the backend bearer to the browser.
 *
 * GET  ?action=pending           → list pending requests
 * POST { action:"approve", requestId, approvedBy }
 * POST { action:"reject",  requestId, rejectedBy, reason }
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  approveBackend,
  isBackendApprovalConfigured,
  listBackendPending,
  rejectBackend,
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

const PostSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    requestId: z.string().min(1).max(200),
    approvedBy: z.string().min(1).max(200),
  }),
  z.object({
    action: z.literal("reject"),
    requestId: z.string().min(1).max(200),
    rejectedBy: z.string().min(1).max(200),
    reason: z.string().min(1).max(1000),
  }),
]);

export const Route = createFileRoute("/api/approvals/backend")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      GET: async () => {
        if (!isBackendApprovalConfigured()) {
          return json({ error: "backend_not_configured" }, { status: 503 });
        }
        const result = await listBackendPending();
        if (!result.ok) {
          return json({ error: result.error, upstream_status: result.status }, { status: 502 });
        }
        return json({ ok: true, requests: result.requests });
      },

      POST: async ({ request }) => {
        if (!isBackendApprovalConfigured()) {
          return json({ error: "backend_not_configured" }, { status: 503 });
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
        const body = v.data;
        const result =
          body.action === "approve"
            ? await approveBackend(body.requestId, body.approvedBy)
            : await rejectBackend(body.requestId, body.rejectedBy, body.reason);
        if (!result.ok) {
          return json({ error: result.error, upstream_status: result.status }, { status: 502 });
        }
        return json({ ok: true, request: result.request });
      },
    },
  },
});
