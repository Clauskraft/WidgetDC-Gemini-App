/**
 * GF-PR4: POST /api/receipts — the browser's only door into the P2 adoption
 * flywheel (canvas fold-outs + strip expansions feed intent-confidence).
 *
 * Strict whitelist ingress: only the two feedback-eligible interaction kinds
 * and the two runtime-verified producing tools cross the wire, and the intent
 * hint is derived SERVER-side from the tool — the client cannot inject free
 * text toward the backend. Everything answers 202: invalid payloads are
 * dropped silently (no probing surface), and a failing backend dispatch never
 * surfaces to the browser (fail-soft, same doctrine as the chat receipt).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildUiReceipt, sendInteractionReceipt } from "@/lib/interaction-receipts.server";
import { RECEIPT_TOOL_HINTS, UI_RECEIPT_INTERACTIONS } from "@/lib/uiReceiptContract";

const receiptRequestSchema = z.object({
  interaction: z.enum(UI_RECEIPT_INTERACTIONS),
  entity_id: z.string().min(1).max(240),
  producing_tool: z
    .string()
    .refine((tool): tool is keyof typeof RECEIPT_TOOL_HINTS => tool in RECEIPT_TOOL_HINTS),
  session_id: z.string().max(240).optional(),
});

function accepted(ok: boolean): Response {
  return new Response(JSON.stringify({ accepted: ok }), {
    status: 202,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/receipts")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return accepted(false);
        }
        // Pre-clamp entity_id so an oversized (but honest) id degrades to its
        // prefix instead of being dropped wholesale.
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          const entity = (raw as Record<string, unknown>).entity_id;
          if (typeof entity === "string" && entity.length > 240) {
            (raw as Record<string, unknown>).entity_id = entity.slice(0, 240);
          }
        }
        const parsed = receiptRequestSchema.safeParse(raw);
        if (!parsed.success) return accepted(false);

        const receipt = buildUiReceipt({
          interaction: parsed.data.interaction,
          templateId: "gemini-frontend:/api/receipts",
          entityId: parsed.data.entity_id,
          intentHint: RECEIPT_TOOL_HINTS[parsed.data.producing_tool] ?? null,
          producingTool: parsed.data.producing_tool,
          sessionId: parsed.data.session_id,
          outcome: "success",
        });
        void sendInteractionReceipt(receipt).catch(() => {});
        return accepted(true);
      },
    },
  },
});
