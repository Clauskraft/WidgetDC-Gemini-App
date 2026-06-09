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
  fallbackDeliverable,
  emitDeliverableDegradedEvent,
} from "@/lib/widgetdc.server";

const BodySchema = z.object({
  brief: z.string().min(10, "Brief must be at least 10 characters"),
  format: z.enum(["docx", "pdf"]),
  title: z.string().max(120).optional(),
  markdown: z.string().min(1).optional(),
  kind: z.enum(["analysis", "roadmap", "assessment"]).optional(),
  engine: z.enum(["rag", "lego", "longform"]).optional(),
  maxSections: z.number().int().min(2).max(8).optional(),
  degraded: z.boolean().optional(),
  fallbackReason: z.string().max(120).optional(),
  fallbackSource: z.string().max(120).optional(),
});

function json(
  body: unknown,
  status: number,
  correlationId: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "x-correlation-id": correlationId,
      ...extraHeaders,
    },
  });
}

function degradedHeaders(reason: string, source: string): Record<string, string> {
  return {
    "X-WidgeTDC-Degraded": "true",
    "X-WidgeTDC-Fallback-Reason": reason,
    "X-WidgeTDC-Fallback-Source": source,
  };
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
          degraded: inheritedDegraded = false,
          fallbackReason: inheritedFallbackReason,
          fallbackSource: inheritedFallbackSource,
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
            const reason = inheritedFallbackReason ?? "client_supplied_degraded_markdown";
            const source = inheritedFallbackSource ?? "client_markdown";
            const doc = renderMarkdownDocumentFallback(markdown, format, {
              title,
              filenameBase: title ?? `deliverable-${kind}`,
            });
            logServer("info", {
              event: "deliverable_export_success",
              requestId: correlationId,
              format,
              renderer: "local_markdown",
              degraded: inheritedDegraded,
              fallbackReason: inheritedDegraded ? reason : undefined,
              fallbackSource: inheritedDegraded ? source : undefined,
              durationMs: Date.now() - started,
            });
            return json(
              {
                ...doc,
                correlationId,
                renderer: "local_markdown",
                degraded: inheritedDegraded,
                fallbackReason: inheritedDegraded ? reason : undefined,
                fallbackSource: inheritedDegraded ? source : undefined,
              },
              200,
              correlationId,
              inheritedDegraded ? degradedHeaders(reason, source) : {},
            );
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

            const primary =
              engine === "longform"
                ? await longformGenerate(brief, kind, {
                    correlationId,
                    targetSections: maxSections,
                  })
                : engine === "lego"
                  ? await deliverableDraft(brief, kind, { correlationId, maxSections })
                  : await generateDeliverable(brief, kind, { correlationId, maxSections });
            let generated = primary;
            if (!generated) {
              logServer("warn", {
                event: "deliverable_export_writer_fallback",
                requestId: correlationId,
                format,
                kind,
                engine,
                durationMs: Date.now() - started,
              });
              generated = await fallbackDeliverable(brief, kind, { correlationId, maxSections });
            }
            if (generated?.markdown) {
              const degraded = true;
              const reason = primary
                ? "document_renderer_unavailable"
                : "platform_pipeline_unavailable";
              const source = primary ? "local_generated_markdown" : "writer_fallback";
              const doc = renderMarkdownDocumentFallback(generated.markdown, format, {
                title,
                filenameBase: title ?? `deliverable-${kind}`,
              });
              logServer("warn", {
                event: "deliverable_generation_degraded",
                requestId: correlationId,
                format,
                kind,
                engine,
                fallbackReason: reason,
                fallbackSource: source,
                durationMs: Date.now() - started,
              });
              void emitDeliverableDegradedEvent({
                correlationId,
                stage: "export",
                kind,
                engine,
                format,
                reason,
                fallbackType: source,
              });
              logServer("info", {
                event: "deliverable_export_success",
                requestId: correlationId,
                format,
                renderer: primary ? "local_generated_markdown" : "local_writer_markdown",
                degraded,
                fallbackReason: reason,
                fallbackSource: source,
                markdownChars: generated.markdown.length,
                durationMs: Date.now() - started,
              });
              return json(
                {
                  ...doc,
                  correlationId,
                  renderer: primary ? "local_generated_markdown" : "local_writer_markdown",
                  degraded,
                  fallbackReason: reason,
                  fallbackSource: source,
                },
                200,
                correlationId,
                degradedHeaders(reason, source),
              );
            }
          } else {
            logServer("warn", {
              event: "deliverable_export_platform_not_configured",
              requestId: correlationId,
              format,
            });
          }

          logServer("error", {
            event: "deliverable_export_failed",
            requestId: correlationId,
            format,
            kind,
            engine,
            durationMs: Date.now() - started,
          });
          return json(
            {
              error: "Document generation failed — see server logs for correlationId.",
              correlationId,
            },
            502,
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
