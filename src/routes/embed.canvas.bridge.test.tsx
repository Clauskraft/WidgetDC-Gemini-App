// @vitest-environment jsdom
/**
 * End-to-end test for canvas_builder embed bridge (CFDS §9):
 *
 *   1. POST /api/mrp/canvas/resolve  → embed_url + signed token
 *   2. token verifies + decodes to expected payload
 *   3. mount embed bridge (useCanvasBridge) → posts canvas:ready til parent
 *   4. host:hello roundtrip → bridge svarer med canvas:ready { rehello: true }
 *   5. bridge ignorerer beskeder med forkert canvas_id / forkert contract
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useCanvasBridge, type CanvasEmbedPayload, postToHost } from "@/routes/embed.canvas.$canvasId";
import { Route as ResolveRoute } from "@/routes/api/mrp.canvas.resolve";
import {
  BridgeMessageSchema,
  type BridgeMessage,
  ResolveCanvasResponseSchema,
  validateIncomingBridgeMessage,
} from "@/lib/widgetdcContracts";
import { verifyCanvasToken } from "@/lib/widgetdcContracts.server";

/** Render a minimal harness that runs the bridge hook. */
function BridgeHarness({ payload }: { payload: Pick<CanvasEmbedPayload, "canvas_id" | "family" | "intent" | "title"> }) {
  useCanvasBridge(payload);
  return null;
}

function BridgeHarnessWithOrigins({
  payload,
  allowedOrigins,
}: {
  payload: Pick<CanvasEmbedPayload, "canvas_id" | "family" | "intent" | "title">;
  allowedOrigins: readonly string[];
}) {
  useCanvasBridge(payload, { allowedOrigins });
  return null;
}

// React 19 requires this flag for act() to work without warnings.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function invokeResolve(body: unknown): Promise<Response> {
  // TanStack file routes expose handlers via Route.options.server.handlers.
  const POST = (ResolveRoute as unknown as {
    options: { server: { handlers: { POST: (ctx: { request: Request }) => Promise<Response> } } };
  }).options.server.handlers.POST;
  const request = new Request("https://example.test/api/mrp/canvas/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST({ request });
}

