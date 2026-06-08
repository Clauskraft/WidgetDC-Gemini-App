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
  const base = process.env.WIDGETDC_BACKEND_URL ?? process.env.WIDGETDC_ORCHESTRATOR_URL;
  // Canonical WidgeTDC unified bearer is `WIDGETDC_BEARER_TOKEN`; `WIDGETDC_API_KEY`
  // and `MCP_AGENT_API_KEY` are legacy aliases kept for backward compatibility
  // (matches apps/backend/src/utils/serviceBearer.ts resolution order).
  const key =
    process.env.WIDGETDC_BEARER_TOKEN ??
    process.env.WIDGETDC_API_KEY ??
    process.env.MCP_AGENT_API_KEY;
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
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
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
  if (typeof inner.reasoning === "string" && inner.reasoning.trim())
    meta.reasoning = inner.reasoning.trim();
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
    if (typeof quality.reflection_attempted === "boolean")
      meta.reflectionAttempted = quality.reflection_attempted;
    if (typeof quality.reflection_kept === "boolean") meta.reflectionKept = quality.reflection_kept;
  }

  return { text: trimmed, meta };
}

/** A grounding snippet surfaced to the client for inline citations (AUR-2/14). */
export type RagSource = { text: string; source?: string; score?: number };

export type RagGrounding = {
  /** Compact context block injected into the system prompt. */
  context: string;
  /** Structured sources for the client's `data-sources` panel. */
  sources: RagSource[];
};

/**
 * AUR-14: NEXUS/graph grounding for a user query. Per WidgeTDC Rule R14 this
 * uses `srag.query` (hybrid semantic + graph) as the primary channel and falls
 * back to `rag_route` only if SRAG is unavailable. Returns a compact context
 * block plus structured sources, or null if the platform yields nothing.
 *
 * This is the function the chat handler MUST call before completion — without
 * it the chat answers ungrounded (the pre-AUR-14 defect: `fetchRagGrounding`
 * existed but was never invoked).
 */
export async function fetchRagGrounding(
  query: string,
  correlationId?: string,
): Promise<RagGrounding | null> {
  // Primary: srag.query hybrid (graph + vector). R14 hard-gate channel.
  const srag = await callMcpTool<unknown>(
    "srag.query",
    { query, mode: "hybrid" },
    { correlationId, timeoutMs: 8000 },
  );
  const fromSrag = extractSources(srag);
  if (fromSrag.length > 0) return packGrounding(fromSrag);

  // Fallback: adaptive rag_route.
  const rag = await callMcpTool<unknown>(
    "rag_route",
    { query, limit: 6 },
    { correlationId, timeoutMs: 6000 },
  );
  if (rag == null) return null;
  if (typeof rag === "string") {
    const text = rag.trim().slice(0, 4000);
    return text ? { context: text, sources: [{ text }] } : null;
  }
  const fromRag = extractSources(rag);
  if (fromRag.length > 0) return packGrounding(fromRag);
  try {
    const text = JSON.stringify(rag).slice(0, 4000);
    return { context: text, sources: [{ text }] };
  } catch {
    return null;
  }
}

/** Pull a best-effort list of {text, source} snippets from a varied envelope. */
function extractSources(result: unknown): RagSource[] {
  if (!result || typeof result !== "object") return [];
  const r = result as Record<string, unknown>;
  const inner = (r.result as Record<string, unknown>) ?? r;
  // Pick the first field that is actually an array. A non-array object here
  // (common across varied tool envelopes) would otherwise make the for-of below
  // throw "is not iterable".
  const candidates: unknown[] =
    [inner.results, inner.sources, inner.documents, inner.hits].find(Array.isArray) ?? [];
  const out: RagSource[] = [];
  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const text =
      (typeof o.text === "string" && o.text) ||
      (typeof o.content === "string" && o.content) ||
      (typeof o.snippet === "string" && o.snippet) ||
      (typeof o.answer === "string" && o.answer) ||
      "";
    if (!text.trim()) continue;
    out.push({
      text: text.trim().slice(0, 600),
      source:
        (typeof o.source === "string" && o.source) ||
        (typeof o.title === "string" && o.title) ||
        (typeof o.name === "string" && o.name) ||
        undefined,
      score: typeof o.score === "number" ? o.score : undefined,
    });
    if (out.length >= 6) break;
  }
  return out;
}

function packGrounding(sources: RagSource[]): RagGrounding {
  const context = sources
    .map((s, i) => `[${i + 1}]${s.source ? ` (${s.source})` : ""}: ${s.text}`)
    .join("\n");
  return { context: context.slice(0, 4000), sources };
}

/**
 * AUR-1 follow-up: streaming-friendly completion via the platform `llm_chat`
 * tool — the correct chat primitive (vs. `reason_deeply`, a reasoning tool).
 * `llm_chat` accepts a message array and honors model routing. Returns the
 * assistant text + light meta, or null on failure.
 */
export async function llmChatCompletion(
  messages: ChatMessage[],
  opts: { correlationId?: string; model?: string } = {},
): Promise<ChatResult | null> {
  const result = await callMcpTool<unknown>(
    "llm_chat",
    { messages, ...(opts.model ? { model: opts.model } : {}) },
    { correlationId: opts.correlationId, timeoutMs: 60000 },
  );
  if (result == null) return null;
  return extractChatResult(result);
}

/**
 * AUR-3/F3: model governance preflight. Best-effort — returns `{ allowed }`.
 * Never blocks on platform unavailability (null → allowed, fail-open for a
 * read-only chat; the real write-gate lives server-side on the platform).
 */
