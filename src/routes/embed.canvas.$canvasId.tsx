/**
 * /embed/canvas/$canvasId — iframe target for canvas_builder embed_url.
 *
 * Læser ?t=<token>, verificerer HMAC, rehydrerer FlowSpec/brief, og sender
 * `canvas:ready` postMessage til host. Host kan sende `host:update_spec` /
 * `host:set_viewport` retur (origin-valideret via allow-list).
 */
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useMemo } from "react";
import { z } from "zod";
import { FlowFigure } from "@/components/FlowFigure";
import { MermaidBlock } from "@/components/MermaidBlock";
import {
  type BridgeMessage,
  type BridgeRejection,
  type CanvasTokenPayload,
  buildCanvasErrorMessage,
  buildOriginRejection,
  isAllowedOrigin,
  validateIncomingBridgeMessage,
} from "@/lib/widgetdcContracts";
import { verifyCanvasToken } from "@/lib/widgetdcContracts.server";

const resolveCanvasToken = createServerFn({ method: "GET" })
  .inputValidator((d: { canvas_id: string; token: string }) =>
    z
      .object({ canvas_id: z.string().min(1).max(128), token: z.string().min(8).max(16384) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const payload = verifyCanvasToken(data.token);
    if (!payload || payload.canvas_id !== data.canvas_id) {
      throw new Error("Invalid or expired canvas token");
    }
    return {
      payload: {
        ...payload,
        flow_spec_json: payload.flow_spec ? JSON.stringify(payload.flow_spec) : null,
        flow_spec: undefined,
      } as Omit<CanvasTokenPayload, "flow_spec"> & { flow_spec_json: string | null },
    };
  });

export const Route = createFileRoute("/embed/canvas/$canvasId")({
  validateSearch: (s: Record<string, unknown>) => z.object({ t: z.string().min(8) }).parse(s),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: async ({ params, deps }) => {
    try {
      return await resolveCanvasToken({ data: { canvas_id: params.canvasId, token: deps.t } });
    } catch {
      throw notFound();
    }
  },
  notFoundComponent: () => (
    <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Canvas token er ugyldigt eller udløbet.
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex h-screen items-center justify-center bg-background p-4 text-sm text-destructive">
      Embed-fejl: {error instanceof Error ? error.message : "ukendt"}
    </div>
  ),
  component: CanvasEmbedPage,
});

export type CanvasEmbedPayload = Omit<CanvasTokenPayload, "flow_spec"> & {
  flow_spec_json: string | null;
};

export function postToHost(message: BridgeMessage) {
  if (typeof window === "undefined" || window.parent === window) return;
  // Wildcard target — host validerer afsender-origin på sin side; vi har
  // ingen viden om host-origin før første host:hello.
  window.parent.postMessage(message, "*");
}

/** Emit `canvas:error` til host + console.warn med tydelig fejlbesked. */
export function emitRejection(canvasId: string, rejection: BridgeRejection) {
  if (typeof console !== "undefined") {
    console.warn(`[widgetdc.bridge] rejected (${rejection.code}): ${rejection.message}`);
  }
  postToHost(buildCanvasErrorMessage(canvasId, rejection, Date.now()));
}

/**
 * Bridge-handshake hook (CFDS §9). Eksporteret separat så embed-livscyklus
 * kan testes uden TanStack-router-loader.
 *
 * Lifecycle:
 *  - mount: post `canvas:ready` til parent
 *  - lyt på message: validér mod BridgeMessageSchema + match canvas_id
 *  - host:hello → svar med `canvas:ready { rehello: true }`
 */
export interface UseCanvasBridgeOptions {
  /**
   * Tilladte host-origins. Hvis sat, afvises alle `message`-events fra
   * andre origins med `canvas:error { code: "origin_not_allowed" }`.
   * Hvis udeladt, springes origin-check'et over (legacy/dev-tilstand).
   * Brug `["*"]` for eksplicit at tillade alle origins.
   */
  allowedOrigins?: readonly string[];
}

export function useCanvasBridge(
  payload: Pick<CanvasEmbedPayload, "canvas_id" | "family" | "intent" | "title">,
  options: UseCanvasBridgeOptions = {},
) {
  const allowedOrigins = options.allowedOrigins;
  const allowedOriginsKey = allowedOrigins ? allowedOrigins.join("|") : "";
  useEffect(() => {
    postToHost({
      v: 1,
      contract: "widgetdc.bridge.v1",
      canvas_id: payload.canvas_id,
      type: "canvas:ready",
      payload: {
        family: payload.family,
        intent: payload.intent,
        title: payload.title ?? null,
      },
      ts: Date.now(),
    });

    const onMessage = (ev: MessageEvent) => {
      if (allowedOrigins && !isAllowedOrigin(ev.origin ?? null, allowedOrigins)) {
        emitRejection(payload.canvas_id, buildOriginRejection(ev.origin || null, allowedOrigins));
        return;
      }
      const result = validateIncomingBridgeMessage(ev.data, payload.canvas_id);
      if (!result.ok) {
        emitRejection(payload.canvas_id, result.rejection);
        return;
      }
      if (result.message.type === "host:hello") {
        postToHost({
          v: 1,
          contract: "widgetdc.bridge.v1",
          canvas_id: payload.canvas_id,
          type: "canvas:ready",
          payload: { rehello: true },
          ts: Date.now(),
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    payload.canvas_id,
    payload.family,
    payload.intent,
    payload.title,
    allowedOrigins,
    allowedOriginsKey,
  ]);
}

function CanvasEmbedPage() {
  const { payload } = Route.useLoaderData() as { payload: CanvasEmbedPayload };
  const flowContent = useMemo(() => payload.flow_spec_json, [payload.flow_spec_json]);
  useCanvasBridge(payload);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="font-semibold text-foreground/80">{payload.title ?? "Canvas"}</span>
        <span>
          {payload.family} · {payload.intent}
        </span>
      </header>
      <main className="p-4">
        {flowContent ? (
          <FlowFigure content={flowContent} />
        ) : (
          <MermaidBlock content={payload.brief} />
        )}
      </main>
    </div>
  );
}
