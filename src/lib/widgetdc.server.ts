/**
 * Server-only WidgeTDC orchestrator MCP client (AUR-1).
 *
 * Wire-contract (from platform RAG/knowledge): POST {base}/api/mcp/route with
 * body `{ tool, payload }` and `Authorization: Bearer <WIDGETDC_API_KEY>`.
 *
 * `.server.ts` keeps this out of the client bundle. Every helper degrades
 * gracefully: if the key/URL is missing or the platform is unreachable, it
 * returns null so callers can surface a clean error — the app never crashes
 * just because the platform is momentarily unreachable (MoA resilience finding).
 */
import process from "node:process";

const DEFAULT_TIMEOUT_MS = 8000;

function mcpConfig(): { url: string; key: string } | null {
  const base =
    process.env.WIDGETDC_BACKEND_URL ?? process.env.WIDGETDC_ORCHESTRATOR_URL;
  const key = process.env.WIDGETDC_API_KEY ?? process.env.MCP_AGENT_API_KEY;
  if (!base || !key) return null;
  return { url: `${base.replace(/\/+$/, "")}/api/mcp/route`, key };
}

export function isPlatformConfigured(): boolean {
  return mcpConfig() !== null;
}

/**
 * Call a WidgeTDC MCP tool. Returns the parsed JSON result, or null on any
 * failure (missing config, network error, non-2xx, timeout).
 */
