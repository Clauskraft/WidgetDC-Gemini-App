/**
 * Server-only adoption-dashboard data helpers (B19 — LIN-1915 runtime adoption surface).
 *
 * Each helper queries ONE live MCP tool (or `/health`) on backend-production
 * and returns a discriminated union: `{ ok: true, data, fetchedAt }` on
 * success, `{ ok: false, error, fetchedAt }` on failure. Helpers NEVER throw
 * — UI renders error state per-card so one degraded source doesn't blank the
 * dashboard.
 *
 * Data sources (per B19 spec — runtime only, no docs):
 *   1. audit.adoption_metrics       → DAU/WAU/activation/funnel/topTools
 *   2. intent.stats                 → tool count, pattern count, avg confidence
 *   3. audit.enforce                → enforcement run + violations (24h)
 *   4. wonder.a2a.reconcile         → A2A bridge status
 *   5. wonder.status                → runtime status + a2a health
 *   6. GET /health                  → deployed commit_sha + short_commit_sha
 *
 * These are the new adoption-event surfaces unlocked by B18 (PR #6137)
 * — the dashboard visualizes the same events the backend now emits.
 */
import process from "node:process";
import { callMcpTool } from "./widgetdc.server";

const HEALTH_TIMEOUT_MS = 5000;

export type Ok<T> = { ok: true; data: T; fetchedAt: string };
export type Err = { ok: false; error: string; status?: number; fetchedAt: string };
export type Result<T> = Ok<T> | Err;

function nowIso(): string {
  return new Date().toISOString();
}

function ok<T>(data: T): Ok<T> {
  return { ok: true, data, fetchedAt: nowIso() };
}

function err(error: string, status?: number): Err {
  return { ok: false, error, status, fetchedAt: nowIso() };
}

// ── 1. audit.adoption_metrics ──────────────────────────────────────────────

export interface AdoptionFunnel {
  aware: number;
  onboarded: number;
  activated: number;
  regular: number;
  power: number;
}

export interface TopToolEntry {
  name: string;
  count: number;
}

export interface AdoptionMetrics {
  dau: number;
  wau: number;
  activationRate: number;
  featureCoverage: number;
  adoptionFunnel: AdoptionFunnel;
  topTools: TopToolEntry[];
  raw?: unknown;
}

function pickNumber(o: Record<string, unknown> | undefined, ...keys: string[]): number {
  if (!o) return 0;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "bigint") {
      const asNumber = Number(v);
      if (Number.isFinite(asNumber)) return asNumber;
    }
    if (typeof v === "string" && v.trim()) {
      const parsed = Number(v);
      if (Number.isFinite(parsed)) return parsed;
    }
    if (v && typeof v === "object") {
      const neo = v as Record<string, unknown>;
      const low = typeof neo.low === "number" ? neo.low : null;
      const high = typeof neo.high === "number" ? neo.high : null;
      if (low != null && high != null) return high * 0x100000000 + low;
      if (low != null) return low;
    }
  }
  return 0;
}

function pickFunnel(value: unknown): AdoptionFunnel {
  const o = (value as Record<string, unknown>) ?? {};
  return {
    aware: pickNumber(o, "aware"),
    onboarded: pickNumber(o, "onboarded"),
    activated: pickNumber(o, "activated"),
    regular: pickNumber(o, "regular"),
    power: pickNumber(o, "power"),
  };
}

function pickTopTools(value: unknown): TopToolEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): TopToolEntry | null => {
      if (entry && typeof entry === "object") {
        const e = entry as Record<string, unknown>;
        const name =
          (typeof e.name === "string" && e.name) ||
          (typeof e.tool === "string" && e.tool) ||
          (typeof e.tool_name === "string" && e.tool_name) ||
          "";
        const count = pickNumber(e, "count", "calls", "invocations", "n");
        if (!name) return null;
        return { name, count };
      }
      return null;
    })
    .filter((x): x is TopToolEntry => x !== null)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export async function getAdoptionMetrics(): Promise<Result<AdoptionMetrics>> {
  const raw = await callMcpTool<unknown>("audit.adoption_metrics", {}, { timeoutMs: 10000 });
  if (raw == null) return err("network_or_auth_error");
  const r = (raw as Record<string, unknown>) ?? {};
  // Tool envelope may be flat OR { success, result/data: {...} }.
  const inner =
    (r.result as Record<string, unknown> | undefined) ??
    (r.data as Record<string, unknown> | undefined) ??
    r;
  if (typeof inner !== "object" || inner === null) {
    return err("malformed_response");
  }
  return ok<AdoptionMetrics>({
    dau: pickNumber(inner, "dau", "DAU", "daily_active_users"),
    wau: pickNumber(inner, "wau", "WAU", "weekly_active_users"),
    activationRate: pickNumber(inner, "activationRate", "activation_rate"),
    featureCoverage: pickNumber(inner, "featureCoverage", "feature_coverage"),
    adoptionFunnel: pickFunnel(inner.adoptionFunnel ?? inner.adoption_funnel ?? inner.funnel),
    topTools: pickTopTools(inner.topTools ?? inner.top_tools ?? inner.tools),
    raw: inner,
  });
}

