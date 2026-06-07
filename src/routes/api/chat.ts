import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { fetchRagGrounding, isPlatformConfigured } from "@/lib/widgetdc.server";

const SYSTEM_PROMPT = `You are WidgeTDC Aurora — a precise, consultant-grade assistant inspired by Google Gemini. You help users reason about complex artifacts, governance, runtime models, and architecture.

Style:
- Be concise, structured, and use Markdown (headings, lists, code blocks).
- When useful, surface "Canvas notes" — short bullet summaries the user can pin.
- Default to Danish if the user writes Danish, otherwise English.`;

/** Pull the latest user text out of the UI message list for RAG grounding. */
function latestUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const parts = (m as { parts?: Array<{ type: string; text?: string }> }).parts;
    if (Array.isArray(parts)) {
      const text = parts
        .filter((p) => p.type === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join(" ")
        .trim();
      if (text) return text;
    }
  }
  return "";
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages?: unknown;
          model?: string;
          system?: string;
        };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const messages = body.messages as UIMessage[];
        const correlationId =
          request.headers.get("x-correlation-id") ?? crypto.randomUUID();

        // AUR-1: ground the turn via the WidgeTDC orchestrator RAG cascade when
        // the platform is configured. Degrades silently to plain chat (Lovable
        // Gateway) if the platform is unreachable — the stream itself stays
        // client-side over the AI SDK protocol (MoA finding).
        let system =
          typeof body.system === "string" && body.system.trim().length > 0
            ? body.system
            : SYSTEM_PROMPT;

        if (isPlatformConfigured()) {
          const query = latestUserText(messages);
          if (query) {
            const grounding = await fetchRagGrounding(query, correlationId);
            if (grounding) {
              system += `\n\n## WidgeTDC knowledge grounding (retrieved)\nUse the following retrieved context when relevant; cite it as "Canvas notes" if helpful. Do not fabricate beyond it:\n${grounding}`;
            }
          }
        }

        const gateway = createLovableAiGatewayProvider(key);
        const modelId = body.model ?? "google/gemini-3-flash-preview";
        const result = streamText({
          model: gateway(modelId),
          system,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          headers: { "x-correlation-id": correlationId },
        });
      },
    },
  },
});
