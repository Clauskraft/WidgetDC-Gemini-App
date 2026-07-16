import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { dispatchChatReceiptFailSoft } from "@/lib/interaction-receipts.server";
import {
  fetchIntentDetection,
  fetchRagGrounding,
  isPlatformConfigured,
} from "@/lib/widgetdc.server";

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
    wdc_no_provider_probe: z.boolean().optional(),
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

function wantsNoProviderProbe(request: Request, body: z.infer<typeof routeSchema>): boolean {
  const header = request.headers.get("x-wdc-no-provider-probe")?.trim().toLowerCase();
  return body.wdc_no_provider_probe === true && (header === "1" || header === "true");
}

function noProviderProbeResponse(correlationId: string): Response {
  const encoder = new TextEncoder();
  const base = {
    mode: "no_provider_probe",
    correlation_id: correlationId,
    provider_calls: 0,
    graph_writes: 0,
    railway_mutations: 0,
    claim_promotions: 0,
    proof_boundary: "diagnostic_transport_probe",
  };
  const events = [
    ["wdc.probe.pending", { ...base, state: "pending", sequence: 1 }],
    ["wdc.probe.streaming", { ...base, state: "streaming", sequence: 2 }],
    [
      "wdc.probe.error_state_evidence",
      {
        ...base,
        state: "error",
        sequence: 3,
        simulated: true,
        http_status_unchanged: 200,
      },
    ],
    ["wdc.probe.complete", { ...base, state: "complete", sequence: 4 }],
  ] satisfies Array<[string, Record<string, unknown>]>;

  const stream = new ReadableStream({
    start(controller) {
      for (const [event, data] of events) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "x-correlation-id": correlationId,
      "x-wdc-no-provider-probe": "true",
    },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
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
        if (wantsNoProviderProbe(request, body)) {
          return noProviderProbeResponse(correlationId);
        }

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

            // GF-PR2: parallel enrichment. Intent-routing and RAG-grounding
            // fire CONCURRENTLY with the backend stream and write their parts
            // the moment they resolve (usually mid-stream) — the first token
            // is never blocked, and a failed helper emits nothing. The shapes
            // map 1:1 onto the data-reasoning / data-sources parts the client
            // already consumes (ChatWindow AUR-5 / AUR-14).
            let streamClosed = false;
            const enrich = process.env.WDC_CHAT_ENRICH !== "0";
            const enrichmentWrites: Promise<void>[] = [];
            if (enrich) {
              enrichmentWrites.push(
                fetchIntentDetection(intent, correlationId)
                  .then((detection) => {
                    const top = detection?.candidates?.[0];
                    if (!top || streamClosed) return;
                    writer.write({
                      type: "data-reasoning",
                      id: "reasoning",
                      data: {
                        intentTool: top.tool,
                        intentScore: top.score,
                        intentCandidates: detection.candidates.slice(0, 5).map((c) => c.tool),
                      },
                    });
                  })
                  .catch(() => {}),
                fetchRagGrounding(intent, correlationId)
                  .then((grounding) => {
                    if (!grounding?.sources?.length || streamClosed) return;
                    writer.write({
                      type: "data-sources",
                      id: "sources",
                      data: { sources: grounding.sources },
                    });
                  })
                  .catch(() => {}),
              );
            }

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

            // P2 adoption-flywheel receipt (LIN-2226): one observability-only
            // tool_launch per chat turn. Fire-and-forget fail-soft — can never
            // delay or fail the stream.
            dispatchChatReceiptFailSoft({
              sessionId: body.id,
              outcome: resp.ok ? "success" : "failure",
            });

            // Give in-flight enrichment a short grace window after the last
            // token (usually 0 — helpers resolved during streaming), then seal
            // the stream so late resolvers can never write after end.
            if (enrichmentWrites.length > 0) {
              await Promise.race([
                Promise.allSettled(enrichmentWrites),
                new Promise((resolve) => setTimeout(resolve, 2000)),
              ]);
            }
            streamClosed = true;

            writer.write({ type: "text-end", id: textId });
            writer.write({ type: "end-step" });
            writer.write({ type: "end", finishReason: "stop" });
          },
          generateId: () => crypto.randomUUID(),
          onError: (e) => console.error("[WDC Chat] Stream error:", e),
        });

        return createUIMessageStreamResponse({
          stream,
          headers: {
            "x-correlation-id": correlationId,
            "Cache-Control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});
