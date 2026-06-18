/**
 * POST /api/mrp/canvas/resolve — canvas_builder bridge (CFDS §9).
 *
 * Aurora-host kalder dette endpoint med en brief (+ valgfri flow_spec) og
 * får tilbage en signeret embed_url som klient-siden kan iframe'e. Token'et
 * indeholder hele FlowSpec'en så embed-siden ikke behøver server-state.
 *
 * Kontrakten matcher @widgetdc/contracts (snake_case wire-format).
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  ResolveCanvasRequestSchema,
  type ResolveCanvasResponse,
  buildEmbedUrl,
} from "@/lib/widgetdcContracts";
import { deriveCanvasId, signCanvasToken, ttlSeconds } from "@/lib/widgetdcContracts.server";
import {
  detectIntent,
  VISUALIZATION_STANDARDS,
  type VisualizationIntent,
} from "@/lib/visualizationIntent";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

function preferIntent(prefer: string | undefined): VisualizationIntent | null {
  if (!prefer) return null;
  const found = (
    Object.entries(VISUALIZATION_STANDARDS) as [VisualizationIntent, { family: string }][]
  ).find(([k, v]) => k === prefer || v.family === prefer);
  return found ? found[0] : null;
}

export const Route = createFileRoute("/api/mrp/canvas/resolve")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        let parsed: unknown;
        try {
          parsed = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const validation = ResolveCanvasRequestSchema.safeParse(parsed);
        if (!validation.success) {
          return json(
            { error: "Invalid request", details: validation.error.flatten() },
            { status: 422 },
          );
        }
        const { brief, flow_spec, node_types, prefer_family, title } = validation.data;

        // Intent-resolver: honorér prefer_family hvis legal, ellers detect.
        const preferred = preferIntent(prefer_family);
        const detection = detectIntent(brief, node_types ?? []);
        const intent = preferred ?? detection.intent;
        const standard = VISUALIZATION_STANDARDS[intent];

        const canvas_id = deriveCanvasId(brief, intent);
        const exp = Math.floor(Date.now() / 1000) + ttlSeconds();
        const token = signCanvasToken({
          canvas_id,
          intent,
          family: standard.family,
          mermaid_type: standard.mermaidType,
          drawio_type: standard.drawioType,
          title,
          brief,
          flow_spec,
          exp,
        });

        const origin = new URL(request.url).origin;
        const embed_url = buildEmbedUrl(origin, canvas_id, token);

        const body: ResolveCanvasResponse = {
          canvas_id,
          embed_url,
          family: standard.family,
          intent,
          mermaid_type: standard.mermaidType,
          drawio_type: standard.drawioType,
          confidence: detection.confidence,
          expires_at: new Date(exp * 1000).toISOString(),
          contract_version: "widgetdc.contracts.v1",
        };
        return json(body, { status: 200 });
      },
    },
  },
});
