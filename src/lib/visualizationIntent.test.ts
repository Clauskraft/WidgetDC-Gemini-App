import { describe, it, expect } from "vitest";
import { detectIntent, detectMermaidType, isMermaidMismatch } from "./visualizationIntent";

describe("detectIntent", () => {
  it("returns low confidence and no mismatch trigger for a single weak keyword", () => {
    // "entitet" alene giver +2 → medium, ikke high → MermaidBlock viser ikke !mismatch.
    const det = detectIntent("Et flowchart der viser en entitet og dens flow.");
    expect(det.confidence).not.toBe("high");
    expect(det.matchedSignals.length).toBeGreaterThan(0);
    expect(det.reason).toMatch(/Nedjusteret|Lav|Medium/);
  });

  it("returns high confidence when ≥4 score is reached", () => {
    const det = detectIntent("data model entity relation schema tabel", []);
    expect(det.intent).toBe("data-model");
    expect(det.confidence).toBe("high");
    expect(det.score).toBeGreaterThanOrEqual(4);
    expect(det.matchedSignals.every((s) => s.kind === "keyword")).toBe(true);
  });

  it("records node-type bias signals separately with weight 1", () => {
    const det = detectIntent("agent flow", ["Agent"]);
    const nodeSignals = det.matchedSignals.filter((s) => s.kind === "node-type");
    expect(nodeSignals).toEqual([{ kind: "node-type", token: "Agent", weight: 1 }]);
  });

  it("defaults to system-architecture with a reason when no signals match", () => {
    const det = detectIntent("xyz");
    expect(det.intent).toBe("system-architecture");
    expect(det.confidence).toBe("low");
    expect(det.reason).toMatch(/Ingen signaler|Lav/);
  });

  it("only flags mismatch when intent expectation differs from actual mermaid type", () => {
    const det = detectIntent("data model entity relation schema tabel");
    expect(det.confidence).toBe("high");
    // Body er flowchart, men intent forventer 'er' → mismatch.
    expect(isMermaidMismatch(det.intent, detectMermaidType("graph TD\nA-->B"))).toBe(true);
    // Body er ER → ingen mismatch.
    expect(isMermaidMismatch(det.intent, detectMermaidType("erDiagram\nA ||--o{ B : has"))).toBe(false);
  });
});
