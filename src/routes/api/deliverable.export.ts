/**
 * POST /api/deliverable/export — Output Forge (Phase 1b).
 *
 * Renders a brief to a downloadable DOCX/PDF via the platform `produce_document`
 * tool and returns base64 bytes + filename + mime for client-side download.
 * Server-only: keys read inside the handler.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isPlatformConfigured, produceDocument } from "@/lib/widgetdc.server";

const BodySchema = z.object({
  brief: z.string().min(10, "Brief must be at least 10 characters"),
  format: z.enum(["docx", "pdf"]),
  title: z.string().max(120).optional(),
});

function json(body: unknown, status: number, correlationId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-correlation-id": correlationId },
  });
}

export const Route = createFileRoute("/api/deliverable/export")({
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

        const { brief, format, title } = parsed.data;
        const doc = await produceDocument(brief, format, { correlationId, title });
        if (!doc) {
          return json(
            { error: "Document render failed or timed out — try a tighter brief." },
            502,
            correlationId,
          );
        }

        return json({ ...doc, correlationId }, 200, correlationId);
      },
    },
  },
});