// ── 2. intent.stats ────────────────────────────────────────────────────────

export interface IntentStats {
  toolCount: number;
  patternCount: number;
  edgeCount: number;
  avgConfidence: number;
  raw?: unknown;
}

export async function getIntentStats(): Promise<Result<IntentStats>> {
  const raw = await callMcpTool<unknown>("intent.stats", {}, { timeoutMs: 10000 });
  if (raw == null) return err("network_or_auth_error");
  const r = (raw as Record<string, unknown>) ?? {};
  const inner =
    (r.result as Record<string, unknown> | undefined) ??
    (r.data as Record<string, unknown> | undefined) ??
    r;
  if (typeof inner !== "object" || inner === null) {
    return err("malformed_response");
  }
  return ok<IntentStats>({
    toolCount: pickNumber(inner, "toolCount", "tool_count", "tools"),
    patternCount: pickNumber(inner, "patternCount", "pattern_count", "patterns"),
    edgeCount: pickNumber(inner, "edgeCount", "edge_count", "edges"),
    avgConfidence: pickNumber(inner, "avgConfidence", "avg_confidence", "average_confidence"),
    raw: inner,
  });
}

// ── 3. audit.enforce ───────────────────────────────────────────────────────

export interface EnforcementSnapshot {
  enforced: boolean;
  violations24h: number;
  totalChecks: number;
  raw?: unknown;
}

export async function getEnforcement(): Promise<Result<EnforcementSnapshot>> {
  // audit.enforce executes an enforcement pass; we ask for the last-24h window.
  const raw = await callMcpTool<unknown>(
    "audit.enforce",
    { window: "24h", dryRun: true },
    { timeoutMs: 10000 },
  );
  if (raw == null) return err("network_or_auth_error");
  const r = (raw as Record<string, unknown>) ?? {};
  const inner =
    (r.result as Record<string, unknown> | undefined) ??
    (r.data as Record<string, unknown> | undefined) ??
    r;
  if (typeof inner !== "object" || inner === null) {
    return err("malformed_response");
  }
  const enforcedRaw = inner.enforced ?? inner.success ?? r.success;
  return ok<EnforcementSnapshot>({
    enforced: enforcedRaw === true,
    violations24h: pickNumber(inner, "violations24h", "violations_24h", "violations"),
    totalChecks: pickNumber(inner, "totalChecks", "total_checks", "checks"),
    raw: inner,
  });
}

// ── 4. wonder.a2a.reconcile ────────────────────────────────────────────────

export interface A2AReconcile {
  status: "OK" | "DEGRADED" | "BLOCKED" | "UNKNOWN";
  detail?: string;
  raw?: unknown;
}

function normalizeA2aStatus(value: unknown): A2AReconcile["status"] {
  if (value === true) return "OK";
  if (typeof value !== "string") return "UNKNOWN";
  const v = value.toUpperCase();
  if (
    v.includes("OK") ||
    v.includes("CLEAR") ||
    v === "HEALTHY" ||
    v === "GREEN" ||
    v === "COMPLETED" ||
    v === "COMPLETE"
  )
    return "OK";
  if (v.includes("DEGRAD") || v === "YELLOW" || v === "WARN") return "DEGRADED";
  if (v.includes("BLOCK") || v === "RED" || v === "ERROR" || v === "FAIL") return "BLOCKED";
  return "UNKNOWN";
}

export async function getA2AReconcile(): Promise<Result<A2AReconcile>> {
  const raw = await callMcpTool<unknown>("wonder.a2a.reconcile", {}, { timeoutMs: 10000 });
  if (raw == null) return err("network_or_auth_error");
  const r = (raw as Record<string, unknown>) ?? {};
  const inner =
    (r.result as Record<string, unknown> | undefined) ??
    (r.data as Record<string, unknown> | undefined) ??
    r;
  if (typeof inner !== "object" || inner === null) {
    return err("malformed_response");
  }
  const statusRaw =
    inner.status ??
    inner.state ??
    inner.health ??
    inner.verdict ??
    (inner.success === true || inner.ok === true ? true : undefined);
  const detail =
    (typeof inner.detail === "string" && inner.detail) ||
    (typeof inner.summary === "string" && inner.summary) ||
    undefined;
  return ok<A2AReconcile>({
    status: normalizeA2aStatus(statusRaw),
    detail,
    raw: inner,
  });
}

