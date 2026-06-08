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
        if (!isPlatformConfigured()) {
          return new Response(
            "WidgeTDC platform not configured — set WIDGETDC_API_KEY (or MCP_AGENT_API_KEY) and WIDGETDC_BACKEND_URL.",
            { status: 503 },
          );
        }

        const messages = body.messages as UIMessage[];
        const correlationId =
          request.headers.get("x-correlation-id") ?? crypto.randomUUID();

        // reason_deeply (RLM) performs its own retrieval/RAG internally, so no
        // separate grounding call is needed here.
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

        // Provider/model selection is owned by the platform RLM (reason_deeply
        // routes per domain). correlation_id threads through for audit. AUR-5:
        // `deep` triggers RLM reflection and surfaces reasoning chain + quality.
        const deep = body.deep === true;
        const chatResult = await orchestratorChat(chatMessages, { correlationId, deep });

        if (chatResult == null) {
          return new Response(
            "WidgeTDC platform did not return a response (reason_deeply unavailable or timed out).",
            { status: 502, headers: { "x-correlation-id": correlationId } },
          );
        }

        // Emit the platform answer as an AI-SDK UI message stream so the client
        // useChat() transport renders it unchanged.
        //
        // The full message-frame sequence is required. useChat's read path only
        // CREATES the assistant UIMessage when it sees the message-level `start`
        // chunk (it seeds state.message.id from messageId). Emitting only
        // text-start/text-delta/text-end (no start/finish) makes useChat silently
        // drop the whole message — 200 + valid SSE but nothing renders. This is
        // exactly the sequence the SDK's own toUIMessageStream() emits.
        //
        // AUR-5: alongside the text part, we emit a custom `data-reasoning` part
        // carrying the RLM reasoning chain, confidence, quality, and routing.
        // The client renders it as a pinnable Canvas note when present.
        const stream = createUIMessageStream({
          execute: ({ writer }) => {
            const id = crypto.randomUUID();
            const messageId = crypto.randomUUID();
            const hasMeta =
              chatResult.meta &&
              Object.values(chatResult.meta).some((v) => v != null && v !== "");

            writer.write({ type: "start", messageId });
            writer.write({ type: "start-step" });
            // Emit the custom data-reasoning part BEFORE the text part. The AI
            // SDK v6 UI-message read path attaches data-* parts to the message
            // in order; placing it after text-end + before finish-step caused
            // useChat to drop the whole assistant message on persistence.
            // Emitting it before text-start makes the data part settle into
            // message.parts cleanly so both render and persistence include it.
            if (hasMeta) {
              writer.write({
                type: "data-reasoning",
                id: crypto.randomUUID(),
                data: chatResult.meta,
              });
            }
            writer.write({ type: "text-start", id });
            writer.write({ type: "text-delta", id, delta: chatResult.text });
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
