import { createFileRoute } from "@tanstack/react-router";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { z } from "zod";
import { isPlatformConfigured } from "@/lib/widgetdc.server";

// ── WDC Chat ONLY — same behavior as `wdc chat` CLI ─────────────────────
const WDC_BACKEND = process.env.WDC_BACKEND_URL || "https://backend-production-d3da.up.railway.app";
const WDC_TOKEN = process.env.WIDGETDC_BEARER_TOKEN || process.env.WIDGETDC_API_KEY;

const routeSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  })),
  model: z.string().optional(),
  deep: z.boolean().optional(),
  council: z.boolean().optional(),
});

const Route = createFileRoute("/api/chat")({
  method: "POST",
  validate: routeSchema,
  handler: async ({ request }) => {
    const correlationId = crypto.randomUUID();
    const body = routeSchema.parse(await request.json());
    const lastUser = [...body.messages].reverse().find((m) => m.role === "user");

    // WDC Chat ONLY — full intelligence chain
    if (!isPlatformConfigured()) {
      return new Response("WDC Chat unavailable", { status: 503 });
    }

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const textId = crypto.randomUUID();
        writer.write({ type: "start", messageId: crypto.randomUUID() });
        writer.write({ type: "start-step" });
        writer.write({ type: "text-start", id: textId });

        // Same as `wdc chat` — calls /api/intent-gateway/route
        const resp = await fetch(`${WDC_BACKEND}/api/intent-gateway/route`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${WDC_TOKEN}`,
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
          },
          body: JSON.stringify({
            intent: lastUser?.content || "",
            preferences: { method: "auto", agent: "auto", tier: 2, include_evidence: true },
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
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            for (const l of lines) {
              if (l.startsWith("data: ")) {
                try {
                  const ev = JSON.parse(l.slice(6));
                  if (ev.type === "token") writer.write({ type: "text", text: ev.content });
                } catch { /* skip malformed */ }
              }
            }
          }
        } else {
          writer.write({ type: "text", text: `[WDC Chat error: HTTP ${resp.status}]` });
        }

        writer.write({ type: "text-end", id: textId });
        writer.write({ type: "end-step" });
        writer.write({ type: "end", finishReason: "stop" });
      },
      generateId: crypto.randomUUID,
      onError: (e) => console.error("[WDC Chat] Stream error:", e),
    });

    return createUIMessageStreamResponse(stream);
  },
});

export default Route;
