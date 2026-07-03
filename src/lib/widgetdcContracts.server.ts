/**
 * Server-only canvas-token helpers — must NOT be imported in client/browser
 * code. Uses node:crypto via Worker nodejs_compat. Filename `.server.ts`
 * blocks it from client bundles.
 */
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import type { CanvasTokenPayload } from "./widgetdcContracts";

const DEFAULT_TTL_SECONDS = 60 * 60;

const DEV_FALLBACK_SECRET = "widgetdc-dev-secret-do-not-use-in-prod";

function getSecret(): string {
  const secret =
    process.env.CANVAS_SIGNING_SECRET ?? process.env.WIDGETDC_API_KEY ?? DEV_FALLBACK_SECRET;

  // AUR-11: refuse to sign with the insecure dev fallback in production.
  if (process.env.NODE_ENV === "production" && secret === DEV_FALLBACK_SECRET) {
    throw new Error(
      "CANVAS_SIGNING_SECRET (or WIDGETDC_API_KEY) must be set in production. " +
        "Refusing to sign canvas tokens with the insecure dev fallback.",
    );
  }

  return secret;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signCanvasToken(payload: CanvasTokenPayload): string {
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64urlEncode(createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyCanvasToken(token: string): CanvasTokenPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64urlEncode(createHmac("sha256", getSecret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as CanvasTokenPayload;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function deriveCanvasId(brief: string, intent: string): string {
  return createHash("sha256").update(`${intent}::${brief.trim()}`).digest("hex").slice(0, 16);
}

export function ttlSeconds(): number {
  const env = Number(process.env.CANVAS_TOKEN_TTL_SECONDS);
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_TTL_SECONDS;
}
