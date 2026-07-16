import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildChatReceipt,
  buildUiReceipt,
  dispatchChatReceiptFailSoft,
  sendInteractionReceipt,
} from "@/lib/interaction-receipts.server";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("WIDGETDC_BEARER_TOKEN", "service-bearer-test");
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

describe("P2 interaction receipts (LIN-2226, gemini-frontend surface)", () => {
  it("builds a contract-conformant tool_launch receipt for a chat turn", () => {
    const receipt = buildChatReceipt({
      sessionId: "sess-42",
      outcome: "success",
    });

    expect(receipt).toMatchObject({
      surface: "gemini-frontend",
      template_id: "gemini-frontend:/api/chat",
      interaction: "tool_launch",
      entity_id: "wdc-chat/stream",
      intent_hint: null,
      producing_tool: null,
      outcome: "success",
      context_id: "gemini-sess-42",
    });
    expect(receipt.event_token).toBeGreaterThan(0);
    expect(Number.isInteger(receipt.event_token)).toBe(true);
    // Backend contract requires the deterministic ui-a5- correlation prefix.
    expect(receipt.correlation_id).toBe(`ui-a5-gemini-sess-42-${receipt.event_token}-tool_launch`);
    expect(() => new Date(receipt.observed_at).toISOString()).not.toThrow();
  });

  it("buildUiReceipt generalises the contract to feedback-eligible interactions (GF-PR4)", () => {
    const receipt = buildUiReceipt({
      interaction: "fold_out",
      templateId: "gemini-frontend:/api/receipts",
      entityId: "canvas/thread-7",
      intentHint: "intelligence stack",
      producingTool: "kg_rag.query",
      sessionId: "sess-7",
      outcome: "success",
    });

    expect(receipt).toMatchObject({
      surface: "gemini-frontend",
      template_id: "gemini-frontend:/api/receipts",
      interaction: "fold_out",
      entity_id: "canvas/thread-7",
      intent_hint: "intelligence stack",
      producing_tool: "kg_rag.query",
      outcome: "success",
      context_id: "gemini-sess-7",
    });
    expect(receipt.correlation_id).toBe(`ui-a5-gemini-sess-7-${receipt.event_token}-fold_out`);
  });

  it("buildChatReceipt output is unchanged by the GF-PR4 generalisation", () => {
    const receipt = buildChatReceipt({ sessionId: "sess-42", outcome: "success" });
    expect(receipt.template_id).toBe("gemini-frontend:/api/chat");
    expect(receipt.interaction).toBe("tool_launch");
    expect(receipt.intent_hint).toBeNull();
    expect(receipt.producing_tool).toBeNull();
    expect(receipt.entity_id).toBe("wdc-chat/stream");
  });

  it("anonymous sessions still produce a valid context id", () => {
    const receipt = buildChatReceipt({ sessionId: undefined, outcome: "failure" });
    expect(receipt.context_id).toBe("gemini-anon");
    expect(receipt.outcome).toBe("failure");
  });

  it("sends the receipt through the governed MCP route with the service bearer", async () => {
    const receipt = buildChatReceipt({ sessionId: "sess-42", outcome: "success" });
    await sendInteractionReceipt(receipt);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/mcp/route");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer service-bearer-test",
    );
    const body = JSON.parse(String(init.body));
    expect(body.tool).toBe("ui.interaction_receipt");
    expect(body.payload).toMatchObject({ surface: "gemini-frontend", interaction: "tool_launch" });
  });

  it("is fail-soft end to end: missing bearer, network failure and non-ok responses never throw", async () => {
    // Blank the ENTIRE canonical bearer chain — the host shell may export any
    // of these (e.g. WIDGETDC_API_KEY), which would make this test flaky.
    for (const key of [
      "WIDGETDC_BEARER_TOKEN",
      "WIDGETDC_MCP_KEY",
      "WIDGETDC_MCP_API_KEY",
      "WIDGETDC_API_KEY",
      "MCP_API_KEY",
      "MCP_AGENT_API_KEY",
      "CAPTAIN_RUNTIME_BEARER",
      "CAPTAIN_API_BEARER",
      "BACKEND_API_KEY",
      "API_KEY",
      "MCP_AUTH_TOKEN",
    ]) {
      vi.stubEnv(key, "");
    }
    const receipt = buildChatReceipt({ sessionId: "s", outcome: "success" });
    await expect(sendInteractionReceipt(receipt)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv("WIDGETDC_BEARER_TOKEN", "service-bearer-test");
    fetchMock.mockRejectedValueOnce(new Error("backend down"));
    await expect(sendInteractionReceipt(receipt)).resolves.toBeUndefined();

    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(sendInteractionReceipt(receipt)).resolves.toBeUndefined();
  });

  it("dispatchChatReceiptFailSoft is fire-and-forget and never leaks a rejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => void unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      fetchMock.mockRejectedValue(new Error("backend down"));
      expect(() =>
        dispatchChatReceiptFailSoft({ sessionId: "s", outcome: "failure" }),
      ).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
