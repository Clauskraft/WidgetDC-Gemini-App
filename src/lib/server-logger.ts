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

export function logServer(
  level: ServerLogLevel,
  fields: ServerLogFields,
  error?: unknown,
): void {
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
}

async function persistLogEntry(
  level: ServerLogLevel,
  fields: ServerLogFields,
  entry: Record<string, unknown>,
): Promise<void> {
  try {
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


export function newRequestId(): string {
  // Cheap, dependency-free id (not cryptographic — just for log correlation).
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function summarizeError(err: unknown): { message: string; name: string } {
  if (err instanceof Error) return { message: err.message || "Unknown error", name: err.name };
  return { message: typeof err === "string" ? err : "Unknown SSR error", name: "Error" };
}
