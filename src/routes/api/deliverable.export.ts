/**
 * POST /api/deliverable/export — Output Forge (Phase 1b + Phase 5).
 *
 * Primary path: backend /api/consulting/generate (real binary PPTX/DOCX/PDF).
 * Secondary path: forge.artifact.generate (DOCX only via MCP).
 * Tertiary path: local Markdown rendering (degraded fallback).
 * Server-only: keys read inside the handler.
 */
import process from "node:process";
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

async function callBackendGenerate(
  brief: string,
  format: "docx" | "pdf",
  opts: { correlationId: string; title?: string; kind?: string; theme?: string },
): Promise<{ base64: string; filename: string; mediaType: string } | null> {
  const backendUrl = process.env.WIDGETDC_BACKEND_URL?.replace(/\/+$/, "");
  const bearerKey =
    process.env.WIDGETDC_BEARER_TOKEN ??
    process.env.WIDGETDC_API_KEY ??
    process.env.MCP_AGENT_API_KEY;
  if (!backendUrl || !bearerKey) return null;

  try {
    const res = await fetch(`${backendUrl}/api/consulting/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerKey}`,
        "x-correlation-id": opts.correlationId,
      },
      body: JSON.stringify({
        format,
        theme: opts.theme ?? "mckinsey",
        title: opts.title,
        kind: opts.kind ?? "analysis",
        markdown: brief,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    const mediaType =
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const ext = format === "pdf" ? "pdf" : "docx";
    const filename = `${opts.title ?? `deliverable-${opts.kind ?? "analysis"}`}.${ext}`;

    if (!contentType.includes("application/") && !contentType.includes("octet")) return null;

    return { base64, filename, mediaType };
  } catch {
    return null;
  }
}

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

          // ── Primary path: backend /api/consulting/generate (real binary) ────
          const backendDoc = await callBackendGenerate(brief, format, {
            correlationId,
            title,
            kind,
            theme: "mckinsey",
          });
          if (backendDoc) {
            logServer("info", {
              event: "deliverable_export_success",
              requestId: correlationId,
              format,
              renderer: "backend_consulting_generate",
              durationMs: Date.now() - started,
            });
            return json(
              { ...backendDoc, correlationId, renderer: "backend_consulting_generate" },
              200,
              correlationId,
            );
          }

          logServer("warn", {
            event: "deliverable_export_backend_fallback",
            requestId: correlationId,
            format,
            reason: "backend_consulting_generate_unavailable",
            durationMs: Date.now() - started,
          });

          if (isPlatformConfigured()) {
            const platformDoc = await produceDocument(brief, format, { correlationId, title });
            if (platformDoc) {
              logServer("info", {
                event: "deliverable_export_success",
                requestId: correlationId,
                format,
                renderer: "forge_artifact_generate",
                durationMs: Date.now() - started,
              });
              return json(
                { ...platformDoc, correlationId, renderer: "forge_artifact_generate" },
                200,
                correlationId,
              );
            }

            logServer("warn", {
              event: "deliverable_export_platform_fallback",
              requestId: correlationId,
              format,
              renderer:
                format === "docx" ? "forge_artifact_generate" : "pdf_native_document_renderer",
              reason:
                format === "docx" ? "no artifact returned" : "native pdf rendering unavailable",
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
              await emitDeliverableDegradedEvent({
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
