/**
 * POST /api/deliverable/generate — Deliverable Studio (Phase 1).
 *
 * Turns a free-form brief into a consulting deliverable (analysis / roadmap /
 * assessment) via the platform `generate_deliverable` tool (RAG-backed,
 * citation-bearing markdown), with an optional `judge_response` PRISM quality
 * pass. Server-only: keys live in process.env, read inside the handler.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  isPlatformConfigured,
  generateDeliverable,
  deliverableDraft,
  judgeDeliverable,
} from "@/lib/widgetdc.server";

const BodySchema = z.object({
  brief: z.string().min(10, "Brief must be at least 10 characters"),
  kind: z.enum(["analysis", "roadmap", "assessment"]),
  maxSections: z.number().int().min(2).max(8).optional(),
  validate: z.boolean().optional(),
  // "rag" = generate_deliverable (fast); "lego" = deliverable_draft Lego Factory
  // pipeline (Plan→Retrieve→Write→Assemble→Render, citation-backed).
  engine: z.enum(["rag", "lego"]).optional(),
});

function json(body: unknown, status: number, correlationId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-correlation-id": correlationId },
  });
}

export const Route = createFileRoute("/api/deliverable/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400, correlationId);
        }

        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) {
          return json(
            { error: "Invalid request", details: parsed.error.flatten() },
            422,
            correlationId,
          );
        }

        if (!isPlatformConfigured()) {
          return json(
            {
              error:
                "Platform not configured — set WIDGETDC_BEARER_TOKEN (legacy: WIDGETDC_API_KEY) + WIDGETDC_BACKEND_URL.",
            },
            503,
            correlationId,
          );
        }

        const { brief, kind, maxSections, validate, engine } = parsed.data;
        const deliverable =
          engine === "lego"
            ? await deliverableDraft(brief, kind, { correlationId, maxSections })
            : await generateDeliverable(brief, kind, { correlationId, maxSections });
        if (!deliverable) {
          return json(
            { error: "Deliverable generation failed or timed out — try a tighter brief." },
            502,
            correlationId,
          );
        }

        // Best-effort PRISM gate (default on); never blocks the deliverable.
        const quality =
          validate === false
            ? null
            : await judgeDeliverable(brief, deliverable.markdown, correlationId);

        return json(
          { ...deliverable, kind, engine: engine ?? "rag", quality, correlationId },
          200,
          correlationId,
        );
      },
    },
  },
});