export async function modelPolicyPreflight(
  model: string,
  correlationId?: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const policy = await callMcpTool<Record<string, unknown>>(
    "model_policy_check",
    { model },
    { correlationId, timeoutMs: 5000 },
  );
  if (policy && policy.allowed === false) {
    return { allowed: false, reason: String(policy.reason ?? "model policy denied") };
  }
  return { allowed: true };
}

/** AUR-6: persist a chat insight to platform agent memory. Best-effort. */
export async function storeChatMemory(
  agentId: string,
  key: string,
  value: unknown,
  correlationId?: string,
): Promise<void> {
  await callMcpTool(
    "memory_store",
    { agent_id: agentId, key, value: typeof value === "string" ? value : JSON.stringify(value) },
    { correlationId, timeoutMs: 5000 },
  );
}

/** AUR-6: hydrate prior context from platform memory at session start. */
export async function retrieveChatMemory(
  query: string,
  correlationId?: string,
): Promise<string | null> {
  const result = await callMcpTool<unknown>(
    "memory_search",
    { query },
    { correlationId, timeoutMs: 5000 },
  );
  if (result == null) return null;
  if (typeof result === "string") return result.slice(0, 2000) || null;
  try {
    return JSON.stringify(result).slice(0, 2000);
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

// ───────────────────────────────────────────────────────────────────────────
// Deliverable Studio (Phase 1) — turn a chat brief into a consulting artifact.
// Surfaces the platform `assembly` tool family the frontend never used:
// `generate_deliverable` (RAG-backed, citation-bearing markdown) gated by an
// optional `judge_response` PRISM quality pass.
// ───────────────────────────────────────────────────────────────────────────

/** The three deliverable kinds the platform `generate_deliverable` accepts. */
export type DeliverableKind = "analysis" | "roadmap" | "assessment";

/** A generated deliverable: markdown body + citation count. */
export type DeliverableResult = { markdown: string; citations: number };

/** PRISM quality verdict (0–10 aggregate + per-dimension breakdown). */
export type DeliverableQuality = { score: number; dimensions?: Record<string, number> };

/**
 * Extract markdown + citation count from the varied `generate_deliverable`
 * response envelope. Pure + synchronous so it is unit-testable without a live
 * platform. Handles a bare string, a top-level object, and the standard
 * `{ result: {...} }` MCP envelope.
 */
export function extractDeliverable(result: unknown): DeliverableResult | null {
  if (typeof result === "string") {
    const md = result.trim();
    return md ? { markdown: md, citations: 0 } : null;
  }
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const inner = (r.result as Record<string, unknown>) ?? r;
  const md =
    (typeof inner.markdown === "string" && inner.markdown) ||
    (typeof inner.content === "string" && inner.content) ||
    (typeof inner.document === "string" && inner.document) ||
    (typeof inner.deliverable === "string" && inner.deliverable) ||
    (typeof inner.report === "string" && inner.report) ||
    (typeof inner.text === "string" && inner.text) ||
    (typeof r.markdown === "string" && r.markdown) ||
    "";
  const trimmed = typeof md === "string" ? md.trim() : "";
  if (!trimmed) return null;
  const citationsRaw = inner.citations ?? inner.sources ?? r.citations;
  const citations = Array.isArray(citationsRaw)
    ? citationsRaw.length
    : typeof inner.citation_count === "number"
      ? inner.citation_count
      : 0;
  return { markdown: trimmed, citations };
}

/**
 * Generate a consulting deliverable (analysis / roadmap / assessment) from a
 * brief via the platform `generate_deliverable` tool. RAG-backed and
 * multi-section, so the timeout is generous (>60s observed). Returns null on
 * any failure so the caller can surface a clean error.
 */
export async function generateDeliverable(
  brief: string,
  kind: DeliverableKind,
  opts: { correlationId?: string; maxSections?: number } = {},
): Promise<DeliverableResult | null> {
  const result = await callMcpTool<unknown>(
    "generate_deliverable",
    {
      prompt: brief,
      type: kind,
      format: "markdown",
      ...(opts.maxSections ? { max_sections: opts.maxSections } : {}),
    },
    { correlationId: opts.correlationId, timeoutMs: 120000 },
  );
  if (result == null) return null;
  return extractDeliverable(result);
}

/** Extract the PRISM aggregate + dimensions from a `judge_response` envelope. */
export function extractQuality(result: unknown): DeliverableQuality | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const inner = (r.result as Record<string, unknown>) ?? r;
  const score =
    (typeof inner.aggregate === "number" && inner.aggregate) ||
    (typeof inner.overall === "number" && inner.overall) ||
    (typeof inner.score === "number" && inner.score) ||
    null;
  if (score == null) return null;
  const dims =
    (inner.dimensions as Record<string, number> | undefined) ??
    (inner.scores as Record<string, number> | undefined);
  return { score, dimensions: dims };
}

/**
 * Phase-1 quality gate: PRISM-score a generated deliverable via the platform
 * `judge_response` tool. Best-effort — returns null if unavailable so the
 * deliverable still renders (plan acceptance gate target: PRISM ≥ 7).
 */
export async function judgeDeliverable(
  brief: string,
  markdown: string,
  correlationId?: string,
): Promise<DeliverableQuality | null> {
  const result = await callMcpTool<unknown>(
    "judge_response",
    { query: brief, response: markdown },
    { correlationId, timeoutMs: 30000 },
  );
  if (result == null) return null;
  return extractQuality(result);
}
