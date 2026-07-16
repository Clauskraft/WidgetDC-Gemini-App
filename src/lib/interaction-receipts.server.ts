/**
 * P2 interaction receipts — gemini-frontend surface (LIN-2226).
 *
 * Emits `ui_interaction_*` receipts to the WidgeTDC backend's calibration-class
 * `ui.interaction_receipt` tool (WidgeTDC PR #7231) so this surface's usage
 * feeds the platform adoption flywheel (EventSpine observability leg).
 *
 * Chat turns are reported as `tool_launch` — observability-only by the P2
 * contract (launch outcome says nothing about a producing read tool, so no
 * intent-confidence credit is requested; `producing_tool`/`intent_hint` stay
 * null and the backend independently re-guards).
 *
 * `.server.ts` keeps this out of the client bundle. Every path degrades
 * gracefully (same MoA-resilience doctrine as widgetdc.server.ts): missing
 * bearer, network failure or a non-ok response never throws and never blocks
 * a chat response.
 */
import process from "node:process";
import { logServer } from "./server-logger";

const RECEIPT_TIMEOUT_MS = 4000;

const WDC_BACKEND =
  process.env.WIDGETDC_BACKEND_URL ||
  process.env.WDC_BACKEND_URL ||
  "https://backend-production-d3da.up.railway.app";

/** Same canonical bearer chain as /api/chat (bearerEnvKeys.ts order). */
function serviceBearer(): string | undefined {
  return (
    process.env.WIDGETDC_BEARER_TOKEN ||
    process.env.WIDGETDC_MCP_KEY ||
    process.env.WIDGETDC_MCP_API_KEY ||
    process.env.WIDGETDC_API_KEY ||
    process.env.MCP_API_KEY ||
    process.env.MCP_AGENT_API_KEY ||
    process.env.CAPTAIN_RUNTIME_BEARER ||
    process.env.CAPTAIN_API_BEARER ||
    process.env.BACKEND_API_KEY ||
    process.env.API_KEY ||
    process.env.MCP_AUTH_TOKEN ||
    undefined
  );
}

export interface UiInteractionReceipt {
  surface: "gemini-frontend";
  template_id: string;
  interaction: "tool_launch";
  entity_id: string;
  intent_hint: null;
  producing_tool: null;
  outcome: "success" | "failure";
  event_token: number;
  context_id: string;
  correlation_id: string;
  observed_at: string;
}

export interface ChatReceiptArgs {
  sessionId: string | undefined;
  outcome: "success" | "failure";
}

/**
 * Build a contract-conformant receipt for one chat turn. `event_token` is a
 * millisecond timestamp: monotonic per session in practice, and the backend's
 * correlation-id dedup makes accidental duplicates harmless. The `ui-a5-`
 * correlation prefix is mandated by the backend contract
 * (uiInteractionContract.ts) as the deterministic idempotency/replay handle.
 */
export function buildChatReceipt(args: ChatReceiptArgs): UiInteractionReceipt {
  const contextId = `gemini-${args.sessionId?.trim() || "anon"}`;
  const eventToken = Date.now();
  return {
    surface: "gemini-frontend",
    template_id: "gemini-frontend:/api/chat",
    interaction: "tool_launch",
    entity_id: "wdc-chat/stream",
    intent_hint: null,
    producing_tool: null,
    outcome: args.outcome,
    event_token: eventToken,
    context_id: contextId,
    correlation_id: `ui-a5-${contextId}-${eventToken}-tool_launch`,
    observed_at: new Date().toISOString(),
  };
}

/** POST the receipt through the governed MCP route. Never throws. */
export async function sendInteractionReceipt(receipt: UiInteractionReceipt): Promise<void> {
  const bearer = serviceBearer();
  if (!bearer) return; // unconfigured environments emit nothing, silently
  try {
    const resp = await fetch(`${WDC_BACKEND.replace(/\/+$/, "")}/api/mcp/route`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "ui.interaction_receipt",
        payload: receipt,
        sourceId: "gemini-frontend",
      }),
      signal: AbortSignal.timeout(RECEIPT_TIMEOUT_MS),
    });
    if (!resp.ok) {
      logServer("warn", {
        event: "interaction_receipt_rejected",
        status: resp.status,
        correlation_id: receipt.correlation_id,
      });
    }
  } catch (error) {
    logServer(
      "warn",
      { event: "interaction_receipt_dropped", correlation_id: receipt.correlation_id },
      error,
    );
  }
}

/** Fire-and-forget: zero latency on the chat path, can never reject the caller. */
export function dispatchChatReceiptFailSoft(args: ChatReceiptArgs): void {
  void sendInteractionReceipt(buildChatReceipt(args)).catch(() => {});
}
