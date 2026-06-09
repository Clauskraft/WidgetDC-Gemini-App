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
import { logServer } from "./server-logger";

const DEFAULT_TIMEOUT_MS = 8000;

const ORCHESTRATOR_TOOL_NAMES = new Set([
  "generate_deliverable",
  "deliverable_draft",
  "produce_document",
  "judge_response",
  "context_fold",
]);

type McpRouteConfig = { url: string; key: string; target: "backend" | "orchestrator" };

export function resolveMcpRoute(
  tool: string,
  env: NodeJS.ProcessEnv = process.env,
): McpRouteConfig | null {
  const wantsOrchestrator = ORCHESTRATOR_TOOL_NAMES.has(tool);
  const orchestratorBase = env.WIDGETDC_ORCHESTRATOR_URL;
  const backendBase = env.WIDGETDC_BACKEND_URL;
  const base = wantsOrchestrator
    ? (orchestratorBase ?? backendBase)
    : (backendBase ?? orchestratorBase);
  const target = wantsOrchestrator && orchestratorBase ? "orchestrator" : "backend";
  // Canonical WidgeTDC unified bearer is `WIDGETDC_BEARER_TOKEN`; `WIDGETDC_API_KEY`
  // and `MCP_AGENT_API_KEY` are legacy aliases kept for backward compatibility
  // (matches apps/backend/src/utils/serviceBearer.ts resolution order).
  const key =
    target === "orchestrator"
      ? (env.WIDGETDC_ORCHESTRATOR_API_KEY ??
        env.ORCHESTRATOR_API_KEY ??
        env.WIDGETDC_BEARER_TOKEN ??
        env.WIDGETDC_API_KEY ??
        env.MCP_AGENT_API_KEY)
      : (env.WIDGETDC_BEARER_TOKEN ??
        env.WIDGETDC_API_KEY ??
        env.MCP_AGENT_API_KEY ??
        env.WIDGETDC_ORCHESTRATOR_API_KEY ??
        env.ORCHESTRATOR_API_KEY);
  if (!base || !key) return null;
  return { url: `${base.replace(/\/+$/, "")}/api/mcp/route`, key, target };
}

