import { describe, expect, it } from "vitest";
import {
  WORLD_CLASS_DIAGNOSTIC_PROOF,
  WORLD_CLASS_PROOF_TARGETS,
  summarizeWorldClassProofHarness,
} from "@/lib/worldClassProofHarness";

describe("worldClassProofHarness", () => {
  it("keeps diagnostic proof separate from runtime proof", () => {
    const summary = summarizeWorldClassProofHarness(WORLD_CLASS_DIAGNOSTIC_PROOF);

    expect(summary.evidence_level).toBe("diagnostic_only");
    expect(summary.visual_status).toBe("passed");
    expect(summary.accessibility_status).toBe("passed");
    expect(summary.performance_status).toBe("passed");
    expect(summary.runtime_status).toBe("missing_evidence");
    expect(summary.graph_write_allowed).toBe(false);
    expect(summary.proof_eligible).toBe(false);
    expect(summary.blockers).toContain(
      "Runtime proof still requires deploy SHA readback and 3 consecutive passes.",
    );
  });

  it("fails closed when visual or keyboard evidence is incomplete", () => {
    const summary = summarizeWorldClassProofHarness({
      ...WORLD_CLASS_DIAGNOSTIC_PROOF,
      visual: {
        ...WORLD_CLASS_DIAGNOSTIC_PROOF.visual,
        overlap_defects: 1,
      },
      accessibility: {
        ...WORLD_CLASS_DIAGNOSTIC_PROOF.accessibility,
        keyboard_path_verified: 2,
      },
    });

    expect(summary.visual_status).toBe("failed");
    expect(summary.accessibility_status).toBe("failed");
    expect(summary.blockers).toEqual(
      expect.arrayContaining([
        "Visual sanity harness has failing or missing layout evidence.",
        "Keyboard accessibility path is incomplete.",
      ]),
    );
  });

  it("documents the exact latency targets used by the cockpit contract", () => {
    expect(WORLD_CLASS_PROOF_TARGETS.work_mode_switch_p95_ms).toBe(250);
    expect(WORLD_CLASS_PROOF_TARGETS.library_filter_p95_ms).toBe(150);
    expect(WORLD_CLASS_PROOF_TARGETS.recipe_preview_p95_ms).toBe(250);
  });

  it("keeps diagnostic performance evidence aligned with the e2e latency targets", () => {
    const summary = summarizeWorldClassProofHarness(WORLD_CLASS_DIAGNOSTIC_PROOF);

    expect(summary.max_interaction_p95_ms).toBeLessThanOrEqual(
      WORLD_CLASS_PROOF_TARGETS.work_mode_switch_p95_ms,
    );
    expect(summary.performance_status).toBe("passed");
  });

  it("does not pass performance evidence when any click feedback sample is above 250ms", () => {
    const summary = summarizeWorldClassProofHarness({
      ...WORLD_CLASS_DIAGNOSTIC_PROOF,
      performance: {
        ...WORLD_CLASS_DIAGNOSTIC_PROOF.performance,
        recipe_preview_p95_ms: 320,
      },
    });

    expect(summary.max_interaction_p95_ms).toBe(320);
    expect(summary.performance_status).toBe("missing_evidence");
    expect(summary.blockers).toContain("Performance p95 evidence is missing or above target.");
  });
});
