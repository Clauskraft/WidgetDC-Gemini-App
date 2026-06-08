import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  isPlatformConfigured,
  orchestratorChat,
  councilChat,
  llmChatCompletion,
  fetchRagGrounding,
  modelPolicyPreflight,
  storeChatMemory,
  type ChatMessage,
  type RagSource,
} from "@/lib/widgetdc.server";
import {
  callDirectProvider,
  streamDirectProvider,
  openAiToolRound,
  providerConfigured,
  providerForModel,
} from "@/lib/providers.server";
import {
  agenticToolsEnabled,
  executeToolCall,
  CHAT_TOOL_SCHEMAS,
  MAX_TOOL_ROUNDS,
} from "@/lib/chatTools.server";

const SYSTEM_PROMPT = `You are WidgeTDC Aurora — a precise, consultant-grade assistant. You help users reason about complex artifacts, governance, runtime models, and architecture.

Method (Consulting Partner): MECE decomposition, Pyramid Principle (answer first, then the structured support), hypothesis-driven, every claim backed by evidence.

Style:
- Answer first, then develop the reasoning in clear sections.
- Be thorough and specific: give a complete, multi-section answer with headings, lists, tables and code where useful — not a 1–2 line summary. For any non-trivial question, aim for real depth (typically several hundred words).
- Surface "Canvas notes" — short bullet summaries the user can pin.
- Default to Danish if the user writes Danish, otherwise English.
- When the provided WidgeTDC knowledge context is relevant, ground your answer in it and cite sources as [n].`;

const BodySchema = z.object({
  messages: z.array(z.unknown()),
  model: z.string().optional(),
  system: z.string().optional(),
  deep: z.boolean().optional(),
  council: z.boolean().optional(),
});

/** Flatten AI-SDK model messages to plain {role,content} for the orchestrator. */
function toChatMessages(modelMessages: Array<{ role: string; content: unknown }>): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of modelMessages) {
    const role = m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user";
    let content = "";
    if (typeof m.content === "string") {
      content = m.content;
    } else if (Array.isArray(m.content)) {
      content = (m.content as Array<{ type?: string; text?: string }>)
        .filter((p) => p && (p.type === "text" || typeof p.text === "string"))
        .map((p) => p.text ?? "")
        .join("");
    }
    if (content.trim()) out.push({ role, content });
  }
  return out;
}

/** Word-chunk a final string so non-streaming paths still render progressively. */
function* chunkText(text: string, size = 24): Generator<string> {
  // Split on word boundaries; emit ~`size`-char groups so the client sees the
  // answer build up rather than appear in one blob (graceful pseudo-stream).
  const tokens = text.match(/\S+\s*/g) ?? [text];
  let buf = "";
  for (const t of tokens) {
    buf += t;
    if (buf.length >= size) {
      yield buf;
      buf = "";
    }
  }
  if (buf) yield buf;
}

/**
 * AUR-16 agentic loop (OpenAI only, opt-in via CHAT_AGENTIC_TOOLS=1). Runs a
 * bounded tool-calling loop and returns the final answer text once the model
 * stops requesting tools, or null to let the caller fall back to streaming.
 */
