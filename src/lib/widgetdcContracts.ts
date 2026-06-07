/**
 * @widgetdc/contracts — wire-kontrakt (CFDS §9 / Layer 9).
 *
 * Mirror af de typer canvas_builder MCP / host-bridge bruger:
 *   - ResolveCanvasRequest  → POST /api/mrp/canvas/resolve body
 *   - ResolveCanvasResponse → { embed_url, canvas_id, family, ... }
 *   - BridgeMessage         → host ↔ iframe postMessage envelope
 *
 * Alt på snake_case wire-side; konsumenter er ansvarlige for evt. mapping
 * til intern camelCase (jf. FlowFigure.parseFlowSpec).
 *
 * Signering: HMAC-SHA256 base64url payload+sig — ingen server-state nødvendigt,
 * embed-siden kan verificere og rehydrere FlowSpec'en self-contained.
 */
import { z } from "zod";

/* ---------- Schemas ---------- */

export const ResolveCanvasRequestSchema = z.object({
  brief: z.string().min(1).max(8000),
  flow_spec: z.unknown().optional(),
  node_types: z.array(z.string().min(1).max(64)).max(64).optional(),
  prefer_family: z.string().min(1).max(32).optional(),
  title: z.string().min(1).max(200).optional(),
});
export type ResolveCanvasRequest = z.infer<typeof ResolveCanvasRequestSchema>;

export const ResolveCanvasResponseSchema = z.object({
  canvas_id: z.string(),
  embed_url: z.string().url(),
  family: z.string(),
  intent: z.string(),
  mermaid_type: z.string(),
  drawio_type: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  expires_at: z.string(), // ISO-8601
  contract_version: z.literal("widgetdc.contracts.v1"),
});
export type ResolveCanvasResponse = z.infer<typeof ResolveCanvasResponseSchema>;

export const BRIDGE_MESSAGE_TYPES = [
  "host:hello",
  "host:update_spec",
  "host:set_viewport",
  "canvas:ready",
  "canvas:error",
  "canvas:select_node",
  "canvas:viewport_changed",
] as const;
export type BridgeMessageType = (typeof BRIDGE_MESSAGE_TYPES)[number];

export const BridgeMessageSchema = z.object({
  v: z.literal(1),
  contract: z.literal("widgetdc.bridge.v1"),
  canvas_id: z.string().min(1).max(128),
  type: z.enum(BRIDGE_MESSAGE_TYPES),
  payload: z.unknown().optional(),
  ts: z.number().int().nonnegative(),
});
export type BridgeMessage = z.infer<typeof BridgeMessageSchema>;

/* ---------- Bridge-payload validation (host → embed) ---------- */

export type BridgeRejectionCode =
  | "invalid_schema"
  | "canvas_id_mismatch"
  | "wrong_contract_version"
  | "origin_not_allowed";

export interface BridgeRejection {
  code: BridgeRejectionCode;
  message: string;
  /** Optional structured detail for debugging — surfaced to host on canvas:error. */
  detail?: Record<string, unknown>;
}

export type BridgeValidationResult =
  | { ok: true; message: BridgeMessage }
  | { ok: false; rejection: BridgeRejection };

/**
 * Validér en indkommende host-besked mod kontrakt + forventet canvas_id.
 * Returnerer enten `ok: true` med den parsede besked, eller en
 * `BridgeRejection` med tydelig fejlkode + human-læsbar besked.
 *
 * Designet er strengt: ugyldigt schema og forkert contract-version
 * giver hver sin kode, så host kan reagere differentieret.
 */
export function validateIncomingBridgeMessage(
  raw: unknown,
  expectedCanvasId: string,
): BridgeValidationResult {
  // Skil contract-version-fejl fra øvrige schema-fejl for at give
  // host en præcis fejlkode (`wrong_contract_version` vs `invalid_schema`).
  if (raw && typeof raw === "object" && "contract" in raw) {
    const c = (raw as { contract?: unknown }).contract;
    if (typeof c === "string" && c !== "widgetdc.bridge.v1") {
      return {
        ok: false,
        rejection: {
          code: "wrong_contract_version",
          message: `Bridge contract-version "${c}" understøttes ikke. Forventet "widgetdc.bridge.v1".`,
          detail: { received_contract: c, expected_contract: "widgetdc.bridge.v1" },
        },
      };
    }
  }

  const parsed = BridgeMessageSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`);
    return {
      ok: false,
      rejection: {
        code: "invalid_schema",
        message: `Bridge-payload matcher ikke widgetdc.bridge.v1-schemaet (${issues.length} fejl): ${issues.join("; ")}`,
        detail: { issues },
      },
    };
  }

  if (parsed.data.canvas_id !== expectedCanvasId) {
    return {
      ok: false,
      rejection: {
        code: "canvas_id_mismatch",
        message: `canvas_id "${parsed.data.canvas_id}" matcher ikke embed'ets canvas_id "${expectedCanvasId}".`,
        detail: { received_canvas_id: parsed.data.canvas_id, expected_canvas_id: expectedCanvasId },
      },
    };
  }

  return { ok: true, message: parsed.data };
}

/* ---------- Token payload type (signing/verifying lives in `.server.ts`) ---------- */

export interface CanvasTokenPayload {
  canvas_id: string;
  intent: string;
  family: string;
  mermaid_type: string;
  drawio_type: string;
  title?: string;
  brief: string;
  flow_spec?: unknown;
  exp: number; // unix seconds
}

/* ---------- URL helper (pure, client-safe) ---------- */

export function buildEmbedUrl(origin: string, canvasId: string, token: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/embed/canvas/${encodeURIComponent(canvasId)}?t=${encodeURIComponent(token)}`;
}

/**
 * Pak en `BridgeRejection` ind i en komplet `canvas:error` envelope, klar til
 * postMessage til host. Brugt af både embed-bridgen (runtime) og
 * `scripts/generate-bridge-error-docs.ts` (docs) for at sikre at de
 * copy-paste payloads i README altid matcher den faktiske afvisningslogik.
 */
export function buildCanvasErrorMessage(
  canvasId: string,
  rejection: BridgeRejection,
  ts: number,
): BridgeMessage {
  return {
    v: 1,
    contract: "widgetdc.bridge.v1",
    canvas_id: canvasId,
    type: "canvas:error",
    payload: { code: rejection.code, message: rejection.message, detail: rejection.detail },
    ts,
  };
}

/**
 * Origin-allow-list afvisning som `BridgeRejection`. Eksporteret så docs-
 * generator og embed-bridge bruger præcis samme tekst og detail-struktur.
 */
export function buildOriginRejection(
  receivedOrigin: string | null,
  allowedOrigins: readonly string[],
): BridgeRejection {
  return {
    code: "origin_not_allowed",
    message: `Besked fra origin "${receivedOrigin ?? "<none>"}" afvist — ikke på allow-list.`,
    detail: { received_origin: receivedOrigin, allowed_origins: [...allowedOrigins] },
  };
}

/* ---------- Origin allow-list for postMessage bridge ---------- */

export function isAllowedOrigin(origin: string | null, allowList: readonly string[]): boolean {
  if (!origin) return false;
  if (allowList.includes("*")) return true;
  try {
    const o = new URL(origin).origin;
    return allowList.some((a) => {
      try {
        return new URL(a).origin === o;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
