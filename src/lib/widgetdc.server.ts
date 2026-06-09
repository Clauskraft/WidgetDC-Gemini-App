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
const TOOL_DISCOVERY_TIMEOUT_MS = 3000;
const TOOL_DISCOVERY_TTL_MS = 5 * 60 * 1000;
const TOOL_DISCOVERY_FAILURE_TTL_MS = 30 * 1000;

type McpTarget = "backend" | "orchestrator";
type McpRouteConfig = { url: string; key: string; target: McpTarget };
type McpEndpointConfig = McpRouteConfig & { toolsUrls: string[] };
type McpToolDiscoveryCache = {
  signature: string;
  expiresAt: number;
  byTool: Map<string, McpRouteConfig>;
};

let mcpToolDiscoveryCache: McpToolDiscoveryCache | null = null;
let mcpToolDiscoveryInflight: {
  signature: string;
  promise: Promise<Map<string, McpRouteConfig>>;
} | null = null;

function cleanMcpBase(base: string): string {
  return base.replace(/\/+$/, "");
}

function backendMcpKey(env: NodeJS.ProcessEnv): string | undefined {
  // Canonical WidgeTDC unified bearer is `WIDGETDC_BEARER_TOKEN`; `WIDGETDC_API_KEY`
  // and `MCP_AGENT_API_KEY` are legacy aliases kept for backward compatibility
  // (matches apps/backend/src/utils/serviceBearer.ts resolution order).
  return (
    env.WIDGETDC_BEARER_TOKEN ??
    env.WIDGETDC_API_KEY ??
    env.MCP_AGENT_API_KEY ??
    env.WIDGETDC_ORCHESTRATOR_API_KEY ??
    env.ORCHESTRATOR_API_KEY
  );
}

function orchestratorMcpKey(env: NodeJS.ProcessEnv): string | undefined {
  return (
    env.WIDGETDC_ORCHESTRATOR_API_KEY ??
    env.ORCHESTRATOR_API_KEY ??
    env.WIDGETDC_BEARER_TOKEN ??
    env.WIDGETDC_API_KEY ??
    env.MCP_AGENT_API_KEY
  );
}

function mcpRouteFromEndpoint(endpoint: McpEndpointConfig): McpRouteConfig {
  return { url: endpoint.url, key: endpoint.key, target: endpoint.target };
}

function mcpToolDiscoveryUrls(base: string): string[] {
  return [`${base}/api/mcp/tools`, `${base}/mcp/tools`];
}

function configuredMcpEndpoints(env: NodeJS.ProcessEnv = process.env): McpEndpointConfig[] {
  const endpoints: McpEndpointConfig[] = [];
  const backendBase = env.WIDGETDC_BACKEND_URL ? cleanMcpBase(env.WIDGETDC_BACKEND_URL) : "";
  const backendKey = backendMcpKey(env);
  if (backendBase && backendKey) {
    endpoints.push({
      url: `${backendBase}/api/mcp/route`,
      toolsUrls: mcpToolDiscoveryUrls(backendBase),
      key: backendKey,
      target: "backend",
    });
  }

  const orchestratorBase = env.WIDGETDC_ORCHESTRATOR_URL
    ? cleanMcpBase(env.WIDGETDC_ORCHESTRATOR_URL)
    : "";
  const orchestratorKey = orchestratorMcpKey(env);
  if (orchestratorBase && orchestratorKey && orchestratorBase !== backendBase) {
    endpoints.push({
      url: `${orchestratorBase}/api/mcp/route`,
      toolsUrls: mcpToolDiscoveryUrls(orchestratorBase),
      key: orchestratorKey,
      target: "orchestrator",
    });
  }

  return endpoints;
}

export function resolveMcpRoute(
  _tool: string,
  env: NodeJS.ProcessEnv = process.env,
): McpRouteConfig | null {
  const endpoint = configuredMcpEndpoints(env)[0];
  return endpoint ? mcpRouteFromEndpoint(endpoint) : null;
}

