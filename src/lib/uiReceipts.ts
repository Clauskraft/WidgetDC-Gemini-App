/**
 * GF-PR4: fire-and-forget client emitter for UI interaction receipts.
 *
 * Only user-initiated interactions are reported (auto-opened canvases are
 * system-initiated and crediting them would be pre-payment — the same R24
 * honesty rule the backend enforces). Each interaction+entity pair is
 * debounced so an expand/collapse flurry costs one receipt, and the fetch is
 * keepalive so a receipt fired right before navigation still lands. Failure
 * is silent by design: receipts must never degrade the UI.
 */
import { RECEIPT_TOOL_HINTS, type UiReceiptRequest } from "@/lib/uiReceiptContract";

const DEBOUNCE_MS = 30_000;
const recentEmits = new Map<string, number>();

/** Emit a receipt if the producing tool is whitelisted. Never throws. */
export function emitUiReceipt(args: UiReceiptRequest): void {
  if (typeof window === "undefined") return;
  if (!(args.producing_tool in RECEIPT_TOOL_HINTS)) return;

  const key = `${args.interaction}:${args.entity_id}`;
  const now = Date.now();
  const last = recentEmits.get(key);
  if (last !== undefined && now - last < DEBOUNCE_MS) return;
  recentEmits.set(key, now);

  try {
    void fetch("/api/receipts", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    }).catch(() => {});
  } catch {
    // fetch itself can throw synchronously in exotic environments — ignore.
  }
}

/** Test seam: clear the debounce window. */
export function resetUiReceiptDebounce(): void {
  recentEmits.clear();
}
