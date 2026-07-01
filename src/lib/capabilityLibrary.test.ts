import { describe, expect, it } from "vitest";
import { buildCapabilityLibrary, filterCapabilityLibrary } from "@/lib/capabilityLibrary";

describe("capabilityLibrary", () => {
  it("emits all cockpit capability kinds as read-only candidates", () => {
    const library = buildCapabilityLibrary();
    const kinds = new Set(library.map((entry) => entry.kind));

    expect(kinds).toEqual(
      new Set([
        "skill",
        "agent",
        "pattern",
        "widget",
        "route",
        "proof_gate",
        "work_mode",
        "style_profile",
        "visual_strategy",
      ]),
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
      expect(entry.evidence).toMatch(/candidate|graph_readback|runtime_proof/);
    }
  });

  it("filters capability candidates by kind, domain, readiness, evidence and query", () => {
    const library = buildCapabilityLibrary();
    const filtered = filterCapabilityLibrary(library, {
      kind: "style_profile",
      domain: "cyber",
      readiness: "preview_ready",
      evidence: "source_backed_candidate",
      query: "threat model",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      id: "style_profile:cyber-threat-model",
      graph_write_allowed: false,
      proof_eligible: false,
    });
  });
});
