// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { resetUiReceiptDebounce } from "@/lib/uiReceipts";
import { CanvasDrawerView } from "./CanvasDrawer";

/**
 * GF-PR5: graph-node "Drill" in the canvas emits a card_drilldown receipt
 * (producing_tool graph.read_cypher — the runtime-verified pair). The emitter
 * is exercised for real (no module mock): jsdom window + stubbed fetch, so
 * the whole chain Drill-click → emitUiReceipt → POST /api/receipts is covered.
 */

const GRAPH_MESSAGE: UIMessage = {
  id: "a1",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: 'Grafen:\n```graph\n{"nodes":[{"id":"pattern-17","label":"Pattern 17"},{"id":"tool-3","label":"Tool 3"}],"edges":[{"source":"pattern-17","target":"tool-3"}]}\n```\n',
    },
  ],
} as UIMessage;

const fetchMock = vi.fn();
let container: HTMLDivElement;
let root: Root;

function drillButton(): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes("Drill"),
  );
  if (!button) throw new Error("Drill button not rendered");
  return button as HTMLButtonElement;
}

function renderDrawer() {
  act(() => {
    root.render(
      <CanvasDrawerView
        messages={[GRAPH_MESSAGE]}
        focusedMessageId="a1"
        onClose={() => {}}
        onFocusMessage={() => {}}
      />,
    );
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({ ok: true });
  resetUiReceiptDebounce();
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("CanvasDrawer card_drilldown (GF-PR5)", () => {
  it("Drill on a selected graph node POSTs a card_drilldown receipt", () => {
    renderDrawer();

    // GraphCanvas pre-selects the first node; the inspector's Drill button is
    // the user-initiated card_drilldown surface.
    act(() => {
      drillButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const receiptCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/receipts");
    expect(receiptCalls).toHaveLength(1);
    const body = JSON.parse(String((receiptCalls[0][1] as RequestInit).body));
    expect(body).toMatchObject({
      interaction: "card_drilldown",
      producing_tool: "graph.read_cypher",
      entity_id: "graph-node/pattern-17",
    });
  });

  it("a second Drill on the same node inside the debounce window does not double-emit", () => {
    renderDrawer();
    act(() => {
      drillButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => {
      drillButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const receiptCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/receipts");
    expect(receiptCalls).toHaveLength(1);
  });
});