export function isPlatformConfigured(): boolean {
  return (
    resolveMcpRoute("reason_deeply") !== null || resolveMcpRoute("forge.artifact.generate") !== null
  );
}

function collectToolCandidates(catalog: unknown): unknown[] {
  if (Array.isArray(catalog)) return catalog;
  if (!catalog || typeof catalog !== "object") return [];
  const c = catalog as Record<string, unknown>;
  const direct: unknown[] = [];
  for (const key of ["tools", "definitions"]) {
    if (Array.isArray(c[key])) direct.push(...(c[key] as unknown[]));
  }
  for (const key of ["data", "result"]) {
    direct.push(...collectToolCandidates(c[key]));
  }
  return direct;
}

function extractMcpToolName(candidate: unknown): string | null {
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    return trimmed || null;
  }
  if (!candidate || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;
  for (const key of ["name", "tool", "id", "tool_name", "canonical_tool"]) {
    const value = c[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function extractMcpToolNames(catalog: unknown): string[] {
  const names = new Set<string>();
  for (const candidate of collectToolCandidates(catalog)) {
    const name = extractMcpToolName(candidate);
    if (name) names.add(name);
  }
  return [...names];
}

export function buildMcpToolRouteMap(
  catalogs: Array<{ route: McpRouteConfig; catalog: unknown }>,
): Map<string, McpRouteConfig> {
  const byTool = new Map<string, McpRouteConfig>();
  for (const { route, catalog } of catalogs) {
    for (const tool of extractMcpToolNames(catalog)) {
      // Catalogs are passed backend-first, so duplicate tool names stay on backend.
      if (!byTool.has(tool)) byTool.set(tool, route);
    }
  }
  return byTool;
}

function mcpDiscoverySignature(endpoints: McpEndpointConfig[]): string {
  return endpoints
    .map((endpoint) => `${endpoint.target}:${endpoint.url}:${endpoint.toolsUrls.join(",")}:key`)
    .join("|");
}

async function fetchMcpToolCatalog(
  endpoint: McpEndpointConfig,
  opts: { correlationId?: string } = {},
): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOOL_DISCOVERY_TIMEOUT_MS);
  const started = Date.now();
  try {
    let lastStatus = 0;
    for (let i = 0; i < endpoint.toolsUrls.length; i++) {
      const res = await fetch(endpoint.toolsUrls[i], {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${endpoint.key}`,
          ...(opts.correlationId ? { "x-correlation-id": opts.correlationId } : {}),
        },
        signal: controller.signal,
      });
      if (res.ok) return await res.json();
      lastStatus = res.status;
      if (res.status === 404 && i < endpoint.toolsUrls.length - 1) continue;
      logServer(res.status >= 500 ? "error" : "warn", {
        event: "mcp_tool_discovery_non_2xx",
        requestId: opts.correlationId,
        endpoint: endpoint.target,
        status: res.status,
        durationMs: Date.now() - started,
      });
      return null;
    }
    logServer("warn", {
      event: "mcp_tool_discovery_non_2xx",
      requestId: opts.correlationId,
      endpoint: endpoint.target,
      status: lastStatus,
      durationMs: Date.now() - started,
    });
    return null;
  } catch (error) {
    logServer(
      "warn",
      {
        event: "mcp_tool_discovery_failed",
        requestId: opts.correlationId,
        endpoint: endpoint.target,
        durationMs: Date.now() - started,
      },
      error,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function cacheMcpToolDiscovery(
  signature: string,
  byTool: Map<string, McpRouteConfig>,
  ttlMs: number,
): Map<string, McpRouteConfig> {
  mcpToolDiscoveryCache = {
    signature,
    expiresAt: Date.now() + ttlMs,
    byTool,
  };
  return byTool;
}

async function discoverMcpToolRoutes(
  env: NodeJS.ProcessEnv,
  opts: { correlationId?: string } = {},
  allowSingleEndpoint = false,
): Promise<Map<string, McpRouteConfig>> {
  const endpoints = configuredMcpEndpoints(env);
  if (endpoints.length === 0 || (!allowSingleEndpoint && endpoints.length < 2)) return new Map();

  const signature = mcpDiscoverySignature(endpoints);
  const now = Date.now();
  if (
    mcpToolDiscoveryCache &&
    mcpToolDiscoveryCache.signature === signature &&
    mcpToolDiscoveryCache.expiresAt > now
  ) {
    return mcpToolDiscoveryCache.byTool;
  }

  if (mcpToolDiscoveryInflight?.signature === signature) {
    return mcpToolDiscoveryInflight.promise;
  }

  const promise = discoverMcpToolRoutesUncached(endpoints, signature, opts);
  mcpToolDiscoveryInflight = { signature, promise };
  try {
    return await promise;
  } finally {
    if (mcpToolDiscoveryInflight?.promise === promise) {
      mcpToolDiscoveryInflight = null;
    }
  }
}

async function discoverMcpToolRoutesUncached(
  endpoints: McpEndpointConfig[],
  signature: string,
  opts: { correlationId?: string } = {},
): Promise<Map<string, McpRouteConfig>> {
  type DiscoveredMcpCatalog = { route: McpRouteConfig; catalog: unknown };
  const catalogResults = await Promise.all(
    endpoints.map(async (endpoint): Promise<DiscoveredMcpCatalog | null> => {
      const catalog = await fetchMcpToolCatalog(endpoint, opts);
      return catalog == null ? null : { route: mcpRouteFromEndpoint(endpoint), catalog };
    }),
  );
  const catalogs = catalogResults.filter((entry): entry is DiscoveredMcpCatalog => entry !== null);

  if (
    endpoints.some((endpoint) => endpoint.target === "backend") &&
    !catalogs.some((entry) => entry.route.target === "backend")
  ) {
    return cacheMcpToolDiscovery(signature, new Map(), TOOL_DISCOVERY_FAILURE_TTL_MS);
  }

  if (catalogs.length === 0) {
    return cacheMcpToolDiscovery(signature, new Map(), TOOL_DISCOVERY_FAILURE_TTL_MS);
  }

  const byTool = buildMcpToolRouteMap(catalogs);
  return cacheMcpToolDiscovery(signature, byTool, TOOL_DISCOVERY_TTL_MS);
}

async function resolveMcpRouteWithDiscovery(
  tool: string,
  env: NodeJS.ProcessEnv,
  opts: { correlationId?: string } = {},
): Promise<McpRouteConfig | null> {
  const fallback = resolveMcpRoute(tool, env);
  const discovered = await discoverMcpToolRoutes(env, opts);
  return discovered.get(tool) ?? fallback;
}

export function clearMcpToolDiscoveryCacheForTests(): void {
  mcpToolDiscoveryCache = null;
  mcpToolDiscoveryInflight = null;
}

/**
 * Call a WidgeTDC MCP tool. Returns the parsed JSON result, or null on any
 * failure (missing config, network error, non-2xx, timeout).
 */
export async function callMcpTool<T = unknown>(
  tool: string,
  payload: Record<string, unknown>,
  opts: { timeoutMs?: number; correlationId?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<T | null> {
  const cfg = await resolveMcpRouteWithDiscovery(tool, opts.env ?? process.env, {
    correlationId: opts.correlationId,
  });
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

async function callMcpToolIfCatalogued<T = unknown>(
  tool: string,
  payload: Record<string, unknown>,
  opts: { timeoutMs?: number; correlationId?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<T | null> {
  const env = opts.env ?? process.env;
  const discovered = await discoverMcpToolRoutes(
    env,
    { correlationId: opts.correlationId },
    true,
  );
  if (discovered.size > 0 && !discovered.has(tool)) {
    logServer("info", {
      event: "mcp_tool_not_catalogued",
      requestId: opts.correlationId,
      tool,
    });
    return null;
  }
  return callMcpTool<T>(tool, payload, opts);
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

function isFailedMcpEnvelope(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as Record<string, unknown>;
  const inner = (r.result as Record<string, unknown> | undefined) ?? r;
  return r.success === false || inner.success === false;
}

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
  if (!isFailedMcpEnvelope(srag)) {
    const fromSrag = extractSources(srag);
    if (fromSrag.length > 0) return packGrounding(fromSrag);
  }

  // Fallback: adaptive rag_route.
  const rag = await callMcpTool<unknown>(
    "rag_route",
    { query, limit: 6 },
    { correlationId, timeoutMs: 6000 },
  );
  if (rag == null || isFailedMcpEnvelope(rag)) return null;
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
// Current production backend no longer registers the legacy
// `generate_deliverable` / `deliverable_draft` aliases. Markdown generation
// therefore falls through to the explicit degraded writer fallback unless a
// future deployment opts back into the legacy aliases.
// ───────────────────────────────────────────────────────────────────────────

/** The three deliverable kinds the platform `generate_deliverable` accepts. */
export type DeliverableKind = "analysis" | "roadmap" | "assessment";

/** A generated deliverable: markdown body + citation count. */
export type DeliverableResult = { markdown: string; citations: number };

/** PRISM quality verdict (0–10 aggregate + per-dimension breakdown). */
export type DeliverableQuality = { score: number; dimensions?: Record<string, number> };

function legacyDeliverableToolsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return /^(1|true|yes)$/i.test(env.WIDGETDC_ENABLE_LEGACY_DELIVERABLE_TOOLS ?? "");
}

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
  if (!legacyDeliverableToolsEnabled()) {
    logServer("warn", {
      event: "deliverable_generate_legacy_tool_disabled_using_platform_writer",
      requestId: opts.correlationId,
      tool: "generate_deliverable",
      kind,
    });
    return platformWriterDeliverable(brief, kind, {
      correlationId: opts.correlationId,
      maxSections: opts.maxSections,
      mode: "rag",
    });
  }
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

function deliverableKindLabel(kind: DeliverableKind): string {
  switch (kind) {
    case "roadmap":
      return "Roadmap";
    case "assessment":
      return "Assessment";
    case "analysis":
    default:
      return "Analysis";
  }
}

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .trim();
}

export function isSubstantiveDeliverable(markdown: string, brief: string): boolean {
  const body = markdown.trim();
  if (body.length < 300) return false;
  const headings = body.match(/^#{1,3}\s+\S.+$/gm) ?? [];
  if (headings.length < 3) return false;
  if (!/Canvas notes:/i.test(body)) return false;
  const normalizedBody = normalizeForComparison(body);
  const normalizedBrief = normalizeForComparison(brief);
  if (!normalizedBody || normalizedBody === normalizedBrief) return false;
  if (normalizedBrief.length > 30 && normalizedBody.length < normalizedBrief.length * 1.4) {
    return false;
  }
  const rejected = [
    "platform generation/rendering was unavailable",
    "this export contains the submitted brief only",
    "platform renderer did not return a document artifact",
    "re-run generation when the upstream document pipeline is healthy",
  ];
  if (rejected.some((phrase) => normalizedBody.includes(normalizeForComparison(phrase)))) {
    return false;
  }
  return true;
}

function briefExcerpt(brief: string, max = 180): string {
  const cleaned = brief.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trim()}...` : cleaned;
}

export function localTemplateDeliverable(brief: string, kind: DeliverableKind): DeliverableResult {
  const subject = briefExcerpt(brief);
  const isDanish = /[æøåÆØÅ]/.test(brief);
  const title = `${deliverableKindLabel(kind)}: ${briefExcerpt(brief, 72)}`;
  const markdown = isDanish
    ? [
        `# ${title}`,
        "",
        "## SCQA",
        `**Situation:** Briefet peger på et beslutningsområde, hvor relationer, kontekst og sporbarhed er afgørende: ${subject}`,
        "",
        "**Komplikation:** Uden en struktureret analyse bliver scope, evidens, risici og ejerskab let blandet sammen. Det gør output sværere at auditere og svagere som beslutningsgrundlag.",
        "",
        "**Spørgsmål:** Hvilke beslutninger, risici og næste skridt skal afklares for at gøre arbejdet beslutningsklart?",
        "",
        "## MECE issue tree",
        "```mermaid",
        "flowchart TD",
        'A["Beslutning"] --> B["Relationel kompleksitet"]',
        'A --> C["Evidens og provenance"]',
        'A --> D["Operationel anvendelse"]',
        'B --> B1["Aktører, afhængigheder og antagelser"]',
        'C --> C1["Kilder, kvalitet og auditspor"]',
        'D --> D1["Handlinger, ejerskab og validering"]',
        "```",
        "",
        "## Anbefalet handlingsplan",
        "1. Afgræns beslutningen, målgruppen og de vigtigste succeskriterier før analysen udvides.",
        "2. Adskil fakta, antagelser og anbefalinger, så hvert claim kan spores til en kilde eller et eksplicit forbehold.",
        "3. Indfør en kvalitetsgate med tydelige risici, Canvas notes og næste handling før ekstern deling.",
        "4. Start med et smalt use case, mål svartid, evidensdækning og fejltyper, og udvid først når output er stabilt.",
        "",
        "## Risici og validering",
        "De primære risici er for bredt scope, uklare datakilder, manglende provenance og svage ejerskaber for validering. Output bør derfor kontrolleres mod konkrete kilder, beslutningsspørgsmål og de handlinger brugeren faktisk skal kunne tage.",
        "",
        "Canvas notes:",
        "- Hold første scope smalt: beslutning, aktører, claims og evidensspor.",
        "- Brug Canvas-panelet til kvalitetssikring: risici, forbehold og næste handling.",
        "- Behandl output som degraded arbejdsudkast indtil native pipeline og kildevalidering er grøn.",
      ].join("\n")
    : [
        `# ${title}`,
        "",
        "## SCQA",
        `**Situation:** The brief identifies a decision area where relationships, context, and traceability matter: ${subject}`,
        "",
        "**Complication:** Without a structured analysis, scope, evidence, risks, and ownership blur together. That weakens auditability and makes the output less useful for decisions.",
        "",
        "**Question:** Which decisions, risks, and next steps must be clarified to make the work decision-ready?",
        "",
        "## MECE issue tree",
        "```mermaid",
        "flowchart TD",
        'A["Decision"] --> B["Relationship complexity"]',
        'A --> C["Evidence and provenance"]',
        'A --> D["Operational use"]',
        'B --> B1["Actors, dependencies, and assumptions"]',
        'C --> C1["Sources, quality, and audit trail"]',
        'D --> D1["Actions, ownership, and validation"]',
        "```",
        "",
        "## Recommended action plan",
        "1. Define the decision, audience, and success criteria before expanding the analysis.",
        "2. Separate facts, assumptions, and recommendations so each claim has a source or explicit caveat.",
        "3. Add a quality gate requiring clear risks, Canvas notes, and a next action before external sharing.",
        "4. Start with one narrow use case, measure latency, evidence coverage, and error types, then expand only when output is stable.",
        "",
        "## Risks and validation",
        "The main risks are broad scope, unclear data sources, missing provenance, and weak ownership for validation. Check the output against concrete sources, the decision question, and the actions the user must be able to take.",
        "",
        "Canvas notes:",
        "- Keep first scope narrow: decision, actors, claims, and evidence trail.",
        "- Use the Canvas panel as the quality surface: risks, caveats, and next action.",
        "- Treat the output as a degraded working draft until the native pipeline and source validation are green.",
      ].join("\n");

  return { markdown, citations: 0 };
}

function deliverableWriterPrompt(
  brief: string,
  kind: DeliverableKind,
  grounding: RagGrounding | null,
  opts: { maxSections?: number; mode?: "rag" | "lego" },
): string {
  const sections = opts.maxSections ?? 5;
  const framework =
    kind === "roadmap"
      ? "SCQA + MECE roadmap + OKR/RACI ownership"
      : kind === "assessment"
        ? "SCQA + MECE assessment + 2x2 risk/impact lens"
        : "SCQA + MECE issue tree + Pyramid Principle";
  const evidence = grounding?.context
    ? `\n\nAvailable evidence context, cite as [n] when relevant:\n${grounding.context}`
    : "";

  return [
    "Write a consulting-grade deliverable in Markdown only.",
    `Deliverable type: ${kind}.`,
    `Generation path: ${
      opts.mode === "lego"
        ? "Lego Factory style plan/retrieve/write/assemble/render"
        : "RAG-backed consulting draft"
    }.`,
    `Use ${sections} substantial sections.`,
    `Use framework signal: ${framework}.`,
    "Requirements:",
    "- Start with a clear H1 title.",
    "- Include at least three H2 sections.",
    "- Include one Mermaid flowchart or issue-tree block.",
    "- Include concrete recommendations and risks.",
    "- Include a final `Canvas notes:` section with at least 3 bullets.",
    "- If evidence context is provided, cite claims with [1], [2], etc.",
    "- Do not include meta-commentary about being an AI or about the prompt.",
    evidence,
    "\nBrief:",
    brief,
  ].join("\n");
}

async function platformWriterDeliverable(
  brief: string,
  kind: DeliverableKind,
  opts: {
    correlationId?: string;
    maxSections?: number;
    mode?: "rag" | "lego";
  } = {},
): Promise<DeliverableResult | null> {
  const grounding = await fetchRagGrounding(brief, opts.correlationId).catch(() => null);
  const prompt = deliverableWriterPrompt(brief, kind, grounding, {
    maxSections: opts.maxSections,
    mode: opts.mode,
  });
  const result = await orchestratorChat(
    [
      {
        role: "system",
        content:
          "You are WidgeTDC Deliverable Writer. Return only polished Markdown that satisfies the requested deliverable contract.",
      },
      { role: "user", content: prompt },
    ],
    { correlationId: opts.correlationId, deep: opts.mode === "lego" },
  );
  const markdown = result?.text?.trim();
  if (!markdown) return null;
  const deliverable = { markdown, citations: grounding?.sources.length ?? 0 };
  return isSubstantiveDeliverable(deliverable.markdown, brief) ? deliverable : null;
}

export async function fallbackDeliverable(
  brief: string,
  kind: DeliverableKind,
  opts: { correlationId?: string; maxSections?: number } = {},
): Promise<DeliverableResult | null> {
  const templateDeliverable = localTemplateDeliverable(brief, kind);
  return isSubstantiveDeliverable(templateDeliverable.markdown, brief) ? templateDeliverable : null;
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
  if (!legacyDeliverableToolsEnabled()) {
    logServer("warn", {
      event: "deliverable_judge_legacy_tool_disabled",
      requestId: correlationId,
      tool: "judge_response",
    });
    return null;
  }
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
  if (!legacyDeliverableToolsEnabled()) {
    logServer("warn", {
      event: "deliverable_generate_legacy_tool_disabled_using_platform_writer",
      requestId: opts.correlationId,
      tool: "deliverable_draft",
      kind,
    });
    return platformWriterDeliverable(brief, kind, {
      correlationId: opts.correlationId,
      maxSections: opts.maxSections,
      mode: "lego",
    });
  }
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
    (typeof inner.file_base64 === "string" && inner.file_base64) ||
    (typeof inner.artifact_base64 === "string" && inner.artifact_base64) ||
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
    (typeof inner.mime_type === "string" && inner.mime_type) ||
    (typeof inner.mime === "string" && inner.mime) ||
    DOCUMENT_MIME[format];
  return { base64, filename, mediaType };
}

function documentTitle(title?: string): string {
  const trimmed = title?.trim();
  return trimmed ? trimmed.slice(0, 120) : "Deliverable";
}

function documentFilename(title: string, format: Extract<DocumentFormat, "docx">): string {
  const base = title
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "deliverable"}.${format}`;
}

/**
 * Output Forge (Phase 1b): render a brief to a downloadable DOCX via the
 * canonical platform `forge.artifact.generate` tool. PDF is not a supported
 * forge artifact type on the current backend, so callers intentionally fall
 * back to local PDF rendering and mark it degraded.
 */
export async function produceDocument(
  brief: string,
  format: DocumentFormat,
  opts: { correlationId?: string; title?: string } = {},
): Promise<ProducedDocument | null> {
  if (format !== "docx") return null;
  const title = documentTitle(opts.title);
  const result = await callMcpTool<unknown>(
    "forge.artifact.generate",
    {
      artifact_type: "docx",
      title,
      blueprint_markdown: `# ${title}\n\n${brief}`,
      output_filename: documentFilename(title, "docx"),
      require_live: false,
      graph_rag_query: title,
    },
    { correlationId: opts.correlationId, timeoutMs: 120000 },
  );
  if (result == null) return null;
  return extractProducedDocument(result, format, opts.title);
}

export async function emitDeliverableDegradedEvent(event: {
  correlationId: string;
  stage: "generate" | "export";
  kind: DeliverableKind;
  engine: string;
  format?: DocumentFormat;
  reason: string;
  fallbackType: string;
}): Promise<void> {
  const payload = {
    event_type: "tool_failed",
    source: "widgetdc-gemini-frontend",
    correlation_id: event.correlationId,
    tenant_id: "tenant:widgetdc-internal",
    outcome: "failure",
    payload: {
      logical_event_type: "deliverable_generation_degraded",
      tool:
        event.stage === "export"
          ? event.format === "docx"
            ? "forge.artifact.generate"
            : "pdf_native_document_renderer"
          : "deliverable_native_markdown_pipeline",
      stage: event.stage,
      kind: event.kind,
      engine: event.engine,
      format: event.format,
      fallback_reason: event.reason,
      fallback_type: event.fallbackType,
    },
  };
  await callMcpTool<unknown>("governance.emit_spine_event", payload, {
    correlationId: event.correlationId,
    timeoutMs: 8000,
  });
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
  const foldedContext = inner.folded_context;
  if (foldedContext && typeof foldedContext === "object") {
    const content = (foldedContext as Record<string, unknown>).content;
    if (typeof content === "string" && content.trim()) return content.trim();
  }
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
    "context.fold",
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
  source?: "runtime_summary" | "audit.adoption_metrics" | "intent.stats" | "generic";
};

/** Neo4j graph size snapshot. */
export type GraphSnapshot = { nodes: number; relationships: number; online: boolean };

/** Parse a runtime_summary envelope into a normalized fleet snapshot (pure). */
export function extractRuntimeSummary(result: unknown): RuntimeSnapshot | null {
  if (!result || typeof result !== "object") return null;
  const normalized = normalizeNeo(result);
  const r = normalized as Record<string, unknown>;
  const inner = ((r.result as Record<string, unknown> | undefined) ??
    (r.data as Record<string, unknown> | undefined) ??
    r) as Record<string, unknown>;
  if (inner.success === false) return null;

  const rawTools = Array.isArray(inner.top_tools)
    ? inner.top_tools
    : Array.isArray(inner.topTools)
      ? inner.topTools
      : Array.isArray(inner.tools)
        ? inner.tools
        : [];
  const tools: ToolHealth[] = rawTools
    .map((t) => {
      const o = (t ?? {}) as Record<string, unknown>;
      const calls =
        pickMetricNumber(o, "call_count", "callCount", "calls", "count", "edgeCount") ?? 0;
      const errors = pickMetricNumber(o, "error_count", "errorCount", "errors") ?? 0;
      const explicitErrorRate = pickMetricNumber(o, "error_rate", "errorRate");
      return {
        name:
          (typeof o.tool_name === "string" && o.tool_name) ||
          (typeof o.tool === "string" && o.tool) ||
          (typeof o.name === "string" && o.name) ||
          "unknown",
        calls,
        errors,
        errorRate:
          explicitErrorRate != null
            ? explicitErrorRate > 1
              ? explicitErrorRate / 100
              : explicitErrorRate
            : calls > 0
              ? errors / calls
              : 0,
        avgMs: Math.round(
          pickMetricNumber(o, "avg_duration_ms", "avgDurationMs", "avg_ms", "avgMs") ?? 0,
        ),
      };
    })
    .filter((t) => t.calls > 0);

  const legacyRequests = pickMetricNumber(inner, "total_requests", "totalRequests");
  const legacyAgents = pickMetricNumber(inner, "total_agents", "totalAgents");
  const legacySuccessRate = pickMetricNumber(inner, "avg_success_rate", "successRate");
  const hasLegacyFleet =
    legacyRequests != null || legacyAgents != null || legacySuccessRate != null;

  const adoptionActivation = pickMetricNumber(inner, "activationRate", "activation_rate");
  const adoptionWau = pickMetricNumber(inner, "wau", "weeklyActiveUsers");
  const adoptionDau = pickMetricNumber(inner, "dau", "dailyActiveUsers");
  const hasAdoptionFleet = adoptionActivation != null || adoptionWau != null || adoptionDau != null;

  const intentToolCount = pickMetricNumber(inner, "toolCount", "tool_count");
  const intentEdgeCount = pickMetricNumber(inner, "edgeCount", "edge_count");
  const hasIntentFleet = intentToolCount != null || intentEdgeCount != null;

  const totalRequests =
    legacyRequests ??
    intentEdgeCount ??
    pickMetricNumber(inner, "totalEvents", "events") ??
    tools.reduce((sum, tool) => sum + tool.calls, 0);
  const totalAgents =
    legacyAgents ??
    adoptionWau ??
    adoptionDau ??
    intentToolCount ??
    pickMetricNumber(inner, "agents", "agentCount") ??
    0;
  const avgConfidence = averageToolConfidence(rawTools);
  const successRate =
    legacySuccessRate ??
    adoptionActivation ??
    (avgConfidence == null ? 0 : avgConfidence <= 1 ? avgConfidence * 100 : avgConfidence);
  const source = hasLegacyFleet
    ? "runtime_summary"
    : hasAdoptionFleet
      ? "audit.adoption_metrics"
      : hasIntentFleet
        ? "intent.stats"
        : "generic";

  // Only treat as "no signal" when the fleet is genuinely empty. A registered-
  // but-idle fleet (agents/success-rate present, zero requests) is still valid.
  if (totalRequests === 0 && totalAgents === 0 && tools.length === 0) return null;
  return { totalAgents, totalRequests, successRate, tools, source };
}

function metricNumber(value: unknown): number | null {
  const normalized = normalizeNeo(value);
  if (typeof normalized === "number" && Number.isFinite(normalized)) return normalized;
  if (typeof normalized === "string" && normalized.trim()) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickMetricNumber(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = metricNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

function averageToolConfidence(rawTools: unknown[]): number | null {
  const values = rawTools
    .map((tool) =>
      tool && typeof tool === "object"
        ? pickMetricNumber(tool as Record<string, unknown>, "avgConfidence", "confidence")
        : null,
    )
    .filter((value): value is number => value != null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

/** Fetch the fleet runtime snapshot via the best catalogued platform metrics tool. */
export async function fetchRuntimeSnapshot(
  correlationId?: string,
): Promise<RuntimeSnapshot | null> {
  for (const tool of ["runtime_summary", "audit.adoption_metrics", "intent.stats"]) {
    const result = await callMcpToolIfCatalogued<unknown>(
      tool,
      {},
      { correlationId, timeoutMs: 10000 },
    );
    const snapshot = extractRuntimeSummary(result);
    if (snapshot)
      return { ...snapshot, source: snapshot.source ?? (tool as RuntimeSnapshot["source"]) };
  }
  return null;
}

/** Fetch the Neo4j graph size via the legacy alias or canonical `graph.stats`. */
export async function fetchGraphSnapshot(correlationId?: string): Promise<GraphSnapshot | null> {
  const legacy = await callMcpTool<unknown>(
    "data_graph_stats",
    {},
    { correlationId, timeoutMs: 15000 },
  );
  const legacySnapshot = extractGraphSnapshot(legacy);
  if (legacySnapshot) return legacySnapshot;

  const canonical = await callMcpTool<unknown>(
    "graph.stats",
    {},
    { correlationId, timeoutMs: 15000 },
  );
  return extractGraphSnapshot(canonical);
}
