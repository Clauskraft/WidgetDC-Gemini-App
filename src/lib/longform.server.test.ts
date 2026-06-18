import { describe, it, expect } from "vitest";
import { parseOutline, extractFolded } from "./widgetdc.server";

describe("parseOutline (long-form outline parsing)", () => {
  it("parses a numbered outline into clean titles", () => {
    const text = `Here's the outline:
1. Executive Summary
2. Market Context
3) Strategic Options
- Risks and Mitigations`;
    expect(parseOutline(text)).toEqual([
      "Executive Summary",
      "Market Context",
      "Strategic Options",
      "Risks and Mitigations",
    ]);
  });

  it("strips markdown headings + bold and drops meta/preamble lines", () => {
    const text = `## Introduction\n**Background**\nSections:\n* Conclusion`;
    expect(parseOutline(text)).toEqual(["Introduction", "Background", "Conclusion"]);
  });

  it("caps the number of titles and ignores over-long lines", () => {
    const text = ["1. A", "2. B", "3. C", "4. D"].join("\n");
    expect(parseOutline(text, 2)).toEqual(["A", "B"]);
    expect(parseOutline(`1. ${"x".repeat(250)}`)).toEqual([]);
  });
});

describe("extractFolded (context_fold envelope)", () => {
  it("reads folded/compressed/summary/text/content across shapes", () => {
    expect(extractFolded({ result: { folded: "F" } })).toBe("F");
    expect(extractFolded({ result: { folded_context: { content: "FC" } } })).toBe("FC");
    expect(extractFolded({ compressed: "C" })).toBe("C");
    expect(extractFolded({ summary: "S" })).toBe("S");
    expect(extractFolded({ text: "T" })).toBe("T");
    expect(extractFolded("bare")).toBe("bare");
  });

  it("returns null when there is no usable text", () => {
    expect(extractFolded({ status: "ok" })).toBeNull();
    expect(extractFolded(null)).toBeNull();
    expect(extractFolded("   ")).toBeNull();
  });
});
