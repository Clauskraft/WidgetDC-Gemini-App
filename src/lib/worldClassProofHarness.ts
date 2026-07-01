export type ProofHarnessStatus = "passed" | "missing_evidence" | "failed";

export type WorldClassProofHarnessEvidence = {
  evidence_ref: string;
  evidence_level: "diagnostic_only" | "runtime_proof";
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
  visual: {
    tested_viewports: number;
    clean_viewports: number;
    blank_primary_panels: number;
    overlap_defects: number;
    clipping_defects: number;
    unreadable_text_defects: number;
  };
  accessibility: {
    keyboard_path_required: number;
    keyboard_path_verified: number;
    visible_focus_targets: number;
    semantic_region_count: number;
    activation_controls_disabled_until_approval: boolean;
  };
  performance: {
    work_mode_switch_p95_ms: number | null;
    library_filter_p95_ms: number | null;
    recipe_preview_p95_ms: number | null;
  };
  runtime: {
    deployed_sha: string | null;
    consecutive_runtime_passes: number;
  };
};

export type WorldClassProofHarnessSummary = {
  evidence_ref: string;
  evidence_level: WorldClassProofHarnessEvidence["evidence_level"];
  visual_status: ProofHarnessStatus;
  accessibility_status: ProofHarnessStatus;
  performance_status: ProofHarnessStatus;
  runtime_status: ProofHarnessStatus;
  visual_ratio: number;
  keyboard_ratio: number;
  max_interaction_p95_ms: number | null;
  blockers: string[];
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
};

export const WORLD_CLASS_PROOF_TARGETS = {
  visual_clean_ratio: 1,
  keyboard_path_ratio: 1,
  work_mode_switch_p95_ms: 250,
  library_filter_p95_ms: 150,
  recipe_preview_p95_ms: 250,
  runtime_passes: 3,
} as const;

export const WORLD_CLASS_DIAGNOSTIC_PROOF: WorldClassProofHarnessEvidence = {
  evidence_ref: "e2e/world-class-proof.spec.ts",
  evidence_level: "diagnostic_only",
  candidate_only: true,
  projection_only: true,
  graph_write_allowed: false,
  proof_eligible: false,
  visual: {
    tested_viewports: 2,
    clean_viewports: 2,
    blank_primary_panels: 0,
    overlap_defects: 0,
    clipping_defects: 0,
    unreadable_text_defects: 0,
  },
  accessibility: {
    keyboard_path_required: 3,
    keyboard_path_verified: 3,
    visible_focus_targets: 7,
    semantic_region_count: 5,
    activation_controls_disabled_until_approval: true,
  },
  performance: {
    work_mode_switch_p95_ms: 180,
    library_filter_p95_ms: 120,
    recipe_preview_p95_ms: 320,
  },
  runtime: {
    deployed_sha: null,
    consecutive_runtime_passes: 0,
  },
};

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function hasNoLayoutDefects(evidence: WorldClassProofHarnessEvidence) {
  return (
    evidence.visual.tested_viewports > 0 &&
    evidence.visual.clean_viewports === evidence.visual.tested_viewports &&
    evidence.visual.blank_primary_panels === 0 &&
    evidence.visual.overlap_defects === 0 &&
    evidence.visual.clipping_defects === 0 &&
    evidence.visual.unreadable_text_defects === 0
  );
}

function hasKeyboardPath(evidence: WorldClassProofHarnessEvidence) {
  return (
    evidence.accessibility.keyboard_path_required > 0 &&
    evidence.accessibility.keyboard_path_verified >=
      evidence.accessibility.keyboard_path_required &&
    evidence.accessibility.visible_focus_targets >= evidence.accessibility.keyboard_path_required &&
    evidence.accessibility.semantic_region_count >= 5 &&
    evidence.accessibility.activation_controls_disabled_until_approval
  );
}

function performanceValuePasses(value: number | null, target: number) {
  return value !== null && value <= target;
}

export function summarizeWorldClassProofHarness(
  evidence: WorldClassProofHarnessEvidence,
): WorldClassProofHarnessSummary {
  const visualRatio = ratio(evidence.visual.clean_viewports, evidence.visual.tested_viewports);
  const keyboardRatio = ratio(
    evidence.accessibility.keyboard_path_verified,
    evidence.accessibility.keyboard_path_required,
  );
  const performanceValues = [
    evidence.performance.work_mode_switch_p95_ms,
    evidence.performance.library_filter_p95_ms,
    evidence.performance.recipe_preview_p95_ms,
  ].filter((value): value is number => value !== null);
  const performancePassed =
    performanceValuePasses(
      evidence.performance.work_mode_switch_p95_ms,
      WORLD_CLASS_PROOF_TARGETS.work_mode_switch_p95_ms,
    ) &&
    performanceValuePasses(
      evidence.performance.library_filter_p95_ms,
      WORLD_CLASS_PROOF_TARGETS.library_filter_p95_ms,
    ) &&
    performanceValuePasses(
      evidence.performance.recipe_preview_p95_ms,
      WORLD_CLASS_PROOF_TARGETS.recipe_preview_p95_ms,
    );
  const blockers = [
    ...(!hasNoLayoutDefects(evidence)
      ? ["Visual sanity harness has failing or missing layout evidence."]
      : []),
    ...(!hasKeyboardPath(evidence) ? ["Keyboard accessibility path is incomplete."] : []),
    ...(!performancePassed ? ["Performance p95 evidence is missing or above target."] : []),
    ...(evidence.evidence_level !== "runtime_proof" ||
    evidence.runtime.consecutive_runtime_passes < WORLD_CLASS_PROOF_TARGETS.runtime_passes
      ? ["Runtime proof still requires deploy SHA readback and 3 consecutive passes."]
      : []),
  ];

  return {
    evidence_ref: evidence.evidence_ref,
    evidence_level: evidence.evidence_level,
    visual_status: hasNoLayoutDefects(evidence) ? "passed" : "failed",
    accessibility_status: hasKeyboardPath(evidence) ? "passed" : "failed",
    performance_status: performancePassed ? "passed" : "missing_evidence",
    runtime_status:
      evidence.evidence_level === "runtime_proof" &&
      evidence.runtime.consecutive_runtime_passes >= WORLD_CLASS_PROOF_TARGETS.runtime_passes
        ? "passed"
        : "missing_evidence",
    visual_ratio: visualRatio,
    keyboard_ratio: keyboardRatio,
    max_interaction_p95_ms: performanceValues.length > 0 ? Math.max(...performanceValues) : null,
    blockers,
    candidate_only: true,
    projection_only: true,
    graph_write_allowed: false,
    proof_eligible: false,
  };
}
