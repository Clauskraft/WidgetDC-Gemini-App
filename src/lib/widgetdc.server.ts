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
 * Run a chat turn through the WidgeTDC backend `reason_deeply` (RLM) tool —
 * the LLM surface this backend MCP route (`/api/mcp/route`) actually exposes.
 * Provider/model is platform-routed (RLM picks gemini/deepseek/claude per
 * domain). Returns the assistant text, or null on any failure.
 *
 * The full prior conversation is flattened into the `task` string so the RLM
 * has context (this tool is single-shot, not message-array based).
 */
export async function orchestratorChat(
  messages: ChatMessage[],
  opts: { correlationId?: string } = {},
): Promise<string | null> {
  const task = messages
    .map((m) => {
      const who =
        m.role === "system" ? "INSTRUCTIONS" : m.role === "assistant" ? "ASSISTANT" : "USER";
      return `${who}:\n${m.content}`;
    })
    .join("\n\n");

  const result = await callMcpTool<unknown>(
    "reason_deeply",
    { task, mode: "reason" },
    { correlationId: opts.correlationId, timeoutMs: 90000 },
  );
  if (result == null) return null;
  return extractChatText(result);
}

/** Extract assistant text from the reason_deeply / RLM response envelope. */
function extractChatText(result: unknown): string | null {
  if (typeof result === "string") return result.trim() || null;
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;

  // reason_deeply shape: { success, result: { recommendation, reasoning, ... } }
  const inner = (r.result as Record<string, unknown>) ?? r;
  const pick =
    (typeof inner.recommendation === "string" && inner.recommendation) ||
    (typeof inner.answer === "string" && inner.answer) ||
    (typeof inner.text === "string" && inner.text) ||
    (typeof inner.response === "string" && inner.response) ||
    (typeof r.recommendation === "string" && r.recommendation) ||
    (typeof r.text === "string" && r.text);
  if (pick) {
    let out = (pick as string).trim();
    // Append the reasoning if it adds material beyond the recommendation.
    const reasoning = inner.reasoning ?? r.reasoning;
    if (typeof reasoning === "string" && reasoning.trim() && !out.includes(reasoning.trim())) {
      out += `\n\n${reasoning.trim()}`;
    }
    return out || null;
  }
  return null;
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
