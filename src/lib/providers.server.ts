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
