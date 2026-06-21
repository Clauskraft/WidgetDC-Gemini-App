// Structured server-side logger. Emits a single JSON line per event so logs
// are grep-able in worker output and survive h3's error swallowing.

export type ServerLogLevel = "info" | "warn" | "error";

export interface ServerLogFields {
  event: string;
  requestId?: string;
  method?: string;
  url?: string;
  status?: number;
  durationMs?: number;
  /** Mark a non-error event as audit-worthy so it is forwarded to the platform EventSpine (AUR-12). */
  audit?: boolean;
  [key: string]: unknown;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(err.cause ? { cause: serializeError(err.cause) } : {}),
    };
  }
  if (typeof err === "object" && err !== null) {
    try {
      return { value: JSON.parse(JSON.stringify(err)) };
    } catch {
      return { value: String(err) };
    }
  }
  return { value: String(err) };
}

export function logServer(level: ServerLogLevel, fields: ServerLogFields, error?: unknown): void {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    ...fields,
  };
  if (error !== undefined) entry.error = serializeError(error);
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Best-effort durable persistence so logs are queryable by requestId.
  void persistLogEntry(level, fields, entry);

  // AUR-12: best-effort forward error/audit events to the platform EventSpine so
  // governance can correlate frontend failures with backend chains. Opt-in and
  // fire-and-forget — never blocks or breaks the request path.
  forwardLogToPlatform(level, fields, entry);
}

async function persistLogEntry(
  level: ServerLogLevel,
  fields: ServerLogFields,
  entry: Record<string, unknown>,
): Promise<void> {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("server_logs").insert({
      request_id: fields.requestId ?? "unknown",
      level,
      event: fields.event,
      payload: entry as never,
    });
    // Probabilistic retention prune (~1% of writes) — keeps last 7 days.
    if (Math.random() < 0.01) {
      await supabaseAdmin.rpc("prune_server_logs", { retention_days: 7 });
    }
  } catch {
    // Never let logging failure break the request path.
  }
}

// ───────────────────────────────────────────────────────────────────────────
// AUR-12 — platform EventSpine forwarding.
//
// Ships error-level and explicit audit events to the WidgeTDC platform so
// `governance_audit_query` / `eventspine_replay` can correlate frontend
// failures with backend chains. Implemented as a raw fetch (NOT via
// `callMcpTool`) on purpose: `callMcpTool` itself calls `logServer` on failure,
// which would recurse. This forwarder never calls `logServer` — any failure is
// swallowed silently. Opt-in via `WIDGETDC_LOG_FORWARD=1`, so production
// behaviour is unchanged until explicitly enabled.
// ───────────────────────────────────────────────────────────────────────────

const LOG_FORWARD_TIMEOUT_MS = 4000;

function logForwardingEnabled(env: NodeJS.ProcessEnv): boolean {
  return /^(1|true|yes)$/i.test(env.WIDGETDC_LOG_FORWARD ?? "");
}

function platformLogSink(env: NodeJS.ProcessEnv): { url: string; key: string } | null {
  const base = (env.WIDGETDC_BACKEND_URL || env.WIDGETDC_ORCHESTRATOR_URL || "").replace(
    /\/+$/,
    "",
  );
  const key =
    env.WIDGETDC_BEARER_TOKEN ??
    env.WIDGETDC_API_KEY ??
    env.MCP_AGENT_API_KEY ??
    env.WIDGETDC_ORCHESTRATOR_API_KEY ??
    env.ORCHESTRATOR_API_KEY;
  if (!base || !key) return null;
  return { url: `${base}/api/mcp/route`, key };
}

/**
 * Forward an error/audit log event to the platform EventSpine. Best-effort,
 * fire-and-forget, recursion-safe (no `logServer` calls inside). Exported for
 * unit testing; callers should use `logServer`.
 */
export function forwardLogToPlatform(
  level: ServerLogLevel,
  fields: ServerLogFields,
  entry: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env,
): void {
  // Only ship failures and explicitly-flagged audit events. info/warn stay local.
  if (level !== "error" && fields.audit !== true) return;
  if (!logForwardingEnabled(env)) return;
  const sink = platformLogSink(env);
  if (!sink) return;

  // Mirror the EventSpine envelope used by governance.emit_spine_event so the
  // sink tool is deployment-configurable but defaults to the known ingest path.
  const tool = env.WIDGETDC_LOG_SINK_TOOL?.trim() || "governance.emit_spine_event";
  const correlationId = typeof fields.requestId === "string" ? fields.requestId : undefined;
  const body = JSON.stringify({
    tool,
    payload: {
      event_type: level === "error" ? "tool_failed" : "audit_event",
      source: "widgetdc-gemini-frontend",
      correlation_id: correlationId,
      tenant_id: "tenant:widgetdc-internal",
      outcome: level === "error" ? "failure" : "info",
      payload: {
        logical_event_type: fields.event,
        level,
        method: fields.method,
        url: fields.url,
        status: fields.status,
        duration_ms: fields.durationMs,
        ...(entry.error ? { error: entry.error } : {}),
      },
    },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOG_FORWARD_TIMEOUT_MS);
  // NEVER await and NEVER log here — a forwarding failure must stay silent.
  void fetch(sink.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${sink.key}`,
      ...(correlationId ? { "x-correlation-id": correlationId } : {}),
    },
    body,
    signal: controller.signal,
  })
    .catch(() => {})
    .finally(() => clearTimeout(timer));
}

export function newRequestId(): string {
  // Cheap, dependency-free id (not cryptographic — just for log correlation).
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function summarizeError(err: unknown): { message: string; name: string } {
  if (err instanceof Error) return { message: err.message || "Unknown error", name: err.name };
  return { message: typeof err === "string" ? err : "Unknown SSR error", name: "Error" };
}
