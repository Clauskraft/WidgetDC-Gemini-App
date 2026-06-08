/**
 * Server-only direct LLM provider clients.
 *
 * The WidgeTDC backend MCP route exposes only `reason_deeply`, which ignores
 * provider/model overrides and always routes to the platform's small default
 * (gemini-2.5-flash-lite). To honor the user's model picker we call providers
 * directly here. Each function returns the assistant text + light metadata,
 * or null on failure so the caller can fall back to the platform RLM.
 *
 * `.server.ts` keeps all API keys + node:fetch out of the client bundle.
 */
import process from "node:process";
import { consumeSse } from "./sse.server";

export type ProviderId = "openai" | "google" | "anthropic" | "platform";

export type ProviderResult = {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
};

export type ProviderChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_TIMEOUT = 90_000;

/** Map a UI model id (e.g. "openai/gpt-5", "google/gemini-2.5-pro") to a provider. */
export function providerForModel(modelId: string | undefined): ProviderId {
  const id = (modelId ?? "").toLowerCase();
  if (id.startsWith("openai/") || id.startsWith("gpt")) return "openai";
  if (id.startsWith("anthropic/") || id.startsWith("claude")) return "anthropic";
  if (id.startsWith("google/") || id.startsWith("gemini")) return "google";
  return "platform";
}

/** Strip the "vendor/" prefix from a UI model id, leaving the upstream model id. */
function stripPrefix(modelId: string): string {
  const slash = modelId.indexOf("/");
  return slash >= 0 ? modelId.slice(slash + 1) : modelId;
}

function isConfigured(provider: ProviderId): boolean {
  switch (provider) {
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "google":
      return !!process.env.GEMINI_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    case "platform":
      return true;
  }
}

export function providerConfigured(provider: ProviderId): boolean {
  return isConfigured(provider);
}

/** Run a chat completion against OpenAI's Chat Completions API. */
async function callOpenAI(
  modelId: string,
  messages: ProviderChatMessage[],
  signal: AbortSignal,
): Promise<ProviderResult | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const started = Date.now();
  const model = stripPrefix(modelId);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages }),
    signal,
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  return { text, provider: "openai", model, latencyMs: Date.now() - started };
}

/** Run a chat completion against Anthropic's Messages API. */
async function callAnthropic(
  modelId: string,
  messages: ProviderChatMessage[],
  signal: AbortSignal,
): Promise<ProviderResult | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const started = Date.now();
  const model = stripPrefix(modelId);
  // Anthropic wants system separate from messages.
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const userAssistant = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: system || undefined,
      messages: userAssistant,
      max_tokens: 4096,
    }),
    signal,
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = (json.content ?? [])
    .filter((p) => p?.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .trim();
  if (!text) return null;
  return { text, provider: "anthropic", model, latencyMs: Date.now() - started };
}

/** Run a chat completion against Google's Gemini API (v1beta generateContent). */
async function callGemini(
  modelId: string,
  messages: ProviderChatMessage[],
  signal: AbortSignal,
): Promise<ProviderResult | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const started = Date.now();
  const model = stripPrefix(modelId);
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  const body: Record<string, unknown> = { contents };
  if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p?.text ?? "")
    .join("")
    .trim();
  if (!text) return null;
  return { text, provider: "google", model, latencyMs: Date.now() - started };
}

/**
 * Run a chat completion against the direct provider for `modelId`. Returns
 * null on missing key / non-2xx / empty response so the caller can fall back
 * to the platform RLM (reason_deeply).
 */
