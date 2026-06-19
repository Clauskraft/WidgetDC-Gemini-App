/**
 * POST /api/ingest — Persistent document ingestion for Aurora.
 *
 * Accepts multipart/form-data with one or more files.
 * Extracts text content and calls the WidgeTDC `ingest_document` MCP tool
 * to index each file into the knowledge graph + vector store so it becomes
 * retrievable by `fetchRagGrounding` in subsequent chat requests.
 *
 * Supported: text/plain, text/markdown, application/json, text/csv, application/pdf
 * Images are NOT ingested here — they stay as LLM vision parts.
 */
import { createFileRoute } from "@tanstack/react-router";
import { callMcpTool } from "@/lib/widgetdc.server";

export type IngestResult = {
  id: string;
  filename: string;
  status: "ok" | "error";
  error?: string;
};

export type IngestResponse = {
  results: IngestResult[];
  ingested: number;
  failed: number;
};

const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "text/html",
]);

const PDF_TYPE = "application/pdf";

const MAX_BYTES = 8 * 1024 * 1024;

function jsonRes(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function bufferToBase64(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const Route = createFileRoute("/api/ingest")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return jsonRes({ error: "Expected multipart/form-data" }, 400);
        }

        const files = formData.getAll("file") as File[];
        if (files.length === 0) {
          return jsonRes({ error: "No files in request" }, 400);
        }

        const results: IngestResult[] = [];

        for (const file of files) {
          if (!(file instanceof File)) {
            results.push({ id: "", filename: "unknown", status: "error", error: "Not a file" });
            continue;
          }

          if (file.size > MAX_BYTES) {
            results.push({
              id: "",
              filename: file.name,
              status: "error",
              error: `File too large (max 8 MB)`,
            });
            continue;
          }

          const mime = file.type || "application/octet-stream";
          const isText = TEXT_TYPES.has(mime) || file.name.endsWith(".md") || file.name.endsWith(".txt");
          const isPdf = mime === PDF_TYPE || file.name.toLowerCase().endsWith(".pdf");

          if (!isText && !isPdf) {
            results.push({
              id: file.name,
              filename: file.name,
              status: "error",
              error: `Unsupported type: ${mime}`,
            });
            continue;
          }

          try {
            let content: string;
            if (isText) {
              content = await file.text();
            } else {
              // PDF: pass as base64 — ingest_document supports it
              const buf = await file.arrayBuffer();
              content = await bufferToBase64(buf);
            }

            const result = await callMcpTool<{ id?: string; node_id?: string; message?: string }>(
              "ingest_document",
              {
                content,
                filename: file.name,
                domain: "aurora-user-upload",
                extract_entities: true,
              },
            );

            const nodeId =
              (result as Record<string, unknown>)?.id as string ??
              (result as Record<string, unknown>)?.node_id as string ??
              file.name;

            results.push({ id: String(nodeId), filename: file.name, status: "ok" });
          } catch (err) {
            results.push({
              id: "",
              filename: file.name,
              status: "error",
              error: err instanceof Error ? err.message.slice(0, 200) : "Ingest failed",
            });
          }
        }

        const ingested = results.filter((r) => r.status === "ok").length;
        const failed = results.length - ingested;

        return jsonRes({ results, ingested, failed }, ingested > 0 ? 200 : 422);
      },
    },
  },
});
