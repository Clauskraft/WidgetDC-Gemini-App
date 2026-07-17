import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/api/receipts";

/**
 * GF-PR4: /api/receipts — the browser's only door into the P2 adoption
 * flywheel. The route is a strict WHITELIST: only the two feedback-eligible
 * interaction kinds and the two runtime-verified producing tools cross the
 * wire, and the intent hint is derived SERVER-side from the tool (the client
 * cannot inject free text). Everything answers 202 — invalid payloads are
 * dropped, never bounced (no probing surface, no client-visible failure).
 */

const sendInteractionReceipt = vi.fn();

vi.mock("@/lib/interaction-receipts.server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/interaction-receipts.server")>();
  return {
    ...original,
    sendInteractionReceipt: (...args: unknown[]) => sendInteractionReceipt(...args),
  };
});

async function invokeReceipts(body: unknown): Promise<Response> {
  const POST = (
    Route as unknown as {
      options: { server: { handlers: { POST: (ctx: { request: Request }) => Promise<Response> } } };
    }
  ).options.server.handlers.POST;
  const request = new Request("https://example.test/api/receipts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST({ request });
}

beforeEach(() => {
  sendInteractionReceipt.mockResolvedValue(undefined);
});

afterEach(() => {
  sendInteractionReceipt.mockReset();
});

describe("POST /api/receipts (GF-PR4 whitelist ingress)", () => {
  it("accepts a fold_out for kg_rag.query and derives the runtime-verified hint server-side", async () => {
    const resp = await invokeReceipts({
      interaction: "fold_out",
      entity_id: "canvas/thread-1",
      producing_tool: "kg_rag.query",
      session_id: "sess-9",
    });

    expect(resp.status).toBe(202);
    await expect(resp.json()).resolves.toMatchObject({ accepted: true });
    expect(sendInteractionReceipt).toHaveBeenCalledTimes(1);
    const receipt = sendInteractionReceipt.mock.calls[0][0];
    expect(receipt).toMatchObject({
      surface: "gemini-frontend",
      template_id: "gemini-frontend:/api/receipts",
      interaction: "fold_out",
      entity_id: "canvas/thread-1",
      producing_tool: "kg_rag.query",
      intent_hint: "intelligence stack",
      outcome: "success",
      context_id: "gemini-sess-9",
    });
    expect(receipt.correlation_id).toBe(`ui-a5-gemini-sess-9-${receipt.event_token}-fold_out`);
  });

  it("maps graph.read_cypher drilldowns to the 'read from the graph' hint", async () => {
    const resp = await invokeReceipts({
      interaction: "card_drilldown",
      entity_id: "graph-node/Pattern-17",
      producing_tool: "graph.read_cypher",
      session_id: "sess-9",
    });

    expect(resp.status).toBe(202);
    const receipt = sendInteractionReceipt.mock.calls[0][0];
    expect(receipt).toMatchObject({
      interaction: "card_drilldown",
      producing_tool: "graph.read_cypher",
      intent_hint: "read from the graph",
    });
  });

  it("drops non-whitelisted kinds, tools and free-text hints — still 202, nothing dispatched", async () => {
    const rejects = [
      // tool_launch is server-side only; the browser cannot claim launches.
      { interaction: "tool_launch", entity_id: "x", producing_tool: "kg_rag.query" },
      // unknown/unlisted producing tool (srag.query is feedback-eligible on the
      // backend but NOT part of this surface's verified emitters).
      { interaction: "fold_out", entity_id: "x", producing_tool: "srag.query" },
      { interaction: "fold_out", entity_id: "x", producing_tool: "rm -rf" },
      // client-supplied hints are ignored wholesale — hint comes from the map.
      {
        interaction: "fold_out",
        entity_id: "x",
        producing_tool: "kg_rag.query",
        intent_hint: "junk",
      },
      // missing fields / garbage shapes
      { interaction: "fold_out" },
      {},
      [],
      "text",
    ];

    for (const body of rejects.slice(0, 3).concat(rejects.slice(4))) {
      sendInteractionReceipt.mockClear();
      const resp = await invokeReceipts(body);
      expect(resp.status).toBe(202);
      await expect(resp.json()).resolves.toMatchObject({ accepted: false });
      expect(sendInteractionReceipt).not.toHaveBeenCalled();
    }

    // The hint-injection case IS accepted (valid kind+tool) but the receipt
    // carries the map's hint, not the client's.
    sendInteractionReceipt.mockClear();
    const resp = await invokeReceipts(rejects[3]);
    expect(resp.status).toBe(202);
    expect(sendInteractionReceipt.mock.calls[0][0].intent_hint).toBe("intelligence stack");
  });

  it("clamps entity_id and survives malformed JSON with a 202", async () => {
    const POST = (
      Route as unknown as {
        options: {
          server: { handlers: { POST: (ctx: { request: Request }) => Promise<Response> } };
        };
      }
    ).options.server.handlers.POST;
    const resp = await POST({
      request: new Request("https://example.test/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
    });
    expect(resp.status).toBe(202);
    await expect(resp.json()).resolves.toMatchObject({ accepted: false });

    const long = await invokeReceipts({
      interaction: "fold_out",
      entity_id: "e".repeat(1000),
      producing_tool: "kg_rag.query",
    });
    expect(long.status).toBe(202);
    const receipt = sendInteractionReceipt.mock.calls.at(-1)?.[0];
    expect(receipt.entity_id.length).toBeLessThanOrEqual(240);
  });

  it("a rejected backend dispatch never surfaces to the client", async () => {
    sendInteractionReceipt.mockRejectedValueOnce(new Error("backend down"));
    const resp = await invokeReceipts({
      interaction: "fold_out",
      entity_id: "canvas/t",
      producing_tool: "kg_rag.query",
    });
    expect(resp.status).toBe(202);
    await expect(resp.json()).resolves.toMatchObject({ accepted: true });
  });
});