export async function callMcpTool<T = unknown>(
  tool: string,
  payload: Record<string, unknown>,
  opts: { timeoutMs?: number; correlationId?: string } = {},
): Promise<T | null> {
  const cfg = mcpConfig();
  if (!cfg) return null;

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.key}`,
        ...(opts.correlationId ? { "x-correlation-id": opts.correlationId } : {}),
      },
      body: JSON.stringify({ tool, payload }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Rich metadata returned by the platform RLM alongside the assistant text.
 * Exposed to the client (AUR-5 deep-reasoning mode) so the UI can render the
 * reasoning chain, confidence, and provider as pinnable Canvas notes.
 */
export type ChatReasoningMeta = {
  confidence?: number;
  reasoning?: string;
  reasoningChain?: string[];
  provider?: string;
  model?: string;
  domain?: string;
  latencyMs?: number;
  qualityScore?: number;
  reflectionAttempted?: boolean;
  reflectionKept?: boolean;
};

export type ChatResult = {
  text: string;
  meta: ChatReasoningMeta;
};

/**
 * Run a chat turn through the WidgeTDC backend `reason_deeply` (RLM) tool —
 * the LLM surface this backend MCP route (`/api/mcp/route`) actually exposes.
 * Provider/model is platform-routed (RLM picks gemini/deepseek/claude per
 * domain). Returns the assistant text plus rich reasoning metadata, or null
 * on any failure.
 *
 * The full prior conversation is flattened into the `task` string so the RLM
 * has context (this tool is single-shot, not message-array based).
 *
 * `mode: "reason"` (default) runs the standard pass; pass `deep: true` to ask
 * the RLM to attempt reflection (AUR-5 "Reason deeply" toggle) — this triples
 * the rendered metadata's value without changing the wire contract.
 */
export async function orchestratorChat(
  messages: ChatMessage[],
  opts: { correlationId?: string; deep?: boolean } = {},
): Promise<ChatResult | null> {
  const task = messages
    .map((m) => {
      const who =
        m.role === "system" ? "INSTRUCTIONS" : m.role === "assistant" ? "ASSISTANT" : "USER";
      return `${who}:\n${m.content}`;
    })
    .join("\n\n");

  // The platform RLM occasionally returns a transient 5xx; retry once before
  // giving up so a single flaky moment doesn't surface as a hard error.
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await callMcpTool<unknown>(
      "reason_deeply",
      {
        task,
        mode: "reason",
        ...(opts.deep ? { reflect: true } : {}),
      },
      { correlationId: opts.correlationId, timeoutMs: 90000 },
    );
    if (result != null) {
      const extracted = extractChatResult(result);
      if (extracted?.text) return extracted;
    }
  }
  return null;
}

/**
 * Extract assistant text + reasoning metadata from the reason_deeply / RLM
 * response envelope. The text is the recommendation (the standalone answer);
 * the reasoning chain, confidence, and routing are surfaced separately so
 * the UI can render them as deep-reasoning Canvas notes (AUR-5).
 */
function extractChatResult(result: unknown): ChatResult | null {
  if (typeof result === "string") {
    const t = result.trim();
    return t ? { text: t, meta: {} } : null;
  }
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  // reason_deeply shape: { success, result: { recommendation, reasoning, confidence, reasoning_chain, quality, routing } }
  const inner = (r.result as Record<string, unknown>) ?? r;

  const text =
    (typeof inner.recommendation === "string" && inner.recommendation) ||
    (typeof inner.answer === "string" && inner.answer) ||
    (typeof inner.text === "string" && inner.text) ||
    (typeof inner.response === "string" && inner.response) ||
    (typeof r.recommendation === "string" && r.recommendation) ||
    (typeof r.text === "string" && r.text) ||
    "";
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return null;

  const meta: ChatReasoningMeta = {};
  if (typeof inner.confidence === "number") meta.confidence = inner.confidence;
  if (typeof inner.reasoning === "string" && inner.reasoning.trim()) meta.reasoning = inner.reasoning.trim();
  if (Array.isArray(inner.reasoning_chain)) {
    meta.reasoningChain = (inner.reasoning_chain as unknown[])
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, 20);
  }
  const routing = inner.routing as Record<string, unknown> | undefined;
  if (routing) {
    if (typeof routing.provider === "string") meta.provider = routing.provider;
    if (typeof routing.model === "string") meta.model = routing.model;
    if (typeof routing.domain === "string") meta.domain = routing.domain;
    if (typeof routing.latency_ms === "number") meta.latencyMs = routing.latency_ms;
  }
  const quality = inner.quality as Record<string, unknown> | undefined;
  if (quality) {
    if (typeof quality.overall_score === "number") meta.qualityScore = quality.overall_score;
    if (typeof quality.reflection_attempted === "boolean") meta.reflectionAttempted = quality.reflection_attempted;
    if (typeof quality.reflection_kept === "boolean") meta.reflectionKept = quality.reflection_kept;
  }

  return { text: trimmed, meta };
}

/**
 * Fetch RAG grounding for a user query via the orchestrator's adaptive RAG
 * route. Returns a compact, newline-joined snippet string for injection into
 * the system prompt, or null if unavailable.
 */
export async function fetchRagGrounding(
  query: string,
  correlationId?: string,
): Promise<string | null> {
  const result = await callMcpTool<unknown>(
    "rag_route",
    { query, limit: 6 },
    { correlationId, timeoutMs: 6000 },
  );
  if (result == null) return null;

  // The orchestrator returns either structured results or a markdown string.
  if (typeof result === "string") {
    return result.trim().slice(0, 4000) || null;
  }
  try {
    const text = JSON.stringify(result);
    return text.slice(0, 4000);
  } catch {
    return null;
  }
}

/** Normalize Neo4j integer objects ({low,high}) to plain numbers, recursively. */
function normalizeNeo(value: unknown): unknown {
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.low === "number" && typeof o.high === "number" && Object.keys(o).length === 2) {
      return o.high * 0x100000000 + o.low;
    }
    if (Array.isArray(value)) return value.map(normalizeNeo);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) out[k] = normalizeNeo(o[k]);
    return out;
  }
  return value;
}

/**
 * Run a read-only Cypher query via the platform `data_graph_read` tool (AUR-2).
 * Callers MUST pass a vetted, parameterized read query — never raw client input
 * (governance: read-only from the browser). Returns normalized rows, or null.
 */
export async function queryGraph(
  cypher: string,
  correlationId?: string,
): Promise<Array<Record<string, unknown>> | null> {
  const result = await callMcpTool<unknown>(
    "data_graph_read",
    { query: cypher },
    { correlationId, timeoutMs: 15000 },
  );
  if (result == null) return null;
  // data_graph_read shape: { success, results: [...], count } (sometimes nested
  // under result). Unwrap, then normalize Neo4j ints.
  const r = (result as Record<string, unknown>) ?? {};
  const inner = (r.result as Record<string, unknown>) ?? r;
  let rows: unknown = inner.results ?? inner.rows ?? inner.records ?? inner.data;
  if (!Array.isArray(rows) && Array.isArray(result)) rows = result;
  if (!Array.isArray(rows)) return null;
  return (normalizeNeo(rows) as Array<Record<string, unknown>>) ?? null;
}
