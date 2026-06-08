/**
 * Server-only approval-store proxy helpers (LIN-1911 A2 Dashboard integration).
 *
 * The Dashboard ApprovalQueuePanel renders TWO stores side-by-side:
 *
 *  1. **Backend human-approval store** (`humanApprovalService` behind
 *     `apps/backend/src/routes/approvals.ts` on backend-production). Created by
 *     the GOV-7 fix (PR #6126). In-process governance — backend-internal
 *     human-in-the-loop checks.
 *
 *  2. **Orchestrator plan-approval store** (PR #420 read endpoint
 *     `GET /api/hyperagent/approvals/:planId`, write endpoint
 *     `POST /api/hyperagent/approve_plan`). The LIN-1911 keystone read-store
 *     that backend's `resolveOrchestratorPlan` consults to gate
 *     `requires_plan` tools (including `graph.promote_phantom_bom_run`).
 *
 * Both bearers live in env. They MUST NOT ship to the browser — every
 * approval action in the UI tunnels through the Gemini-App's own server
 * routes, which call these helpers, which inject the right bearer.
 */
import process from "node:process";

const DEFAULT_TIMEOUT_MS = 8000;

interface ServiceConfig {
  url: string;
  key: string;
}

function backendConfig(): ServiceConfig | null {
  const base = process.env.WIDGETDC_BACKEND_URL ?? process.env.WIDGETDC_ORCHESTRATOR_URL;
  const key = process.env.WIDGETDC_API_KEY ?? process.env.MCP_AGENT_API_KEY;
  if (!base || !key) return null;
  return { url: base.replace(/\/+$/, ""), key };
}

function orchestratorConfig(): ServiceConfig | null {
  const base = process.env.WIDGETDC_ORCHESTRATOR_URL;
  const key = process.env.WIDGETDC_ORCHESTRATOR_API_KEY ?? process.env.ORCHESTRATOR_API_KEY;
  if (!base || !key) return null;
  return { url: base.replace(/\/+$/, ""), key };
}

export function isBackendApprovalConfigured(): boolean {
  return backendConfig() !== null;
}

export function isOrchestratorApprovalConfigured(): boolean {
  return orchestratorConfig() !== null;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Backend human-approval store ────────────────────────────────────────────

export interface BackendApprovalRequest {
  requestId: string;
  toolName?: string;
  description?: string;
  payload?: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  createdAt?: string;
  expiresAt?: string;
  approvedBy?: string;
  rejectedBy?: string;
  reason?: string;
  [key: string]: unknown;
}

export async function listBackendPending(): Promise<
  { ok: true; requests: BackendApprovalRequest[] } | { ok: false; error: string; status?: number }
> {
  const cfg = backendConfig();
  if (!cfg) return { ok: false, error: "backend_not_configured" };
  const res = await fetchWithTimeout(`${cfg.url}/api/approvals/pending`, {
    headers: { authorization: `Bearer ${cfg.key}`, accept: "application/json" },
  });
  if (!res) return { ok: false, error: "network_error" };
  if (!res.ok) return { ok: false, error: "non_2xx", status: res.status };
  const body = (await res.json()) as {
    success?: boolean;
    requests?: BackendApprovalRequest[];
  };
  if (!body.success || !Array.isArray(body.requests)) {
    return { ok: false, error: "malformed_response" };
  }
  return { ok: true, requests: body.requests };
}

export async function approveBackend(
  requestId: string,
  approvedBy: string,
): Promise<
  { ok: true; request: BackendApprovalRequest } | { ok: false; error: string; status?: number }
> {
  const cfg = backendConfig();
  if (!cfg) return { ok: false, error: "backend_not_configured" };
  const res = await fetchWithTimeout(
    `${cfg.url}/api/approvals/${encodeURIComponent(requestId)}/approve`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.key}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ approvedBy }),
    },
  );
  if (!res) return { ok: false, error: "network_error" };
  if (!res.ok) return { ok: false, error: "non_2xx", status: res.status };
  const body = (await res.json()) as {
    success?: boolean;
    request?: BackendApprovalRequest;
    error?: string;
  };
  if (!body.success || !body.request) {
    return { ok: false, error: body.error ?? "malformed_response" };
  }
  return { ok: true, request: body.request };
}

export async function rejectBackend(
  requestId: string,
  rejectedBy: string,
  reason: string,
): Promise<
  { ok: true; request: BackendApprovalRequest } | { ok: false; error: string; status?: number }
