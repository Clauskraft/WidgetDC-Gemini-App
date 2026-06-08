import { describe, it, expect } from "vitest";
import { extractCouncilResult } from "./widgetdc.server";

describe("extractCouncilResult (Phase 4 MoA Council)", () => {
  it("extracts merged text + agents + confidence from a moa_query envelope", () => {
    const env = {
      result: {
        merged: "Consensus answer across agents.",
        agents: ["master", "omega", "lc-prometheus"],
        confidence: 0.6,
        domains: ["architecture", "operations"],
      },
    };
    const out = extractCouncilResult(env);
    expect(out?.text).toBe("Consensus answer across agents.");
    expect(out?.meta.provider).toBe("MoA Council");
    expect(out?.meta.model).toBe("master, omega, lc-prometheus");
    expect(out?.meta.confidence).toBe(0.6);
    expect(out?.meta.domain).toBe("architecture, operations");
  });

  it("accepts agent objects with id and falls back across answer/response fields", () => {
    expect(extractCouncilResult({ answer: "A" })?.text).toBe("A");
    expect(extractCouncilResult({ response: "B" })?.text).toBe("B");
    const withObjs = extractCouncilResult({ merged: "x", agents: [{ id: "a1" }, { id: "a2" }] });
    expect(withObjs?.meta.model).toBe("a1, a2");
  });

  it("treats a bare string as the merged answer", () => {
    expect(extractCouncilResult("plain merged")).toEqual({
      text: "plain merged",
      meta: { provider: "MoA Council" },
    });
  });

  it("returns null when there is no answer text", () => {
    expect(extractCouncilResult({ agents: ["x"] })).toBeNull();
    expect(extractCouncilResult(null)).toBeNull();
  });
});
