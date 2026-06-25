/**
 * Server-only WidgeTDC governance plan lifecycle (AUR-4).
 *
 * Human-in-the-loop write governance: the browser NEVER executes a write-capable
 * or cross-domain operation directly. It tunnels through this app's own server
 * route (`api/governance.plan.ts`), which injects the platform bearer and drives
 * the platform governance MCP tools in sequence:
 *
 *   governance_plan_create (apply:false → stays pending_approval)
 *     → governance_plan_approve (operator HITL gate)
 *       → governance_plan_execute (server-side, policy-profile enforced)
 *
 * `governance_matrix` is read for the inline enforcement display.
 *
 * Mirrors the CLAUDE.md invariant: client-side governance is display-only; the
 * real write-enforcement stays server-side / on the WidgeTDC platform. Every
 * mutating call runs here with the bearer; the client only sees sanitized plan
 * summaries. All helpers degrade to null on platform unavailability.
 */
import { callMcpTool } from "./widgetdc.server";

export const GOV_PREFLIGHT_POLICY_ID = "WTD-GOV-PREFLIGHT-001";
export const GOV_PREFLIGHT_POLICY_VERSION = "2026-06-17";

export type GovTouchClass = "staged_write" | "production_write" | "harvest_dispatch";

/**
 * The pattern-preflight envelope the platform requires before any
 * staged_write / production_write / harvest_dispatch system touch.
 */
export type PatternPreflight = {
  policy_id: typeof GOV_PREFLIGHT_POLICY_ID;
  policy_version: typeof GOV_PREFLIGHT_POLICY_VERSION;
  intent: string;
  touch_class: GovTouchClass;
  patterns: string[];
  bom_id: string;
  stop_conditions: string[];
  evidence_refs?: string[];
};

export type GovernancePlan = {
  planId: string;
  status: string;
  approved: boolean;
  scope?: string;
  riskLevel?: string;
  description?: string;
  targetService?: string;
  expiresAt?: string;
};

export type GovActionResult = {
  planId: string;
  status: string;
  ok: boolean;
  message?: string;
};

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Unwrap the `{ result }` / `{ plan }` MCP envelope down to the payload object. */
function unwrap(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const inner =
    (r.result as Record<string, unknown> | undefined) ??
    (r.plan as Record<string, unknown> | undefined) ??
    r;
  return inner ?? null;
}

/**
 * Extract a normalized plan summary from a `governance_plan_create` envelope.
 * Pure + synchronous so it is unit-testable without a live platform.
 */
export function extractGovernancePlan(result: unknown): GovernancePlan | null {
  const inner = unwrap(result);
  if (!inner) return null;
  const planId = str(inner.plan_id) ?? str(inner.planId) ?? str(inner.id);
  if (!planId) return null;
  const status = str(inner.status) ?? str(inner.state) ?? "pending_approval";
  const approved = inner.approved === true || status === "approved" || status === "executed";
  return {
    planId,
    status,
    approved,
    scope: str(inner.scope),
    riskLevel: str(inner.risk_level) ?? str(inner.riskLevel) ?? str(inner.risk),
    description: str(inner.description),
    targetService: str(inner.target_service) ?? str(inner.targetService),
    expiresAt: str(inner.expires_at) ?? str(inner.expiresAt),
  };
}

/** Extract the outcome of an approve/execute action. Pure + synchronous. */
export function extractPlanActionResult(
  result: unknown,
  fallbackPlanId: string,
): GovActionResult | null {
  const inner = unwrap(result);
  if (!inner) return null;
  const planId = str(inner.plan_id) ?? str(inner.planId) ?? str(inner.id) ?? fallbackPlanId;
  const status = str(inner.status) ?? str(inner.state) ?? "unknown";
  const ok = inner.success !== false && status !== "failed" && status !== "rejected";
  return { planId, status, ok, message: str(inner.message) ?? str(inner.error) };
}

export type CreateGovernancePlanInput = {
  description: string;
  scope: string;
  targetService: string;
  patternPreflight?: PatternPreflight;
};

/**
 * Create a governance plan in `pending_approval` (apply:false enforces the
 * human gate — this app never auto-approves a write). Returns the plan summary
 * or null on failure.
 */
export async function createGovernancePlan(
  input: CreateGovernancePlanInput,
  correlationId?: string,
): Promise<GovernancePlan | null> {
  const result = await callMcpTool<unknown>(
    "governance_plan_create",
    {
      description: input.description,
      scope: input.scope,
      target_service: input.targetService,
      // HITL: never auto-approve from the browser-facing surface.
      apply: false,
      ...(input.patternPreflight ? { pattern_preflight: input.patternPreflight } : {}),
    },
    { correlationId, timeoutMs: 15000 },
  );
  return extractGovernancePlan(result);
}

/** Approve a pending plan (operator identity recorded server-side). */
export async function approveGovernancePlan(
  planId: string,
  approver: string,
  patternPreflight?: PatternPreflight,
  correlationId?: string,
): Promise<GovActionResult | null> {
  const result = await callMcpTool<unknown>(
    "governance_plan_approve",
    {
      plan_id: planId,
      approver,
      ...(patternPreflight ? { pattern_preflight: patternPreflight } : {}),
    },
    { correlationId, timeoutMs: 15000 },
  );
  return extractPlanActionResult(result, planId);
}

/** Execute an approved plan server-side (policy-profile enforced on platform). */
export async function executeGovernancePlan(
  planId: string,
  patternPreflight?: PatternPreflight,
  correlationId?: string,
): Promise<GovActionResult | null> {
  const result = await callMcpTool<unknown>(
    "governance_plan_execute",
    {
      plan_id: planId,
      ...(patternPreflight ? { pattern_preflight: patternPreflight } : {}),
    },
    { correlationId, timeoutMs: 30000 },
  );
  return extractPlanActionResult(result, planId);
}

/** Read the Manifesto enforcement matrix for the inline policy display. */
export async function fetchGovernanceMatrix(correlationId?: string): Promise<string | null> {
  const result = await callMcpTool<unknown>(
    "governance_matrix",
    { filter: "all" },
    { correlationId, timeoutMs: 8000 },
  );
  if (result == null) return null;
  if (typeof result === "string") return result.trim() || null;
  try {
    return JSON.stringify(result).slice(0, 4000);
  } catch {
    return null;
  }
}