> {
  const cfg = backendConfig();
  if (!cfg) return { ok: false, error: "backend_not_configured" };
  const res = await fetchWithTimeout(
    `${cfg.url}/api/approvals/${encodeURIComponent(requestId)}/reject`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.key}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ rejectedBy, reason }),
    },
  );
  if (!res) return { ok: false, error: "network_error" };
  if (!res.ok) return { ok: false, error: "non_2xx", status: res.status };
  const body = (await res.json()) as {
    success?: boolean;
    request?: BackendApprovalRequest;
    error?: string;
  };
  if (!body.success || !body.request) {
    return { ok: false, error: body.error ?? "malformed_response" };
  }
  return { ok: true, request: body.request };
}

// ── Orchestrator plan-approval store (LIN-1911) ────────────────────────────

export interface OrchestratorApprovalRecord {
  approved: boolean;
  plan_id: string;
  scope?: string | null;
  expires_at?: string | null;
  approved_by?: string | null;
  correlation_id?: string | null;
}

export async function getOrchestratorApproval(
  planId: string,
): Promise<
  { ok: true; record: OrchestratorApprovalRecord } | { ok: false; error: string; status?: number }
> {
  const cfg = orchestratorConfig();
  if (!cfg) return { ok: false, error: "orchestrator_not_configured" };
  const res = await fetchWithTimeout(
    `${cfg.url}/api/hyperagent/approvals/${encodeURIComponent(planId)}`,
    {
      headers: { authorization: `Bearer ${cfg.key}`, accept: "application/json" },
    },
  );
  if (!res) return { ok: false, error: "network_error" };
  if (!res.ok) return { ok: false, error: "non_2xx", status: res.status };
  const body = (await res.json()) as OrchestratorApprovalRecord;
  if (typeof body.plan_id !== "string") {
    return { ok: false, error: "malformed_response" };
  }
  return { ok: true, record: body };
}

export async function approveOrchestratorPlan(
  planId: string,
  approver: string,
): Promise<
  | { ok: true; record: OrchestratorApprovalRecord }
  | { ok: false; error: string; status?: number; upstream_body?: string }
> {
  const cfg = orchestratorConfig();
  if (!cfg) return { ok: false, error: "orchestrator_not_configured" };
  // LIN-1911 — orchestrator's /api/hyperagent/approve_plan rejects minimal
  // {plan_id, approver} payloads with 400. The error.required_payload hint
  // from the backend's own governance gate cites intent/scope/risk_level/
  // tool_name; we forward those defaults so the operator's Approve click
  // can succeed without UI-side gymnastics. Orchestrator ignores unknown
  // keys, so passing extras is safe even if the schema is narrower.
  const payload = {
    plan_id: planId,
    approver,
    // Sensible defaults that match the BOM-promotion path we're unblocking.
    intent: "lin1911_orchestrator_plan_approval",
    scope: "production_write",
    risk_level: "production_write",
    tool_name: "graph.promote_phantom_bom_run",
  };
  const res = await fetchWithTimeout(`${cfg.url}/api/hyperagent/approve_plan`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.key}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res) return { ok: false, error: "network_error" };
  // Capture the upstream body even on non-2xx so the UI/diagnose loop can see
  // exactly what orchestrator complains about. Truncate to keep responses sane.
  let rawBody = "";
  try {
    rawBody = await res.text();
  } catch {
    rawBody = "";
  }
  if (!res.ok) {
    return {
      ok: false,
      error: "non_2xx",
      status: res.status,
      upstream_body: rawBody.slice(0, 800),
    };
  }
  let body: Partial<OrchestratorApprovalRecord> & {
    success?: boolean;
    error?: string;
  };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return { ok: false, error: "malformed_response", upstream_body: rawBody.slice(0, 800) };
  }
  if (typeof body.plan_id !== "string") {
    return {
      ok: false,
      error: body.error ?? "malformed_response",
      upstream_body: rawBody.slice(0, 800),
    };
  }
  return {
    ok: true,
    record: {
      approved: body.approved === true,
      plan_id: body.plan_id,
      scope: body.scope ?? null,
      expires_at: body.expires_at ?? null,
      approved_by: body.approved_by ?? approver,
      correlation_id: body.correlation_id ?? null,
    },
  };
}
