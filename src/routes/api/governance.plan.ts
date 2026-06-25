/**
 * POST /api/governance/plan — AUR-4 human-in-the-loop write governance.
 *
 * The browser NEVER executes a write directly. It posts an action here and this
 * server route injects the platform bearer and drives the governance MCP tools:
 *   { action: "create" }  → governance_plan_create (apply:false → pending)
 *   { action: "approve" } → governance_plan_approve (operator gate)
 *   { action: "execute" } → governance_plan_execute (server-side enforced)
 *
 * Every body is Zod-validated. Secrets are read inside the handler via the
 * `*.server` helpers (never at module scope, never in the bundle).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  approveGovernancePlan,
  createGovernancePlan,
  executeGovernancePlan,
  GOV_PREFLIGHT_POLICY_ID,
  GOV_PREFLIGHT_POLICY_VERSION,
} from "@/lib/governance.server";
import { isPlatformConfigured } from "@/lib/widgetdc.server";

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

const PreflightSchema = z.object({
  policy_id: z.literal(GOV_PREFLIGHT_POLICY_ID),
  policy_version: z.literal(GOV_PREFLIGHT_POLICY_VERSION),
  intent: z.string().min(1),
  touch_class: z.enum(["staged_write", "production_write", "harvest_dispatch"]),
  patterns: z.array(z.string().min(1)).min(1),
  bom_id: z.string().min(1),
  stop_conditions: z.array(z.string().min(1)).min(1),
  evidence_refs: z.array(z.string()).optional(),
});

const CreateSchema = z.object({
  action: z.literal("create"),
  description: z.string().min(1).max(2000),
  scope: z.string().min(1).max(200),
  target_service: z.string().min(1).max(200),
  pattern_preflight: PreflightSchema.optional(),
});

const ApproveSchema = z.object({
  action: z.literal("approve"),
  plan_id: z.string().min(1),
  approver: z.string().min(1).max(200),
  pattern_preflight: PreflightSchema.optional(),
});

const ExecuteSchema = z.object({
  action: z.literal("execute"),
  plan_id: z.string().min(1),
  pattern_preflight: PreflightSchema.optional(),
});

const BodySchema = z.discriminatedUnion("action", [CreateSchema, ApproveSchema, ExecuteSchema]);

export const Route = createFileRoute("/api/governance/plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();

        if (!isPlatformConfigured()) {
          return json(
            { error: "Platform not configured (set WIDGETDC_BACKEND_URL + bearer)." },
            { status: 503, headers: { "x-correlation-id": correlationId } },
          );
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) {
          return json(
            { error: "Invalid request", details: parsed.error.flatten() },
            { status: 422, headers: { "x-correlation-id": correlationId } },
          );
        }
        const body = parsed.data;
        const headers = { "x-correlation-id": correlationId };

        if (body.action === "create") {
          const plan = await createGovernancePlan(
            {
              description: body.description,
              scope: body.scope,
              targetService: body.target_service,
              patternPreflight: body.pattern_preflight,
            },
            correlationId,
          );
          if (!plan) {
            return json(
              { error: "Plan creation failed or platform unavailable." },
              { status: 502, headers },
            );
          }
          return json({ plan }, { headers });
        }

        if (body.action === "approve") {
          const result = await approveGovernancePlan(
            body.plan_id,
            body.approver,
            body.pattern_preflight,
            correlationId,
          );
          if (!result) {
            return json(
              { error: "Approve failed or platform unavailable." },
              { status: 502, headers },
            );
          }
          return json({ result }, { status: result.ok ? 200 : 409, headers });
        }

        // action === "execute"
        const result = await executeGovernancePlan(
          body.plan_id,
          body.pattern_preflight,
          correlationId,
        );
        if (!result) {
          return json(
            { error: "Execute failed or platform unavailable." },
            { status: 502, headers },
          );
        }
        return json({ result }, { status: result.ok ? 200 : 409, headers });
      },
    },
  },
});
