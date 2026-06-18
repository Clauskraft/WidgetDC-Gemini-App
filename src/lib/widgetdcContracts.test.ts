import { describe, expect, it } from "vitest";
import {
  BridgeMessageSchema,
  ResolveCanvasRequestSchema,
  buildEmbedUrl,
  isAllowedOrigin,
} from "./widgetdcContracts";
import { deriveCanvasId, signCanvasToken, verifyCanvasToken } from "./widgetdcContracts.server";

describe("widgetdcContracts", () => {
  it("validerer ResolveCanvasRequest snake_case body", () => {
    const ok = ResolveCanvasRequestSchema.safeParse({
      brief: "Tegn approval workflow",
      node_types: ["Agent", "Decision"],
    });
    expect(ok.success).toBe(true);
    const bad = ResolveCanvasRequestSchema.safeParse({ brief: "" });
    expect(bad.success).toBe(false);
  });

  it("signerer og verificerer canvas-token roundtrip", () => {
    const payload = {
      canvas_id: "abc123",
      intent: "business-process",
      family: "bpmn",
      mermaid_type: "flowchart",
      drawio_type: "flowchart",
      brief: "approval flow",
      flow_spec: { nodes: [{ id: "a", label: "Start", kind: "Agent" }], edges: [] },
      exp: Math.floor(Date.now() / 1000) + 60,
    };
    const token = signCanvasToken(payload);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const verified = verifyCanvasToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.canvas_id).toBe("abc123");
    expect(verified?.family).toBe("bpmn");
  });

  it("afviser tampered token", () => {
    const token = signCanvasToken({
      canvas_id: "x",
      intent: "system-architecture",
      family: "c4",
      mermaid_type: "c4",
      drawio_type: "c4",
      brief: "b",
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const tampered = token.replace(/.$/, (c) => (c === "a" ? "b" : "a"));
    expect(verifyCanvasToken(tampered)).toBeNull();
  });

  it("afviser udløbet token", () => {
    const token = signCanvasToken({
      canvas_id: "x",
      intent: "system-architecture",
      family: "c4",
      mermaid_type: "c4",
      drawio_type: "c4",
      brief: "b",
      exp: Math.floor(Date.now() / 1000) - 1,
    });
    expect(verifyCanvasToken(token)).toBeNull();
  });

  it("bygger deterministisk canvas_id og embed_url", () => {
    const id1 = deriveCanvasId("brief x", "bpmn");
    const id2 = deriveCanvasId("brief x", "bpmn");
    expect(id1).toBe(id2);
    expect(id1).toHaveLength(16);
    const url = buildEmbedUrl("https://aurora.widgetdc.app/", id1, "tok.sig");
    expect(url).toBe(`https://aurora.widgetdc.app/embed/canvas/${id1}?t=tok.sig`);
  });

  it("BridgeMessage kræver v=1 + contract-versionering", () => {
    expect(
      BridgeMessageSchema.safeParse({
        v: 1,
        contract: "widgetdc.bridge.v1",
        canvas_id: "c",
        type: "canvas:ready",
        ts: 1,
      }).success,
    ).toBe(true);
    expect(
      BridgeMessageSchema.safeParse({
        v: 1,
        contract: "wrong",
        canvas_id: "c",
        type: "canvas:ready",
        ts: 1,
      }).success,
    ).toBe(false);
    expect(
      BridgeMessageSchema.safeParse({
        v: 1,
        contract: "widgetdc.bridge.v1",
        canvas_id: "c",
        type: "rogue",
        ts: 1,
      }).success,
    ).toBe(false);
  });

  it("isAllowedOrigin matcher præcis origin", () => {
    expect(isAllowedOrigin("https://a.com", ["https://a.com"])).toBe(true);
    expect(isAllowedOrigin("https://a.com:443", ["https://a.com"])).toBe(true);
    expect(isAllowedOrigin("https://b.com", ["https://a.com"])).toBe(false);
    expect(isAllowedOrigin(null, ["*"])).toBe(false);
    expect(isAllowedOrigin("https://anything", ["*"])).toBe(true);
  });
});
