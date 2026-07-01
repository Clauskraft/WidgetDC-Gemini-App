import { describe, expect, it } from "vitest";
import { buildCapabilityLibrary } from "@/lib/capabilityLibrary";

describe("capabilityLibrary", () => {
  it("emits skills agents patterns widgets routes and proof gates as read-only candidates", () => {
    const library = buildCapabilityLibrary();
    const kinds = new Set(library.map((entry) => entry.kind));

    expect(kinds).toEqual(
      new Set(["skill", "agent", "pattern", "widget", "route", "proof_gate", "work_mode"]),
    );
    expect(library.length).toBeGreaterThan(20);
    expect(library.map((entry) => entry.id)).toContain("widget.slot.vibe-canvas");
    for (const entry of library) {
      expect(entry.candidate_only).toBe(true);
      expect(entry.projection_only).toBe(true);
      expect(entry.graph_write_allowed).toBe(false);
      expect(entry.proof_eligible).toBe(false);
      expect(entry.required_competences.length).toBeGreaterThan(0);
      expect(entry.provided_competences.length).toBeGreaterThan(0);
      expect(entry.source_fit_score).toBeGreaterThanOrEqual(0);
      expect(entry.source_fit_score).toBeLessThanOrEqual(1);
      expect(entry.extraction_contract.validation_status).toBe("candidate_only");
    }
  });
});
