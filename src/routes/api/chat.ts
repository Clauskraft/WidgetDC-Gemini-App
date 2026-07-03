import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { isPlatformConfigured } from "@/lib/widgetdc.server";

// ── WDC Chat ONLY — same behavior as `wdc chat` CLI ─────────────────────
const WDC_BACKEND =
  process.env.WIDGETDC_BACKEND_URL ||
  process.env.WDC_BACKEND_URL ||
  "https://backend-production-d3da.up.railway.app";
const WDC_TOKEN =
  process.env.WIDGETDC_BEARER_TOKEN ||
  process.env.WIDGETDC_MCP_KEY ||
  process.env.WIDGETDC_MCP_API_KEY ||
  process.env.WIDGETDC_API_KEY ||
  process.env.MCP_API_KEY ||
  process.env.MCP_AGENT_API_KEY ||
  process.env.CAPTAIN_RUNTIME_BEARER ||
  process.env.CAPTAIN_API_BEARER ||
  process.env.BACKEND_API_KEY ||
  process.env.API_KEY ||
  process.env.MCP_AUTH_TOKEN;

const messagePartSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough();

const messageSchema = z
  .object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().optional(),
    parts: z.array(messagePartSchema).optional(),
  })
  .passthrough();

const routeSchema = z
  .object({
    id: z.string().optional(),
    messages: z.array(messageSchema),
    model: z.string().optional(),
    deep: z.boolean().optional(),
    council: z.boolean().optional(),
  })
  .passthrough();

type ChatMessage = z.infer<typeof messageSchema>;

function messageText(message: ChatMessage | undefined): string {
  if (!message) return "";
  if (typeof message.content === "string" && message.content.trim()) return message.content;
  if (!Array.isArray(message.parts)) return "";
  return message.parts
    .map((part) => (part.type === "text" && typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

function parseSseDataLine(line: string): unknown | null {
  if (!line.startsWith("data:")) return null;
  const raw = line.slice(5).trimStart();
  if (!raw || raw === "[DONE]") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function tokenText(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const record = event as Record<string, unknown>;
  if (record.type !== "token" && record.type !== "text" && record.type !== "message") return null;
  const value = record.content ?? record.text ?? record.delta;
  return typeof value === "string" ? value : null;
}

function chatPreferences(body: z.infer<typeof routeSchema>) {
  return {
    method: body.deep ? "RLM" : undefined,
    agent: undefined,
    tier: body.deep ? 3 : body.council ? 2 : undefined,
    include_evidence: true,
  };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const correlationId = crypto.randomUUID();
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return new Response("Expected JSON body", { status: 400 });
        }
        const parsed = routeSchema.safeParse(json);
        if (!parsed.success) {
          return new Response(parsed.error.message, { status: 400 });
        }
        const body = parsed.data;
        const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
        const intent = messageText(lastUser);

        // WDC Chat ONLY — full intelligence chain.
        if (!isPlatformConfigured() || !WDC_TOKEN || !intent) {
          return new Response("WDC Chat unavailable", { status: 503 });
        }

        const stream = createUIMessageStream({
          execute: async ({ writer }) => {
            const textId = crypto.randomUUID();
            writer.write({ type: "start", messageId: crypto.randomUUID() });
            writer.write({ type: "start-step" });
            writer.write({ type: "text-start", id: textId });

            const resp = await fetch(`${WDC_BACKEND}/api/wdc-chat/stream`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${WDC_TOKEN}`,
                "Content-Type": "application/json",
                Accept: "text/event-stream",
                "x-correlation-id": correlationId,
              },
              body: JSON.stringify({
                message: intent,
                session_id: body.id,
                preferences: chatPreferences(body),
              }),
              signal: AbortSignal.timeout(120000),
            });

            if (resp.ok && resp.body) {
              const reader = resp.body.getReader();
              const dec = new TextDecoder();
              let buf = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split(/\r?\n/);
                buf = lines.pop() || "";
                for (const l of lines) {
                  const ev = parseSseDataLine(l);
                  const text = tokenText(ev);
                  if (text) writer.write({ type: "text", text });
                }
              }
              buf += dec.decode();
              for (const l of buf.split(/\r?\n/)) {
                const ev = parseSseDataLine(l);
                const text = tokenText(ev);
                if (text) writer.write({ type: "text", text });
              }
            } else {
              writer.write({ type: "text", text: `[WDC Chat error: HTTP ${resp.status}]` });
            }

            writer.write({ type: "text-end", id: textId });
            writer.write({ type: "end-step" });
            writer.write({ type: "end", finishReason: "stop" });
          },
          generateId: () => crypto.randomUUID(),
          onError: (e) => console.error("[WDC Chat] Stream error:", e),
        });

        return createUIMessageStreamResponse({ stream });
      },
    },
  },
});
