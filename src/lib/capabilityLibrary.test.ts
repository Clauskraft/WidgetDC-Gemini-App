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

  it("emits first-class style profile candidates with explicit style contract boundaries", () => {
    const library = buildCapabilityLibrary();
    const cyberProfile = library.find((entry) => entry.id === "style_profile:cyber-threat-model");

    expect(cyberProfile?.style_profile).toMatchObject({
      profile_id: "style_profile:cyber-threat-model",
      brand_name: "Cyber threat model",
      density: "dense",
      tone: "risk-focused",
      diagram_family: "attack_surface",
      executive_depth: "controls-and-risk",
      visual_risk_level: "high",
      candidate_only: true,
      projection_only: true,
      graph_write_allowed: false,
      proof_eligible: false,
    });
    expect(cyberProfile?.style_profile?.palette).toEqual(
      expect.arrayContaining(["ink", "signal-red", "control-blue"]),
    );
    expect(cyberProfile?.style_profile?.artifact_targets).toEqual(
      expect.arrayContaining(["threat-model", "risk-brief", "control-map"]),
    );
  });

  it("emits first-class visual strategy candidates with no provider or graph side effects", () => {
    const library = buildCapabilityLibrary();
    const dataModelStrategy = library.find((entry) => entry.id === "visual_strategy:data-model");

    expect(dataModelStrategy?.visual_strategy).toMatchObject({
      strategy_id: "visual_strategy:data-model",
      intent: "data-model",
      visualization_family: "erd",
      mermaid_type: "er",
      drawio_type: "er",
      artifact_target: "structured-diagram",
      widget_slot: "widget.slot.vibe-canvas",
      proof_boundary: "candidate_only_visual_strategy",
      provider_executions: 0,
      graph_writes: 0,
      claim_mutations: 0,
      graph_write_allowed: false,
      proof_eligible: false,
    });
    expect(dataModelStrategy?.visual_strategy?.style_profile_ids).toContain(
      "style_profile:technical-architecture",
    );
  });
});