describe("canvas_builder embed bridge — end-to-end handshake", () => {
  let container: HTMLDivElement;
  let root: Root;
  let postSpy: ReturnType<typeof vi.fn>;
  let originalParent: Window;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    // postToHost gates on window.parent !== window. jsdom default har parent === self,
    // så vi udskifter window.parent med en stub der har en spy'et postMessage.
    postSpy = vi.fn();
    originalParent = window.parent;
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { postMessage: postSpy } as unknown as Window,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Object.defineProperty(window, "parent", { configurable: true, value: originalParent });
  });

  it("resolverer brief → embed_url med verificerbart token", async () => {
    const res = await invokeResolve({
      brief: "Tegn approval workflow med to godkendere",
      node_types: ["Agent", "Decision"],
      title: "Approval flow",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    const parsed = ResolveCanvasResponseSchema.parse(json);

    expect(parsed.contract_version).toBe("widgetdc.contracts.v1");
    expect(parsed.embed_url).toMatch(/\/embed\/canvas\/[a-f0-9]{16}\?t=/);

    const url = new URL(parsed.embed_url);
    expect(url.pathname).toBe(`/embed/canvas/${parsed.canvas_id}`);
    const token = url.searchParams.get("t");
    expect(token).toBeTruthy();

    const decoded = verifyCanvasToken(token!);
    expect(decoded).not.toBeNull();
    expect(decoded?.canvas_id).toBe(parsed.canvas_id);
    expect(decoded?.family).toBe(parsed.family);
    expect(decoded?.intent).toBe(parsed.intent);
    expect(decoded?.title).toBe("Approval flow");
    expect(decoded?.brief).toContain("approval workflow");
  });

  it("posts canvas:ready ved mount og svarer på host:hello", async () => {
    const res = await invokeResolve({ brief: "approval workflow", title: "T" });
    const json = await res.json();
    const parsed = ResolveCanvasResponseSchema.parse(json);
    const token = new URL(parsed.embed_url).searchParams.get("t")!;
    const decoded = verifyCanvasToken(token)!;
    const payload: Pick<CanvasEmbedPayload, "canvas_id" | "family" | "intent" | "title"> = {
      canvas_id: decoded.canvas_id,
      family: decoded.family,
      intent: decoded.intent,
      title: decoded.title,
    };

    await act(async () => {
      root.render(<BridgeHarness payload={payload} />);
    });

    // 1) canvas:ready posted ved mount
    expect(postSpy).toHaveBeenCalledTimes(1);
    const firstCall = postSpy.mock.calls[0];
    expect(firstCall[1]).toBe("*"); // wildcard target indtil host hello'er
    const ready = BridgeMessageSchema.parse(firstCall[0]);
    expect(ready.type).toBe("canvas:ready");
    expect(ready.canvas_id).toBe(decoded.canvas_id);
    expect(ready.contract).toBe("widgetdc.bridge.v1");
    expect((ready.payload as { family: string }).family).toBe(decoded.family);

    // 2) host:hello → bridge svarer med rehello
    const hostHello: BridgeMessage = {
      v: 1, contract: "widgetdc.bridge.v1", canvas_id: decoded.canvas_id,
      type: "host:hello", ts: Date.now(),
    };
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", { data: hostHello }));
    });
    expect(postSpy).toHaveBeenCalledTimes(2);
    const rehello = BridgeMessageSchema.parse(postSpy.mock.calls[1][0]);
    expect(rehello.type).toBe("canvas:ready");
    expect((rehello.payload as { rehello: boolean }).rehello).toBe(true);

    // 3) forkert canvas_id → emitterer canvas:error med tydelig besked
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        data: { ...hostHello, canvas_id: "not-my-canvas" },
      }));
    });
    expect(postSpy).toHaveBeenCalledTimes(3);
    const idErr = BridgeMessageSchema.parse(postSpy.mock.calls[2][0]);
    expect(idErr.type).toBe("canvas:error");
    expect(idErr.canvas_id).toBe(decoded.canvas_id); // embed beholder sin egen id
    const idErrPayload = idErr.payload as { code: string; message: string; detail: { received_canvas_id: string } };
    expect(idErrPayload.code).toBe("canvas_id_mismatch");
    expect(idErrPayload.message).toContain("not-my-canvas");
    expect(idErrPayload.message).toContain(decoded.canvas_id);
    expect(idErrPayload.detail.received_canvas_id).toBe("not-my-canvas");
    expect(warnSpy).toHaveBeenLastCalledWith(expect.stringContaining("canvas_id_mismatch"));

    // 4) forkert contract-version → wrong_contract_version
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        data: { ...hostHello, contract: "evil.bridge.v0" },
      }));
    });
    expect(postSpy).toHaveBeenCalledTimes(4);
    const ctErr = BridgeMessageSchema.parse(postSpy.mock.calls[3][0]);
    expect(ctErr.type).toBe("canvas:error");
    const ctErrPayload = ctErr.payload as { code: string; message: string };
    expect(ctErrPayload.code).toBe("wrong_contract_version");
    expect(ctErrPayload.message).toContain("evil.bridge.v0");
    expect(ctErrPayload.message).toContain("widgetdc.bridge.v1");

    // 5) helt random payload → invalid_schema med opsamlede zod-issues
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", { data: { hello: "world" } }));
    });
    expect(postSpy).toHaveBeenCalledTimes(5);
    const schErr = BridgeMessageSchema.parse(postSpy.mock.calls[4][0]);
    const schErrPayload = schErr.payload as { code: string; message: string; detail: { issues: string[] } };
    expect(schErrPayload.code).toBe("invalid_schema");
    expect(schErrPayload.message).toMatch(/widgetdc\.bridge\.v1-schemaet/);
    expect(schErrPayload.detail.issues.length).toBeGreaterThan(0);

    warnSpy.mockRestore();
  });

  it("postToHost no-op'er hvis vi ikke er i en iframe (parent === self)", () => {
    Object.defineProperty(window, "parent", { configurable: true, value: window });
    postToHost({
      v: 1, contract: "widgetdc.bridge.v1", canvas_id: "x", type: "canvas:ready", ts: 0,
    });
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("bombarderet med ugyldige payloads → ingen canvas-initiering, kun canvas:error retur", async () => {
    const res = await invokeResolve({ brief: "approval workflow", title: "Bombard" });
    const json = await res.json();
    const parsed = ResolveCanvasResponseSchema.parse(json);
    const token = new URL(parsed.embed_url).searchParams.get("t")!;
    const decoded = verifyCanvasToken(token)!;
    const payload: Pick<CanvasEmbedPayload, "canvas_id" | "family" | "intent" | "title"> = {
      canvas_id: decoded.canvas_id,
      family: decoded.family,
      intent: decoded.intent,
      title: decoded.title,
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await act(async () => {
      root.render(<BridgeHarness payload={payload} />);
    });

    // Den eneste lovlige besked bridge'n udsender på egen hånd er den initielle canvas:ready.
    expect(postSpy).toHaveBeenCalledTimes(1);
    const mountReady = BridgeMessageSchema.parse(postSpy.mock.calls[0][0]);
    expect(mountReady.type).toBe("canvas:ready");

    // Et bredt katalog af ugyldige payloads. Ingen af dem må trigge
    // host:hello-rehello, viewport-updates eller andet end canvas:error.
    const invalidPayloads: unknown[] = [
      // Schema-fejl
      null,
      undefined,
      42,
      "hello",
      [],
      { hello: "world" },
      { v: 1, contract: "widgetdc.bridge.v1", canvas_id: decoded.canvas_id, type: "host:hello" /* mangler ts */ },
      { v: 2, contract: "widgetdc.bridge.v1", canvas_id: decoded.canvas_id, type: "host:hello", ts: 1 },
      { v: 1, contract: "widgetdc.bridge.v1", canvas_id: decoded.canvas_id, type: "rogue:type", ts: 1 },
      // Forkert contract-version
      { v: 1, contract: "evil.bridge.v0", canvas_id: decoded.canvas_id, type: "host:hello", ts: 1 },
      { v: 1, contract: "", canvas_id: decoded.canvas_id, type: "host:hello", ts: 1 },
      // canvas_id-mismatch (forsøg på at tale til et fremmed canvas)
      { v: 1, contract: "widgetdc.bridge.v1", canvas_id: "someone-elses", type: "host:hello", ts: 1 },
      { v: 1, contract: "widgetdc.bridge.v1", canvas_id: "someone-elses", type: "host:update_spec", payload: { brief: "x" }, ts: 1 },
    ];

    for (const data of invalidPayloads) {
      await act(async () => {
        window.dispatchEvent(new MessageEvent("message", { data }));
      });
    }

    // postSpy = 1 mount-ready + N canvas:error. Intet andet.
    expect(postSpy).toHaveBeenCalledTimes(1 + invalidPayloads.length);

    const followUps = postSpy.mock.calls.slice(1).map((c) => BridgeMessageSchema.parse(c[0]));
    for (const msg of followUps) {
      expect(msg.type).toBe("canvas:error");
      // Bridge har ikke "initieret" canvas til en fremmed id — den bevarer sit eget.
      expect(msg.canvas_id).toBe(decoded.canvas_id);
      const p = msg.payload as { code: string; message: string };
      expect(["invalid_schema", "wrong_contract_version", "canvas_id_mismatch"]).toContain(p.code);
      expect(p.message.length).toBeGreaterThan(0);
    }

    // Eksplicit: ingen rehello og ingen ekstra canvas:ready udover mount-beskeden.
    const readyCount = [mountReady, ...followUps].filter((m) => m.type === "canvas:ready").length;
    expect(readyCount).toBe(1);
    const rehelloCount = followUps.filter(
      (m) => m.type === "canvas:ready" && (m.payload as { rehello?: boolean } | undefined)?.rehello,
    ).length;
    expect(rehelloCount).toBe(0);

    // Hver afvisning blev logget med tydelig kode.
    expect(warnSpy).toHaveBeenCalledTimes(invalidPayloads.length);
    for (const call of warnSpy.mock.calls) {
      expect(String(call[0])).toMatch(/\[widgetdc\.bridge\] rejected \((invalid_schema|wrong_contract_version|canvas_id_mismatch)\)/);
    }

    // Sanity: en efterfølgende GYLDIG host:hello virker stadig — bridge er ikke
    // blevet "låst" af de ugyldige beskeder.
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        data: { v: 1, contract: "widgetdc.bridge.v1", canvas_id: decoded.canvas_id, type: "host:hello", ts: Date.now() },
      }));
    });
    const last = BridgeMessageSchema.parse(postSpy.mock.calls.at(-1)![0]);
    expect(last.type).toBe("canvas:ready");
    expect((last.payload as { rehello: boolean }).rehello).toBe(true);

    warnSpy.mockRestore();
  });

  it("afviser alle beskeder fra ikke-allow-listede origins (kun canvas:error retur)", async () => {
    const res = await invokeResolve({ brief: "approval workflow", title: "Origin gate" });
    const json = await res.json();
    const parsed = ResolveCanvasResponseSchema.parse(json);
    const token = new URL(parsed.embed_url).searchParams.get("t")!;
    const decoded = verifyCanvasToken(token)!;
    const payload: Pick<CanvasEmbedPayload, "canvas_id" | "family" | "intent" | "title"> = {
      canvas_id: decoded.canvas_id,
      family: decoded.family,
      intent: decoded.intent,
      title: decoded.title,
    };
    const ALLOWED = "https://host.example";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await act(async () => {
      root.render(
        <BridgeHarnessWithOrigins payload={payload} allowedOrigins={[ALLOWED]} />,
      );
    });

    // Mount: én lovlig canvas:ready til parent.
    expect(postSpy).toHaveBeenCalledTimes(1);
    const mountReady = BridgeMessageSchema.parse(postSpy.mock.calls[0][0]);
    expect(mountReady.type).toBe("canvas:ready");

    // En blanding af onde origins — selv ellers _gyldige_ payloads skal afvises.
    const validPayload: BridgeMessage = {
      v: 1, contract: "widgetdc.bridge.v1", canvas_id: decoded.canvas_id,
      type: "host:hello", ts: Date.now(),
    };
    const evilOrigins = [
      "https://attacker.example",
      "https://host.example.evil.test",   // suffix-trick
      "http://host.example",              // forkert scheme
      "https://host.example:8443",         // forkert port
      "null",                             // sandboxed iframe
      "",                                 // tom origin
    ];

    for (const origin of evilOrigins) {
      await act(async () => {
        window.dispatchEvent(new MessageEvent("message", { data: validPayload, origin }));
      });
    }

    // Hvert evil-origin → præcis ét canvas:error med origin_not_allowed.
    expect(postSpy).toHaveBeenCalledTimes(1 + evilOrigins.length);
    const followUps = postSpy.mock.calls.slice(1).map((c) => BridgeMessageSchema.parse(c[0]));
    for (const [i, msg] of followUps.entries()) {
      expect(msg.type).toBe("canvas:error");
      expect(msg.canvas_id).toBe(decoded.canvas_id);
      const p = msg.payload as { code: string; message: string; detail: { received_origin: string | null; allowed_origins: string[] } };
      expect(p.code).toBe("origin_not_allowed");
      expect(p.detail.allowed_origins).toEqual([ALLOWED]);
      expect(p.detail.received_origin === null || p.detail.received_origin === evilOrigins[i]).toBe(true);
    }
    // Ingen rehello / canvas:ready udover mount — broen er ikke "initieret".
    expect(followUps.some((m) => m.type === "canvas:ready")).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(evilOrigins.length);
    for (const call of warnSpy.mock.calls) {
      expect(String(call[0])).toContain("origin_not_allowed");
    }

    // Origin-check har forrang over schema-check: en BÅDE-ond-origin OG ond-payload
    // må kun rapportere origin_not_allowed (ikke afsløre schema-detaljer).
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        data: { hello: "garbage" },
        origin: "https://attacker.example",
      }));
    });
    const last = BridgeMessageSchema.parse(postSpy.mock.calls.at(-1)![0]);
    expect((last.payload as { code: string }).code).toBe("origin_not_allowed");

    // Sanity: en besked fra den faktisk tilladte origin går igennem.
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", { data: validPayload, origin: ALLOWED }));
    });
    const rehello = BridgeMessageSchema.parse(postSpy.mock.calls.at(-1)![0]);
    expect(rehello.type).toBe("canvas:ready");
    expect((rehello.payload as { rehello: boolean }).rehello).toBe(true);

    warnSpy.mockRestore();
  });


  describe("validateIncomingBridgeMessage — pure validator", () => {
    const CID = "canvas-xyz";
    const valid: BridgeMessage = {
      v: 1, contract: "widgetdc.bridge.v1", canvas_id: CID, type: "host:hello", ts: 1,
    };

    it("accepterer korrekt besked", () => {
      const r = validateIncomingBridgeMessage(valid, CID);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.message.type).toBe("host:hello");
    });

    it("afviser forkert contract-version før schema-check", () => {
      const r = validateIncomingBridgeMessage({ ...valid, contract: "old.v0" }, CID);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.rejection.code).toBe("wrong_contract_version");
        expect(r.rejection.detail).toMatchObject({
          received_contract: "old.v0",
          expected_contract: "widgetdc.bridge.v1",
        });
      }
    });

    it("afviser canvas_id-mismatch med begge id'er i fejlbesked", () => {
      const r = validateIncomingBridgeMessage({ ...valid, canvas_id: "other" }, CID);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.rejection.code).toBe("canvas_id_mismatch");
        expect(r.rejection.message).toContain("other");
        expect(r.rejection.message).toContain(CID);
      }
    });

    it("afviser schema-fejl med oplistede issues", () => {
      const r = validateIncomingBridgeMessage(
        { v: 2, contract: "widgetdc.bridge.v1", canvas_id: CID, type: "host:hello", ts: -1 },
        CID,
      );
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.rejection.code).toBe("invalid_schema");
        expect((r.rejection.detail as { issues: string[] }).issues.length).toBeGreaterThan(0);
      }
    });

    it("afviser ukendt message type med invalid_schema", () => {
      const r = validateIncomingBridgeMessage({ ...valid, type: "rogue:type" }, CID);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.rejection.code).toBe("invalid_schema");
    });

    it("afviser null/primitive payloads", () => {
      for (const v of [null, undefined, 42, "hej", []]) {
        const r = validateIncomingBridgeMessage(v, CID);
        expect(r.ok).toBe(false);
      }
    });
  });
});
