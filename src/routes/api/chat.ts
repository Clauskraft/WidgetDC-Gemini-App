import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import {
  isPlatformConfigured,
  orchestratorChat,
  type ChatMessage,
} from "@/lib/widgetdc.server";
import {
  callDirectProvider,
  providerConfigured,
  providerForModel,
} from "@/lib/providers.server";

const SYSTEM_PROMPT = `You are WidgeTDC Aurora — a precise, consultant-grade assistant. You help users reason about complex artifacts, governance, runtime models, and architecture.

Style:
- Be concise, structured, and use Markdown (headings, lists, code blocks).
- When useful, surface "Canvas notes" — short bullet summaries the user can pin.
- Default to Danish if the user writes Danish, otherwise English.`;

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

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages?: unknown;
          model?: string;
          system?: string;
          deep?: boolean;
        };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const messages = body.messages as UIMessage[];
        const correlationId =
          request.headers.get("x-correlation-id") ?? crypto.randomUUID();

        const system =
          typeof body.system === "string" && body.system.trim().length > 0
            ? body.system
            : SYSTEM_PROMPT;

        const modelMessages = (await convertToModelMessages(messages)) as Array<{
          role: string;
          content: unknown;
        }>;
        const chatMessages: ChatMessage[] = [
          { role: "system", content: system },
          ...toChatMessages(modelMessages),
        ];

        // ROUTING:
        // - Direct provider (OpenAI / Gemini / Anthropic) if the model id maps
        //   to a configured provider and Deep mode is OFF. This is what makes
        //   the user's model picker actually mean something — the WidgeTDC
        //   backend MCP route's reason_deeply ignores provider/model overrides
        //   and always returns gemini-2.5-flash-lite.
        // - Otherwise (Deep mode ON, unknown provider, missing key, or platform
        //   chosen) fall through to reason_deeply (RLM): it owns provider
        //   selection per domain and surfaces a rich reasoning chain.
        const deep = body.deep === true;
        const requestedProvider = providerForModel(body.model);
        const useDirect =
          !deep &&
          requestedProvider !== "platform" &&
          providerConfigured(requestedProvider);

        let answerText: string | null = null;
        let answerMeta: import("@/lib/widgetdc.server").ChatReasoningMeta = {};
        let usedPath: "direct" | "platform" = "platform";

        if (useDirect && body.model) {
          const direct = await callDirectProvider(body.model, chatMessages);
          if (direct) {
            answerText = direct.text;
            answerMeta = {
              provider: direct.provider,
              model: direct.model,
              latencyMs: direct.latencyMs,
            };
            usedPath = "direct";
          }
        }

        if (!answerText) {
          if (!isPlatformConfigured()) {
            return new Response(
              "No chat provider available — configure OPENAI_API_KEY/GEMINI_API_KEY/ANTHROPIC_API_KEY for the chosen model, or WIDGETDC_API_KEY for the platform RLM.",
              { status: 503, headers: { "x-correlation-id": correlationId } },
            );
          }
          const chatResult = await orchestratorChat(chatMessages, { correlationId, deep });
          if (chatResult) {
            answerText = chatResult.text;
            answerMeta = chatResult.meta;
            usedPath = "platform";
          }
        }

        if (!answerText) {
          return new Response(
            "Chat provider did not return a response (direct provider failed and reason_deeply unavailable).",
            { status: 502, headers: { "x-correlation-id": correlationId } },
          );
        }

        // Emit the answer as an AI-SDK v6 UI message stream so useChat() renders
        // it. The FULL frame sequence is required — useChat only creates the
        // assistant UIMessage when it sees the message-level `start` chunk.
        //
        // Only emit `data-reasoning` for the platform RLM path: direct providers
        // don't return reasoning chains, and a misplaced data part caused useChat
        // to silently drop the assistant message in earlier iterations.
        const finalText = answerText;
        const meta = answerMeta;
        const emitReasoning =
          usedPath === "platform" &&
          meta &&
          Object.values(meta).some((v) => v != null && v !== "");

        const stream = createUIMessageStream({
          execute: ({ writer }) => {
            const id = crypto.randomUUID();
            const messageId = crypto.randomUUID();
            writer.write({ type: "start", messageId });
            writer.write({ type: "start-step" });
            if (emitReasoning) {
              writer.write({
                type: "data-reasoning",
                id: crypto.randomUUID(),
                data: meta,
              });
            }
            writer.write({ type: "text-start", id });
            writer.write({ type: "text-delta", id, delta: finalText });
            writer.write({ type: "text-end", id });
            writer.write({ type: "finish-step" });
            writer.write({ type: "finish" });
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