async function agenticAnswer(
  model: string,
  messages: ChatMessage[],
  signal: AbortSignal,
  correlationId?: string,
): Promise<{ text: string; toolNames: string[] } | null> {
  const convo: unknown[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const toolNames: string[] = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const r = await openAiToolRound(model, convo, CHAT_TOOL_SCHEMAS, signal);
    if (!r) return null;
    if (r.kind === "final") {
      // No tools were ever used → let the caller stream a fresh call instead.
      if (toolNames.length === 0) return null;
      return { text: r.text, toolNames };
    }
    // tool_calls — append assistant turn + execute each tool, feed results back.
    convo.push(r.assistantRaw);
    for (const call of r.calls) {
      toolNames.push(call.name);
      const exec = await executeToolCall(call, correlationId);
      convo.push({ role: "tool", tool_call_id: exec.toolCallId, content: exec.content });
    }
  }
  // Exhausted rounds — ask once more for a plain answer.
  const final = await openAiToolRound(model, convo, [], signal);
  if (final && final.kind === "final" && final.text) return { text: final.text, toolNames };
  return null;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Correlation id first, so EVERY response path — including the 400
        // below — is traceable in logs.
        const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();

        const raw = await request.json();
        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) {
          return new Response("Messages are required", {
            status: 400,
            headers: { "x-correlation-id": correlationId },
          });
        }
        const body = parsed.data;
        const messages = body.messages as UIMessage[];

        const system =
          typeof body.system === "string" && body.system.trim().length > 0
            ? body.system
            : SYSTEM_PROMPT;

        const modelMessages = (await convertToModelMessages(messages)) as Array<{
          role: string;
          content: unknown;
        }>;
        const baseMessages = toChatMessages(modelMessages);
        const lastUser = [...baseMessages].reverse().find((m) => m.role === "user");

        const deep = body.deep === true;
        // Council (Mixture-of-Agents) is a platform-only multi-agent path, so it
        // bypasses the direct-provider route just like Deep mode does.
        const council = body.council === true;
        const requestedProvider = providerForModel(body.model);
        const useDirect =
          !deep &&
          !council &&
          requestedProvider !== "platform" &&
          providerConfigured(requestedProvider);

        // F3: governance preflight on whichever model we are about to call.
        if (useDirect && body.model) {
          const policy = await modelPolicyPreflight(body.model, correlationId);
          if (!policy.allowed) {
            return new Response(`Model blocked by policy: ${policy.reason ?? "denied"}`, {
              status: 403,
              headers: { "x-correlation-id": correlationId },
            });
          }
        }

        if (!useDirect && !isPlatformConfigured()) {
          return new Response(
            "No chat provider available — configure OPENAI_API_KEY/GEMINI_API_KEY/ANTHROPIC_API_KEY for the chosen model, or WIDGETDC_BEARER_TOKEN (legacy: WIDGETDC_API_KEY) for the platform RLM.",
            { status: 503, headers: { "x-correlation-id": correlationId } },
          );
        }

        const stream = createUIMessageStream({
          execute: async ({ writer }) => {
            const textId = crypto.randomUUID();
            const messageId = crypto.randomUUID();
            writer.write({ type: "start", messageId });
            writer.write({ type: "start-step" });

            // AUR-14 grounding lives INSIDE the stream so the client receives
            // start/start-step immediately — perceived TTFT is not blocked by
            // the up-to-~8s grounding fetch (which previously ran before the
            // response was even constructed). Build the grounded prompt +
            // sources here, then emit the sources part before the text.
            let sources: RagSource[] = [];
            let groundedSystem = system;
            if (lastUser) {
              const grounding = await fetchRagGrounding(lastUser.content, correlationId);
              if (grounding && grounding.context) {
                sources = grounding.sources;
                groundedSystem = `${system}\n\n# WidgeTDC knowledge context (cite as [n])\n${grounding.context}`;
              }
            }
            const chatMessages: ChatMessage[] = [
              { role: "system", content: groundedSystem },
              ...baseMessages,
            ];
            if (sources.length > 0) {
              writer.write({ type: "data-sources", id: crypto.randomUUID(), data: { sources } });
            }

            writer.write({ type: "text-start", id: textId });

            let meta: import("@/lib/widgetdc.server").ChatReasoningMeta = {};
            let produced = false;

            // ── Path A: direct provider, TRUE token streaming (AUR-15) ──
            if (useDirect && body.model) {
              // Optional agentic tool loop (OpenAI, opt-in) before final answer.
              if (agenticToolsEnabled() && requestedProvider === "openai") {
                const agentic = await agenticAnswer(
                  body.model,
                  chatMessages,
                  request.signal,
                  correlationId,
                );
                if (agentic) {
                  for (const piece of chunkText(agentic.text)) {
                    writer.write({ type: "text-delta", id: textId, delta: piece });
                  }
                  meta = { provider: requestedProvider, model: body.model };
                  produced = true;
                }
              }

              if (!produced) {
                const result = await streamDirectProvider(
                  body.model,
                  chatMessages,
                  { onDelta: (delta) => writer.write({ type: "text-delta", id: textId, delta }) },
                  { signal: request.signal },
                );
                if (result) {
                  meta = {
                    provider: result.provider,
                    model: result.model,
                    latencyMs: result.latencyMs,
                  };
                  produced = true;
                } else if (!request.signal.aborted) {
                  // Streaming failed (not a client abort) — try a one-shot direct
                  // call before falling through to the platform path. Skip when
                  // the client aborted: callDirectProvider is non-abortable and
                  // would keep generating (and billing) after stop().
                  const direct = await callDirectProvider(body.model, chatMessages);
                  if (direct) {
                    for (const piece of chunkText(direct.text)) {
                      writer.write({ type: "text-delta", id: textId, delta: piece });
                    }
                    meta = {
                      provider: direct.provider,
                      model: direct.model,
                      latencyMs: direct.latencyMs,
                    };
                    produced = true;
                  }
                }
              }
            }

            // ── Path B: platform (council MoA, deep RLM reflection, or llm_chat) ──
            if (!produced && !request.signal.aborted && isPlatformConfigured()) {
              const chatResult = council
                ? await councilChat(chatMessages, { correlationId })
                : deep
                  ? await orchestratorChat(chatMessages, { correlationId, deep: true })
                  : ((await llmChatCompletion(chatMessages, {
                      correlationId,
                      model: body.model,
                    })) ?? (await orchestratorChat(chatMessages, { correlationId, deep: false })));
              if (chatResult?.text) {
                for (const piece of chunkText(chatResult.text)) {
                  writer.write({ type: "text-delta", id: textId, delta: piece });
                }
                meta = chatResult.meta;
                produced = true;
              }
            }

            if (!produced) {
              writer.write({
                type: "text-delta",
                id: textId,
                delta:
                  "⚠️ Chat-udbyderen returnerede ikke et svar (direkte udbyder fejlede og platform-RLM utilgængelig).",
              });
            }

            writer.write({ type: "text-end", id: textId });

            // Reasoning/meta envelope after the text (known post-completion for
            // streaming). Same `data-reasoning` part the client already renders.
            const emitReasoning = meta && Object.values(meta).some((v) => v != null && v !== "");
            if (emitReasoning) {
              writer.write({ type: "data-reasoning", id: crypto.randomUUID(), data: meta });
            }

            writer.write({ type: "finish-step" });
            writer.write({ type: "finish" });

            // AUR-6: best-effort memory persistence (does not block the stream).
            if (produced && lastUser) {
              void storeChatMemory(
                "widgetdc-aurora-chat",
                `turn/${correlationId}`,
                { query: lastUser.content.slice(0, 200), provider: meta.provider ?? "platform" },
                correlationId,
              ).catch(() => {});
            }
          },
        });

        return createUIMessageStreamResponse({
          stream,
          headers: { "x-correlation-id": correlationId },
        });
      },
    },
  },
});
