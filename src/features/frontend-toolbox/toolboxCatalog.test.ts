import { describe, expect, it } from "vitest";
import { TOOLBOX_PATTERNS, getToolboxPatternsBySource } from "./toolboxCatalog";

describe("toolboxCatalog", () => {
  it("keeps all imported patterns candidate or diagnostic only", () => {
    expect(TOOLBOX_PATTERNS.length).toBeGreaterThanOrEqual(8);
    expect(
      TOOLBOX_PATTERNS.every((pattern) => ["candidate", "diagnostic"].includes(pattern.boundary)),
    ).toBe(true);
  });

  it("separates OpenWiki and Page Agent pattern sources", () => {
    expect(getToolboxPatternsBySource("openwiki").map((pattern) => pattern.id)).toContain(
      "knowledge-pack-factory",
    );
    expect(getToolboxPatternsBySource("page-agent").map((pattern) => pattern.id)).toContain(
      "cockpit-dom-agent",
    );
  });

  it("never assigns command authority to Gemini App patterns", () => {
    expect(TOOLBOX_PATTERNS.every((pattern) => pattern.authority !== "command")).toBe(true);
  });
});