export function isPlatformConfigured(): boolean {
  return (
    resolveMcpRoute("reason_deeply") !== null || resolveMcpRoute("generate_deliverable") !== null
  );
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
  const cfg = resolveMcpRoute(tool);
  if (!cfg) {
    logServer("warn", {
      event: "mcp_tool_not_configured",
      requestId: opts.correlationId,
      tool,
    });
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const started = Date.now();
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
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logServer(res.status >= 500 ? "error" : "warn", {
        event: "mcp_tool_non_2xx",
        requestId: opts.correlationId,
        tool,
        endpoint: cfg.target,
        status: res.status,
        durationMs: Date.now() - started,
        message: summarizeMcpFailure(body),
      });
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    logServer(
      "error",
      {
        event: "mcp_tool_request_failed",
        requestId: opts.correlationId,
        tool,
        endpoint: cfg.target,
        durationMs: Date.now() - started,
      },
      error,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function summarizeMcpFailure(body: string): string {
  if (!body) return "empty error body";
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const error = parsed.error;
    if (typeof error === "string") return error.slice(0, 240);
    if (error && typeof error === "object") {
      const e = error as Record<string, unknown>;
      const message = typeof e.message === "string" ? e.message : JSON.stringify(e);
      return message.slice(0, 240);
    }
    return JSON.stringify(parsed).slice(0, 240);
  } catch {
    return body.slice(0, 240);
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

/** Flatten a conversation into a single task string for single-shot tools. */
function flattenConversation(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      const who =
        m.role === "system" ? "INSTRUCTIONS" : m.role === "assistant" ? "ASSISTANT" : "USER";
      return `${who}:\n${m.content}`;
    })
    .join("\n\n");
}

/**
 * Phase 4 "Council" mode: answer via the platform `moa_query` (Mixture-of-Agents)
 * tool — classifies complexity, dispatches 2–3 specialist agents in parallel and
 * merges them by LLM consensus. Returns the merged answer plus light meta
 * (participating agents + confidence), or null on failure.
 */
export async function councilChat(
  messages: ChatMessage[],
  opts: { correlationId?: string } = {},
): Promise<ChatResult | null> {
  const result = await callMcpTool<unknown>(
    "moa_query",
    { query: flattenConversation(messages) },
    { correlationId: opts.correlationId, timeoutMs: 90000 },
  );
  if (result == null) return null;
  return extractCouncilResult(result);
}

/** Extract the merged answer + agent/confidence meta from a moa_query envelope. */
export function extractCouncilResult(result: unknown): ChatResult | null {
  if (typeof result === "string") {
    const t = result.trim();
    return t ? { text: t, meta: { provider: "MoA Council" } } : null;
  }
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const inner = (r.result as Record<string, unknown>) ?? r;
  const text =
    (typeof inner.merged === "string" && inner.merged) ||
    (typeof inner.answer === "string" && inner.answer) ||
    (typeof inner.response === "string" && inner.response) ||
    (typeof inner.recommendation === "string" && inner.recommendation) ||
    (typeof inner.text === "string" && inner.text) ||
    "";
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return null;
  const meta: ChatReasoningMeta = { provider: "MoA Council" };
  const agents = inner.agents;
  if (Array.isArray(agents) && agents.length > 0) {
    const names = agents
      .map((a) => (typeof a === "string" ? a : ((a as Record<string, unknown>)?.id ?? "")))
      .filter((s): s is string => typeof s === "string" && s.length > 0);
    if (names.length > 0) meta.model = names.join(", ");
  }
  if (typeof inner.confidence === "number") meta.confidence = inner.confidence;
  const domains = inner.domains;
  if (Array.isArray(domains) && domains.length > 0) {
    meta.domain = domains.filter((d): d is string => typeof d === "string").join(", ");
  }
  return { text: trimmed, meta };
}

/**
 * Extract assistant text + reasoning metadata from the reason_deeply / RLM
 * response envelope. The text is the recommendation (the standalone answer);
 * the reasoning chain, confidence, and routing are surfaced separately so
 * the UI can render them as deep-reasoning Canvas notes (AUR-5).
 */
export function extractChatResult(result: unknown): ChatResult | null {
  if (typeof result === "string") {
    const t = result.trim();
    return t ? { text: t, meta: {} } : null;
  }
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  // Two distinct envelopes flow through here:
  //  - llm_chat:      { provider, model, content, usage }      → answer in `content`
  //  - reason_deeply: { result: { recommendation, reasoning, … } } → answer in `recommendation`
  // `content` MUST be checked (previously it wasn't, so every llm_chat reply
  // extracted to null and silently fell back to reason_deeply's short summary —
  // the root cause of 5-line answers + the double provider call).
  const inner = (r.result as Record<string, unknown>) ?? r;

  const text =
    (typeof inner.content === "string" && inner.content) ||
    (typeof inner.recommendation === "string" && inner.recommendation) ||
    (typeof inner.answer === "string" && inner.answer) ||
    (typeof inner.text === "string" && inner.text) ||
    (typeof inner.response === "string" && inner.response) ||
    (typeof inner.message === "string" && inner.message) ||
    (typeof r.content === "string" && r.content) ||
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
 * Map a UI model id (`vendor/model`) to an `llm_chat` provider + bare model.
 * `llm_chat` REQUIRES a `provider` (deepseek|qwen|openai|gemini|claude); unknown
 * or platform models route to gemini (the platform's healthy default).
 */
export function llmChatProvider(model?: string): { provider: string; model?: string } {
  if (!model) return { provider: "gemini" };
  const slash = model.indexOf("/");
  const vendor = slash >= 0 ? model.slice(0, slash) : model;
  const bare = slash >= 0 ? model.slice(slash + 1) : undefined;
  switch (vendor) {
    case "openai":
      return { provider: "openai", model: bare };
    case "google":
      return { provider: "gemini", model: bare };
    case "anthropic":
      return { provider: "claude", model: bare };
    default:
      return { provider: "gemini" };
  }
}

/**
 * Completion via the platform `llm_chat` tool — the correct chat primitive (vs.
 * `reason_deeply`, a reasoning tool). Passes the required `provider` (derived
 * from the model id) and a generous `max_tokens` so answers are full-length.
 * Returns the assistant text + light meta, or null on failure.
 */
export async function llmChatCompletion(
  messages: ChatMessage[],
  opts: { correlationId?: string; model?: string; maxTokens?: number } = {},
): Promise<ChatResult | null> {
  const { provider, model } = llmChatProvider(opts.model);
  const result = await callMcpTool<unknown>(
    "llm_chat",
    {
      provider,
      messages,
      max_tokens: opts.maxTokens ?? 4096,
      ...(model ? { model } : {}),
    },
    { correlationId: opts.correlationId, timeoutMs: 60000 },
  );
  if (result == null) return null;
  const extracted = extractChatResult(result);
  if (!extracted) return null;
  // Surface which provider/model actually answered (reasoning panel).
  return {
    text: extracted.text,
    meta: { provider: `platform:${provider}`, ...(model ? { model } : {}), ...extracted.meta },
  };
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

/**
 * Lego Factory engine (Phase 1b): generate a deliverable via the platform
 * `deliverable_draft` tool — the 5-step pipeline Plan → Retrieve → Write →
 * Assemble → Render, with knowledge-graph citations and optional engagement
 * attachment. Returns the markdown draft, or null on failure.
 */
export async function deliverableDraft(
  brief: string,
  kind: DeliverableKind,
  opts: { correlationId?: string; maxSections?: number; engagementId?: string } = {},
): Promise<DeliverableResult | null> {
  const result = await callMcpTool<unknown>(
    "deliverable_draft",
    {
      prompt: brief,
      type: kind,
      format: "markdown",
      include_citations: true,
      ...(opts.maxSections ? { max_sections: opts.maxSections } : {}),
      ...(opts.engagementId ? { engagement_id: opts.engagementId } : {}),
    },
    { correlationId: opts.correlationId, timeoutMs: 120000 },
  );
  if (result == null) return null;
  return extractDeliverable(result);
}

/** A rendered binary document (Output Forge) for client-side download. */
export type DocumentFormat = "docx" | "pdf";
export type ProducedDocument = { base64: string; filename: string; mediaType: string };

const DOCUMENT_MIME: Record<DocumentFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

/** Extract base64 artifact bytes + filename from a produce_document envelope (pure). */
export function extractProducedDocument(
  result: unknown,
  format: DocumentFormat,
  title?: string,
): ProducedDocument | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const inner = (r.result as Record<string, unknown>) ?? r;
  const base64 =
    (typeof inner.artifact === "string" && inner.artifact) ||
    (typeof inner.base64 === "string" && inner.base64) ||
    (typeof inner.bytes === "string" && inner.bytes) ||
    (typeof inner.data === "string" && inner.data) ||
    (typeof inner.content === "string" && inner.content) ||
    "";
  if (!base64) return null;
  const filename =
    (typeof inner.filename === "string" && inner.filename) ||
    `${(title || "deliverable").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60)}.${format}`;
  const mediaType =
    (typeof inner.media_type === "string" && inner.media_type) ||
    (typeof inner.mime === "string" && inner.mime) ||
    DOCUMENT_MIME[format];
  return { base64, filename, mediaType };
}

/**
 * Output Forge (Phase 1b): render a brief to a downloadable DOCX/PDF via the
 * platform `produce_document` tool. Returns base64 bytes + filename + mime, or
 * null on failure.
 */
export async function produceDocument(
  brief: string,
  format: DocumentFormat,
  opts: { correlationId?: string; title?: string } = {},
): Promise<ProducedDocument | null> {
  const result = await callMcpTool<unknown>(
    "produce_document",
    {
      brief,
      format,
      product_type: "document",
      ...(opts.title ? { title: opts.title } : {}),
    },
    { correlationId: opts.correlationId, timeoutMs: 120000 },
  );
  if (result == null) return null;
  return extractProducedDocument(result, format, opts.title);
}

// ───────────────────────────────────────────────────────────────────────────
// Long-form "Dreamscape" generator — ports the RLM writer pipeline: iterative
// per-section generation with `context_fold` (CaaS Mercury, LIN-568) compressing
// the running context between passes, so the output can grow far past a single
// call's limit while staying coherent.
// ───────────────────────────────────────────────────────────────────────────

/** Parse an outline LLM response into clean section titles (pure, testable). */
export function parseOutline(text: string, max = 10): string[] {
  const titles: string[] = [];
  for (const rawLine of text.split("\n")) {
    const stripped = rawLine
      .trim()
      .replace(/^#{1,6}\s*/, "") // markdown heading
      .replace(/^[-*]\s+/, "") // bullet
      .replace(/^\d+[.)]\s+/, "") // 1. / 1)
      .replace(/^\*\*(.*)\*\*$/, "$1") // bold-only line
      .trim();
    if (!stripped || stripped.length > 200) continue;
    if (/^(outline|sektioner?|sections?|here('|’)?s|title)\b/i.test(stripped)) continue;
    titles.push(stripped);
    if (titles.length >= max) break;
  }
  return titles;
}

/** Extract the compressed text from a context_fold envelope (pure, testable). */
export function extractFolded(result: unknown): string | null {
  if (typeof result === "string") return result.trim() || null;
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const inner = (r.result as Record<string, unknown>) ?? r;
  const t =
    (typeof inner.folded === "string" && inner.folded) ||
    (typeof inner.compressed === "string" && inner.compressed) ||
    (typeof inner.summary === "string" && inner.summary) ||
    (typeof inner.text === "string" && inner.text) ||
    (typeof inner.content === "string" && inner.content) ||
    "";
  const s = typeof t === "string" ? t.trim() : "";
  return s || null;
}

/** Compress text via the platform `context_fold` tool (RLM /fold/context). */
export async function foldContext(
  text: string,
  query: string,
  opts: { correlationId?: string; budget?: number } = {},
): Promise<string | null> {
  const result = await callMcpTool<unknown>(
    "context_fold",
    { text, query, budget: opts.budget ?? 1500 },
    { correlationId: opts.correlationId, timeoutMs: 30000 },
  );
  if (result == null) return null;
  return extractFolded(result);
}

/**
 * Generate an extremely long deliverable by iterating section-by-section through
 * an outline, feeding each section a FOLDED summary of the prior sections as
 * context (the writer/dreamscape pattern). Sequential for coherence; folds
 * lazily (only when the running text exceeds the budget) to respect the
 * context_fold rate limit; resilient to a single section failing.
 */
export async function longformGenerate(
  brief: string,
  kind: DeliverableKind,
  opts: { correlationId?: string; targetSections?: number; model?: string } = {},
): Promise<DeliverableResult | null> {
  const cid = opts.correlationId;
  const n = Math.min(10, Math.max(3, opts.targetSections ?? 6));

  // 1. Outline — one call returns the section titles.
  const outline = await llmChatCompletion(
    [
      {
        role: "system",
        content:
          "You are a precise consulting writer. Output ONLY a numbered outline — one short, specific section title per line. No prose, no preamble.",
      },
      {
        role: "user",
        content: `Create a ${n}-section outline for a long-form ${kind} on:\n\n${brief}`,
      },
    ],
    { correlationId: cid, model: opts.model },
  );
  const titles = outline ? parseOutline(outline.text, n) : [];
  if (titles.length === 0) return null;

  // 2. Sequential section loop with lazy folding of the running context.
  const sections: string[] = [];
  let folded = "";
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    const ctx = folded ? `Story so far (compressed, for continuity):\n${folded}\n\n` : "";
    const sec = await llmChatCompletion(
      [
        {
          role: "system",
          content:
            "You are a consultant-grade writer (MECE, Pyramid Principle). Write ONE thorough, multi-paragraph section in Markdown, starting with a `## ` heading. Be detailed and specific; do NOT summarize the whole document or repeat earlier sections.",
        },
        {
          role: "user",
          content: `${ctx}Brief: ${brief}\n\nWrite the full section "${title}" (section ${i + 1} of ${titles.length}).`,
        },
      ],
      { correlationId: cid, model: opts.model },
    );
    const body = sec?.text?.trim();
    sections.push(
      body
        ? body.startsWith("#")
          ? body
          : `## ${title}\n\n${body}`
        : `## ${title}\n\n_(denne sektion kunne ikke genereres — fortsætter)_`,
    );

    // 3. Re-fold the running output (lazily) for the next section's context.
    const running = sections.join("\n\n");
    if (i < titles.length - 1) {
      if (running.length > 4000) {
        const f = await foldContext(running, titles[i + 1] ?? brief, { correlationId: cid });
        folded = f ?? running.slice(-3000);
      } else {
        folded = running;
      }
    }
  }

  const markdown = sections.join("\n\n").trim();
  return markdown ? { markdown, citations: 0 } : null;
}

/** Per-tool health row derived from runtime_summary.top_tools. */
export type ToolHealth = {
  name: string;
  calls: number;
  errors: number;
  errorRate: number; // 0–1
  avgMs: number;
};

/** Fleet runtime snapshot (agents, requests, success-rate, top tools). */
export type RuntimeSnapshot = {
  totalAgents: number;
  totalRequests: number;
  successRate: number; // percentage 0–100
  tools: ToolHealth[];
};

/** Neo4j graph size snapshot. */
export type GraphSnapshot = { nodes: number; relationships: number; online: boolean };

/** Parse a runtime_summary envelope into a normalized fleet snapshot (pure). */
export function extractRuntimeSummary(result: unknown): RuntimeSnapshot | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const inner = (r.result as Record<string, unknown>) ?? r;
  const totalRequests = typeof inner.total_requests === "number" ? inner.total_requests : 0;
  const totalAgents = typeof inner.total_agents === "number" ? inner.total_agents : 0;
  const successRate = typeof inner.avg_success_rate === "number" ? inner.avg_success_rate : 0;
  const rawTools = Array.isArray(inner.top_tools) ? inner.top_tools : [];
  const tools: ToolHealth[] = rawTools
    .map((t) => {
      const o = (t ?? {}) as Record<string, unknown>;
      const calls = typeof o.call_count === "number" ? o.call_count : 0;
      const errors = typeof o.error_count === "number" ? o.error_count : 0;
      return {
        name: typeof o.tool_name === "string" ? o.tool_name : "unknown",
        calls,
        errors,
        errorRate: calls > 0 ? errors / calls : 0,
        avgMs: typeof o.avg_duration_ms === "number" ? Math.round(o.avg_duration_ms) : 0,
      };
    })
    .filter((t) => t.calls > 0);
  // Only treat as "no signal" when the fleet is genuinely empty. A registered-
  // but-idle fleet (agents/success-rate present, zero requests) is still valid.
  if (totalRequests === 0 && totalAgents === 0 && tools.length === 0) return null;
  return { totalAgents, totalRequests, successRate, tools };
}

/** Parse a data_graph_stats envelope into a graph size snapshot (pure). */
export function extractGraphSnapshot(result: unknown): GraphSnapshot | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const inner = (r.result as Record<string, unknown>) ?? r;
  const nodes = typeof inner.nodes === "number" ? inner.nodes : null;
  const relationships = typeof inner.relationships === "number" ? inner.relationships : null;
  if (nodes == null && relationships == null) return null;
  return {
    nodes: nodes ?? 0,
    relationships: relationships ?? 0,
    online: inner.status === "online" || inner.status == null,
  };
}

/** Fetch the fleet runtime snapshot via the platform `runtime_summary` tool. */
export async function fetchRuntimeSnapshot(
  correlationId?: string,
): Promise<RuntimeSnapshot | null> {
  const result = await callMcpTool<unknown>(
    "runtime_summary",
    {},
    { correlationId, timeoutMs: 10000 },
  );
  if (result == null) return null;
  return extractRuntimeSummary(result);
}

/** Fetch the Neo4j graph size via the platform `data_graph_stats` tool. */
export async function fetchGraphSnapshot(correlationId?: string): Promise<GraphSnapshot | null> {
  const result = await callMcpTool<unknown>(
    "data_graph_stats",
    {},
    { correlationId, timeoutMs: 15000 },
  );
  if (result == null) return null;
  return extractGraphSnapshot(result);
}
