import { describe, expect, it } from "vitest";
import { getGem } from "./gems";

describe("Cyber and OSINT widget metadata", () => {
  it("defines Cyber Defender patterns and data surfaces", () => {
    const cyber = getGem("cyber-defender");

    expect(cyber?.patterns?.map((p) => p.title)).toEqual(
      expect.arrayContaining(["Threat Model Canvas", "ATT&CK Detection Engineering"]),
    );
    expect(cyber?.dataSurfaces?.map((s) => s.title)).toEqual(
      expect.arrayContaining(["Detection telemetry", "Vulnerability intel"]),
    );
    expect(cyber?.systemPrompt).toContain("Preferred operating patterns");
    expect(cyber?.systemPrompt).toContain("Data surfaces");
  });

  it("defines OSINT Analyst patterns and lawful data surfaces", () => {
    const osint = getGem("osint-analyst");

    expect(osint?.patterns?.map((p) => p.title)).toEqual(
      expect.arrayContaining(["Selector Pivot Graph", "Verification Ledger"]),
    );
    expect(osint?.dataSurfaces?.map((s) => s.title)).toEqual(
      expect.arrayContaining(["Network & domains", "Media & geospatial"]),
    );
    expect(osint?.systemPrompt).toContain("lawful/open or user-provided data");
    expect(osint?.systemPrompt).toContain("never invent live findings");
  });
});