// ── 5. wonder.status ───────────────────────────────────────────────────────

export interface WonderStatus {
  status: "OK" | "DEGRADED" | "BLOCKED" | "UNKNOWN";
  a2aBridge: "OK" | "DEGRADED" | "BLOCKED" | "UNKNOWN";
  detail?: string;
  raw?: unknown;
}

export async function getWonderStatus(): Promise<Result<WonderStatus>> {
  const raw = await callMcpTool<unknown>("wonder.status", {}, { timeoutMs: 10000 });
  if (raw == null) return err("network_or_auth_error");
  const r = (raw as Record<string, unknown>) ?? {};
  const inner =
    (r.result as Record<string, unknown> | undefined) ??
    (r.data as Record<string, unknown> | undefined) ??
    r;
  if (typeof inner !== "object" || inner === null) {
    return err("malformed_response");
  }
  const bridge =
    (inner.a2a_bridge as Record<string, unknown> | undefined) ??
    (inner.a2aBridge as Record<string, unknown> | undefined) ??
    (inner.bridge as Record<string, unknown> | undefined);
  const result = inner.result as Record<string, unknown> | undefined;
  const nestedA2a =
    (inner.a2a_result as Record<string, unknown> | undefined) ??
    (result?.a2a_result as Record<string, unknown> | undefined);
  const nestedStatus = nestedA2a?.status as Record<string, unknown> | undefined;
  return ok<WonderStatus>({
    status: normalizeA2aStatus(
      inner.status ?? inner.state ?? inner.verdict ?? (inner.success === true ? true : undefined),
    ),
    a2aBridge: normalizeA2aStatus(
      (bridge && (bridge.status ?? bridge.state ?? bridge.health)) ??
        inner.a2a_status ??
        nestedStatus?.state ??
        (nestedA2a?.success === true ? true : undefined),
    ),
    detail:
      (typeof inner.summary === "string" && inner.summary) ||
      (typeof inner.detail === "string" && inner.detail) ||
      undefined,
    raw: inner,
  });
}

// ── 6. GET /health (deployed SHA) ──────────────────────────────────────────

export interface DeployedHealth {
  status: string;
  commitSha: string | null;
  shortCommitSha: string | null;
  raw?: unknown;
}

function backendHealthUrl(): string | null {
  const base = process.env.WIDGETDC_BACKEND_URL ?? process.env.WIDGETDC_ORCHESTRATOR_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/health`;
}

export async function getDeployedHealth(): Promise<Result<DeployedHealth>> {
  const url = backendHealthUrl();
  if (!url) return err("backend_not_configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return err("non_2xx", res.status);
    const body = (await res.json()) as Record<string, unknown>;
    if (typeof body !== "object" || body === null) return err("malformed_response");
    const commitSha =
      (typeof body.commit_sha === "string" && body.commit_sha) ||
      (typeof body.commitSha === "string" && body.commitSha) ||
      null;
    const shortCommitSha =
      (typeof body.short_commit_sha === "string" && body.short_commit_sha) ||
      (typeof body.shortCommitSha === "string" && body.shortCommitSha) ||
      (commitSha ? commitSha.slice(0, 7) : null);
    return ok<DeployedHealth>({
      status: typeof body.status === "string" ? body.status : "unknown",
      commitSha,
      shortCommitSha,
      raw: body,
    });
  } catch {
    return err("network_error");
  } finally {
    clearTimeout(timer);
  }
}

// ── Aggregate (used by server route) ───────────────────────────────────────

export interface AdoptionDashboardSnapshot {
  deployedHealth: Result<DeployedHealth>;
  adoptionMetrics: Result<AdoptionMetrics>;
  intentStats: Result<IntentStats>;
  enforcement: Result<EnforcementSnapshot>;
  a2aReconcile: Result<A2AReconcile>;
  wonderStatus: Result<WonderStatus>;
  generatedAt: string;
}

/**
 * Fetch all six sources in parallel. Uses `Promise.allSettled` semantics
 * implicitly — each helper already returns Result so we Promise.all over them
 * without ever rejecting, and one degraded source never blocks the others.
 */
export async function getAdoptionDashboardSnapshot(): Promise<AdoptionDashboardSnapshot> {
  const [deployedHealth, adoptionMetrics, intentStats, enforcement, a2aReconcile, wonderStatus] =
    await Promise.all([
      getDeployedHealth(),
      getAdoptionMetrics(),
      getIntentStats(),
      getEnforcement(),
      getA2AReconcile(),
      getWonderStatus(),
    ]);
  return {
    deployedHealth,
    adoptionMetrics,
    intentStats,
    enforcement,
    a2aReconcile,
    wonderStatus,
    generatedAt: nowIso(),
  };
}
