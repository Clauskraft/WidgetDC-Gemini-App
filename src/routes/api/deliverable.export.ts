/**
 * POST /api/deliverable/export — Output Forge (Phase 1b).
 *
 * Renders a brief to a downloadable DOCX/PDF via the platform `produce_document`
 * tool and returns base64 bytes + filename + mime for client-side download.
 * Server-only: keys read inside the handler.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { renderMarkdownDocumentFallback } from "@/lib/documentFallback.server";
import { logServer, summarizeError } from "@/lib/server-logger";
import {
  isPlatformConfigured,
  produceDocument,
  generateDeliverable,
  deliverableDraft,
  longformGenerate,
} from "@/lib/widgetdc.server";

const BodySchema = z.object({
  brief: z.string().min(10, "Brief must be at least 10 characters"),
  format: z.enum(["docx", "pdf"]),
  title: z.string().max(120).optional(),
  markdown: z.string().min(1).optional(),
  kind: z.enum(["analysis", "roadmap", "assessment"]).optional(),
  engine: z.enum(["rag", "lego", "longform"]).optional(),
  maxSections: z.number().int().min(2).max(8).optional(),
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
        const started = Date.now();

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

        const {
          brief,
          format,
          title,
          markdown,
          kind = "analysis",
          engine = "rag",
          maxSections,
        } = parsed.data;
        logServer("info", {
          event: "deliverable_export_start",
          requestId: correlationId,
          format,
          kind,
          engine,
          hasMarkdown: Boolean(markdown?.trim()),
          briefChars: brief.length,
        });

        try {
          if (markdown?.trim()) {
            const doc = renderMarkdownDocumentFallback(markdown, format, {
              title,
              filenameBase: title ?? `deliverable-${kind}`,
            });
            logServer("info", {
              event: "deliverable_export_success",
              requestId: correlationId,
              format,
              renderer: "local_markdown",
              durationMs: Date.now() - started,
            });
            return json({ ...doc, correlationId, renderer: "local_markdown" }, 200, correlationId);
          }

          if (isPlatformConfigured()) {
            const platformDoc = await produceDocument(brief, format, { correlationId, title });
            if (platformDoc) {
              logServer("info", {
                event: "deliverable_export_success",
                requestId: correlationId,
                format,
                renderer: "produce_document",
                durationMs: Date.now() - started,
              });
              return json(
                { ...platformDoc, correlationId, renderer: "produce_document" },
                200,
                correlationId,
              );
            }

            logServer("warn", {
              event: "deliverable_export_platform_fallback",
              requestId: correlationId,
              format,
              renderer: "produce_document",
              reason: "no artifact returned",
              durationMs: Date.now() - started,
            });

            const generated =
              engine === "longform"
                ? await longformGenerate(brief, kind, {
                    correlationId,
                    targetSections: maxSections,
                  })
                : engine === "lego"
                  ? await deliverableDraft(brief, kind, { correlationId, maxSections })
                  : await generateDeliverable(brief, kind, { correlationId, maxSections });
            if (generated?.markdown) {
              const doc = renderMarkdownDocumentFallback(generated.markdown, format, {
                title,
                filenameBase: title ?? `deliverable-${kind}`,
              });
              logServer("info", {
                event: "deliverable_export_success",
                requestId: correlationId,
                format,
                renderer: "local_generated_markdown",
                markdownChars: generated.markdown.length,
                durationMs: Date.now() - started,
              });
              return json(
                { ...doc, correlationId, renderer: "local_generated_markdown" },
                200,
                correlationId,
              );
            }
          } else {
            logServer("warn", {
              event: "deliverable_export_platform_not_configured",
              requestId: correlationId,
              format,
            });
          }

          const fallbackMarkdown = [
            `# ${title ?? `Deliverable ${kind}`}`,
            "",
            "## Brief",
            "",
            brief,
            "",
            "## Status",
            "",
            "Platform generation/rendering was unavailable, so this export contains the submitted brief only.",
            "",
            "Canvas notes:",
            "- Platform renderer did not return a document artifact.",
            "- Use the correlationId in server logs for follow-up debugging.",
            "- Re-run generation when the upstream document pipeline is healthy.",
          ].join("\n");
          const doc = renderMarkdownDocumentFallback(fallbackMarkdown, format, {
            title,
            filenameBase: title ?? `deliverable-${kind}`,
          });
          logServer("warn", {
            event: "deliverable_export_degraded_success",
            requestId: correlationId,
            format,
            renderer: "local_brief_fallback",
            durationMs: Date.now() - started,
          });
          return json(
            { ...doc, correlationId, renderer: "local_brief_fallback" },
            200,
            correlationId,
          );
        } catch (error) {
          logServer(
            "error",
            {
              event: "deliverable_export_exception",
              requestId: correlationId,
              format,
              durationMs: Date.now() - started,
              summary: summarizeError(error),
            },
            error,
          );
          return json({ error: "Document export crashed", correlationId }, 500, correlationId);
        }
      },
    },
  },
});
