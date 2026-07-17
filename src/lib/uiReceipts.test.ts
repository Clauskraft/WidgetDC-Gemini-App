// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitUiReceipt, resetUiReceiptDebounce } from "@/lib/uiReceipts";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({ ok: true });
  resetUiReceiptDebounce();
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("emitUiReceipt (GF-PR4 client emitter)", () => {
  it("POSTs a whitelisted interaction to /api/receipts with keepalive", () => {
    emitUiReceipt({
      interaction: "fold_out",
      entity_id: "canvas/t1",
      producing_tool: "kg_rag.query",
      session_id: "t1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/receipts");
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(String(init.body))).toMatchObject({
      interaction: "fold_out",
      entity_id: "canvas/t1",
      producing_tool: "kg_rag.query",
    });
  });

  it("silently skips tools outside the runtime-verified whitelist", () => {
    emitUiReceipt({ interaction: "fold_out", entity_id: "x", producing_tool: "srag.query" });
    emitUiReceipt({ interaction: "fold_out", entity_id: "x", producing_tool: "evil.tool" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("debounces per interaction+entity but not across entities", () => {
    emitUiReceipt({
      interaction: "fold_out",
      entity_id: "canvas/t1",
      producing_tool: "kg_rag.query",
    });
    emitUiReceipt({
      interaction: "fold_out",
      entity_id: "canvas/t1",
      producing_tool: "kg_rag.query",
    });
    emitUiReceipt({
      interaction: "fold_out",
      entity_id: "strip/t1",
      producing_tool: "kg_rag.query",
    });
    emitUiReceipt({
      interaction: "card_drilldown",
      entity_id: "canvas/t1",
      producing_tool: "graph.read_cypher",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("never throws when fetch rejects or explodes synchronously", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(() =>
      emitUiReceipt({ interaction: "fold_out", entity_id: "a", producing_tool: "kg_rag.query" }),
    ).not.toThrow();
    resetUiReceiptDebounce();
    fetchMock.mockImplementationOnce(() => {
      throw new Error("sync explosion");
    });
    expect(() =>
      emitUiReceipt({ interaction: "fold_out", entity_id: "b", producing_tool: "kg_rag.query" }),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 5));
  });
});
