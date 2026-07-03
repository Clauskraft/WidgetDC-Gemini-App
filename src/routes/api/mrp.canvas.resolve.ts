/**
 * POST /api/mrp/canvas/resolve — canvas_builder bridge (CFDS §9).
 *
 * Aurora-host kalder dette endpoint med en brief (+ valgfri flow_spec) og
 * får tilbage en signeret embed_url som klient-siden kan iframe'e. Token'et
 * indeholder hele FlowSpec'en så embed-siden ikke behøver server-state.
 *
 * AUR-3: after local intent detection the handler calls the platform
 * `canvas_builder` MCP tool in parallel with a graph query so the platform
 * can override the family/standard and enrich the FlowSpec from its knowledge
 * graph. The HMAC embed-token contract is preserved regardless.
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
import { callCanvasBuilder, queryGraph } from "@/lib/widgetdc.server";

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

        // Local intent detection — always runs so we have a fast fallback.
        const preferred = preferIntent(prefer_family);
        const detection = detectIntent(brief, node_types ?? []);
        const localIntent = preferred ?? detection.intent;

        // AUR-3: call platform canvas_builder + query graph for existing
        // FlowSpec in parallel. Both are best-effort; failures fall back to
        // local resolution so the contract always returns a valid response.
        const correlationId = crypto.randomUUID();
        const [platformCanvas, graphRows] = await Promise.allSettled([
          callCanvasBuilder(brief, localIntent, node_types ?? [], correlationId),
          queryGraph(
            `MATCH (c:Canvas {brief_hash: $hash}) RETURN c.flow_spec AS flow_spec, c.family AS family LIMIT 1`,
            correlationId,
          ),
        ]);

        const platform = platformCanvas.status === "fulfilled" ? platformCanvas.value : null;
        const graphResult = graphRows.status === "fulfilled" ? graphRows.value : null;

        // Resolve intent + standard: prefer platform, then local.
        const resolvedIntent = (platform?.intent as VisualizationIntent | undefined) ?? localIntent;
        const standard =
          VISUALIZATION_STANDARDS[resolvedIntent] ?? VISUALIZATION_STANDARDS[localIntent];

        // FlowSpec: prefer explicit caller input, then platform enrichment,
        // then graph-persisted spec (if found).
        const graphFlowSpec =
          Array.isArray(graphResult) && graphResult[0]?.flow_spec
            ? (graphResult[0].flow_spec as Record<string, unknown>)
            : undefined;
        const resolvedFlowSpec = flow_spec ?? platform?.flow_spec ?? graphFlowSpec;

        const canvas_id = deriveCanvasId(brief, resolvedIntent);
        const exp = Math.floor(Date.now() / 1000) + ttlSeconds();
        const token = signCanvasToken({
          canvas_id,
          intent: resolvedIntent,
          family: platform?.family ?? standard.family,
          mermaid_type: platform?.mermaid_type ?? standard.mermaidType,
          drawio_type: platform?.drawio_type ?? standard.drawioType,
          title,
          brief,
          flow_spec: resolvedFlowSpec,
          exp,
        });

        const origin = new URL(request.url).origin;
        const embed_url = buildEmbedUrl(origin, canvas_id, token);

        const body: ResolveCanvasResponse = {
          canvas_id,
          embed_url,
          family: platform?.family ?? standard.family,
          intent: resolvedIntent,
          mermaid_type: platform?.mermaid_type ?? standard.mermaidType,
          drawio_type: platform?.drawio_type ?? standard.drawioType,
          confidence: detection.confidence,
          expires_at: new Date(exp * 1000).toISOString(),
          contract_version: "widgetdc.contracts.v1",
        };
        return json(body, { status: 200 });
      },
    },
  },
});