export async function callDirectProvider(
  modelId: string,
  messages: ProviderChatMessage[],
  opts: { timeoutMs?: number } = {},
): Promise<ProviderResult | null> {
  const provider = providerForModel(modelId);
  if (provider === "platform" || !isConfigured(provider)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT);
  try {
    switch (provider) {
      case "openai":
        return await callOpenAI(modelId, messages, controller.signal);
      case "anthropic":
        return await callAnthropic(modelId, messages, controller.signal);
      case "google":
        return await callGemini(modelId, messages, controller.signal);
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// AUR-15: TRUE token streaming (raw-fetch SSE, dependency-free)
//
// `callDirectProvider` above blocks until the full completion arrives — the
// chat handler then faked a stream by emitting it in one chunk (up to 90s
// blank wait). These streaming variants push provider tokens to `onDelta` as
// they arrive, so the `useChat` client renders text incrementally. The wire
// contract to the client is unchanged — only the cadence improves.
// ───────────────────────────────────────────────────────────────────────────

export type StreamCallbacks = {
  /** Called for every text fragment as it streams in. */
  onDelta: (delta: string) => void;
};

/**
 * WidgeTDC Pattern: Provider Degradation (R18). A 5xx/429/529 from a model
 * provider is transient degradation, NOT a credential failure — retry once
 * with backoff. A 401/403 is an auth/config error: fail fast, NEVER retry or
 * rotate secrets. The fetch body is a reusable string, so re-issuing is safe
 * (the response body has not been consumed at the status check).
 */
async function fetchWithDegradationRetry(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<Response | null> {
  const DEGRADED = new Set([429, 500, 502, 503, 504, 529]);
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { ...init, signal });
    if (res.ok) return res;
    // Non-OK: release the unconsumed body so the socket is returned to the pool
    // instead of leaking (undici keeps the connection alive until the body is
    // read or cancelled).
    await res.body?.cancel().catch(() => {});
    // Credential/config failure — do not retry (R18: provider ≠ credential).
    if (res.status === 401 || res.status === 403) return null;
    if (DEGRADED.has(res.status) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }
    return null;
  }
  return null;
}

/**
 * Stream a chat completion from the direct provider for `modelId`, pushing
 * text fragments to `onDelta`. Returns the final aggregated text + metadata,
 * or null on missing key / non-2xx / empty body so the caller can fall back to
 * the platform path. Honors `signal` so the client `stop()` aborts upstream.
 */
export async function streamDirectProvider(
  modelId: string,
  messages: ProviderChatMessage[],
  cb: StreamCallbacks,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<ProviderResult | null> {
  const provider = providerForModel(modelId);
  if (provider === "platform" || !isConfigured(provider)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  const started = Date.now();
  const model = stripPrefix(modelId);
  try {
    let body: ReadableStream<Uint8Array> | null = null;
    let collect: (payload: string) => boolean | void;
    let acc = "";

    if (provider === "openai") {
      const res = await fetchWithDegradationRetry(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({ model, messages, stream: true, max_tokens: 4096 }),
        },
        controller.signal,
      );
      if (!res || !res.body) return null;
      body = res.body;
      collect = (payload) => {
        if (payload === "[DONE]") return false;
        try {
          const j = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const piece = j.choices?.[0]?.delta?.content;
          if (piece) {
            acc += piece;
            cb.onDelta(piece);
          }
        } catch {
          /* ignore keep-alive / partial frames */
        }
      };
    } else if (provider === "anthropic") {
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const userAssistant = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await fetchWithDegradationRetry(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            system: system || undefined,
            messages: userAssistant,
            max_tokens: 4096,
            stream: true,
          }),
        },
        controller.signal,
      );
      if (!res || !res.body) return null;
      body = res.body;
      collect = (payload) => {
        try {
          const j = JSON.parse(payload) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (j.type === "content_block_delta" && j.delta?.text) {
            acc += j.delta.text;
            cb.onDelta(j.delta.text);
          }
          if (j.type === "message_stop") return false;
        } catch {
          /* ignore */
        }
      };
    } else {
      // google / gemini — :streamGenerateContent with alt=sse
      const systemText = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
      const reqBody: Record<string, unknown> = {
        contents,
        generationConfig: { maxOutputTokens: 4096 },
      };
      if (systemText) reqBody.systemInstruction = { parts: [{ text: systemText }] };
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(process.env.GEMINI_API_KEY ?? "")}`;
      const res = await fetchWithDegradationRetry(
        url,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(reqBody),
        },
        controller.signal,
      );
      if (!res || !res.body) return null;
      body = res.body;
      collect = (payload) => {
        try {
          const j = JSON.parse(payload) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const piece = (j.candidates?.[0]?.content?.parts ?? [])
            .map((p) => p?.text ?? "")
            .join("");
          if (piece) {
            acc += piece;
            cb.onDelta(piece);
          }
        } catch {
          /* ignore */
        }
      };
    }

    await consumeSse(body, collect);
    const text = acc.trim();
    if (!text) return null;
    return { text, provider, model, latencyMs: Date.now() - started };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// AUR-16: OpenAI function-calling round (one bounded step of the agentic loop).
// Non-streaming on purpose — tool resolution happens off-screen, then the final
// user-visible answer streams via `streamDirectProvider`. Only OpenAI is wired
// for tools today; other providers fall through to plain streaming.
// ───────────────────────────────────────────────────────────────────────────

export type OpenAiToolSchema = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type OpenAiToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type OpenAiToolRound =
  | { kind: "final"; text: string }
  | { kind: "tool_calls"; calls: OpenAiToolCall[]; assistantRaw: unknown };

/** Run one OpenAI chat round that may return tool calls. */
export async function openAiToolRound(
  modelId: string,
  messages: unknown[],
  tools: OpenAiToolSchema[],
  signal: AbortSignal,
): Promise<OpenAiToolRound | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = stripPrefix(modelId);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    // Only advertise tools when there are some. The post-loop final-answer call
    // passes an empty array, and `tools: [] + tool_choice: "auto"` can be
    // rejected (400) by OpenAI — omit both in that case.
    body: JSON.stringify({
      model,
      messages,
      ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
    }),
    signal,
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
        tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>;
      };
    }>;
  };
  const msg = json.choices?.[0]?.message;
  if (!msg) return null;
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    return {
      kind: "tool_calls",
      assistantRaw: msg,
      calls: msg.tool_calls.map((c) => ({
        id: c.id,
        name: c.function?.name ?? "",
        arguments: c.function?.arguments ?? "{}",
      })),
    };
  }
  return { kind: "final", text: (msg.content ?? "").trim() };
}
