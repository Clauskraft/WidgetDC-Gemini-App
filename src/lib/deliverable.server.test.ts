import { describe, it, expect } from "vitest";
import { extractDeliverable, extractQuality } from "./widgetdc.server";

describe("extractDeliverable (Phase 1 Deliverable Studio)", () => {
  it("returns markdown + 0 citations for a bare string", () => {
    expect(extractDeliverable("# Title\n\nbody")).toEqual({
      markdown: "# Title\n\nbody",
      citations: 0,
    });
  });

  it("unwraps the standard { result } MCP envelope", () => {
    const env = {
      call_id: "x",
      status: "success",
      result: { markdown: "## Heading", citations: [1, 2, 3] },
    };
    expect(extractDeliverable(env)).toEqual({ markdown: "## Heading", citations: 3 });
  });

  it("falls back across content/document/deliverable/report fields", () => {
    expect(extractDeliverable({ content: "from content" })?.markdown).toBe("from content");
    expect(extractDeliverable({ document: "from document" })?.markdown).toBe("from document");
    expect(extractDeliverable({ deliverable: "from deliverable" })?.markdown).toBe(
      "from deliverable",
    );
    expect(extractDeliverable({ report: "from report" })?.markdown).toBe("from report");
  });

  it("reads a numeric citation_count when no array is present", () => {
    expect(extractDeliverable({ markdown: "x", citation_count: 7 })?.citations).toBe(7);
  });

  it("returns null for empty / non-markdown payloads", () => {
    expect(extractDeliverable("   ")).toBeNull();
    expect(extractDeliverable(null)).toBeNull();
    expect(extractDeliverable({ unrelated: true })).toBeNull();
    expect(extractDeliverable(42)).toBeNull();
  });
});

describe("extractQuality (PRISM gate)", () => {
  it("reads aggregate + dimensions", () => {
    const env = { result: { aggregate: 8.8, dimensions: { precision: 9, safety: 10 } } };
    expect(extractQuality(env)).toEqual({ score: 8.8, dimensions: { precision: 9, safety: 10 } });
  });

  it("falls back to overall then score", () => {
    expect(extractQuality({ overall: 7.5 })?.score).toBe(7.5);
    expect(extractQuality({ score: 6 })?.score).toBe(6);
  });

  it("returns null when no numeric score is present", () => {
    expect(extractQuality({ verdict: "good" })).toBeNull();
    expect(extractQuality(null)).toBeNull();
  });
});
