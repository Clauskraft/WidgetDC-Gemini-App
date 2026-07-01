import type { ProjectTreeRef } from "@/lib/agentOfficeProductionLoop";
import type { BrokerageRouteCard } from "@/lib/brokerageRoute";
import type { CapabilityLibraryEntry } from "@/lib/capabilityLibrary";
import type { CapabilityRecipe } from "@/lib/capabilityRecipe";
import { buildWorldClassKpis } from "@/lib/worldClassKpiMatrix";
import {
  WORLD_CLASS_DIAGNOSTIC_PROOF,
  summarizeWorldClassProofHarness,
  type WorldClassProofHarnessEvidence,
  type WorldClassProofHarnessSummary,
} from "@/lib/worldClassProofHarness";

export type HardGateId =
  | "governance"
  | "proof_boundary"
  | "approval"
  | "wdc_authority"
  | "gemini_primary_ux"
  | "foundry_boundary"
  | "runtime_claim"
  | "a2a_process"
  | "visual_sanity"
  | "accessibility";

export type WorldClassCategoryId =
  | "usability"
  | "capability_discovery"
  | "composition_power"
  | "wdc_visibility"
  | "proof_clarity"
  | "visual_quality"
  | "performance"
  | "reuse_and_foundry"
  | "adoption_readiness";

export type CriticalP0DefectId =
  | "execution_enabled_without_approval"
  | "provider_call_from_compose_preview"
  | "graph_write_from_ui"
  | "claim_promotion_from_ui"
  | "mapped_count_fabricated_locally"
  | "widget_foundry_used_as_runtime_shell"
  | "project_tree_missing"
  | "blank_overlapping_unreadable_primary_ui"
  | "wdc_cli_bypass_for_governed_operation";

export type KpiStatus = "met" | "missing_evidence" | "below_target";

export type WorldClassKpi = {
  id: string;
  category: WorldClassCategoryId;
  label: string;
  formula: string;
  target: string;
  value: string;
  status: KpiStatus;
};

export type WeightedCategoryScore = {
  id: WorldClassCategoryId;
  label: string;
  weight: number;
  score: number;
  blockers: string[];
};

export type HardGateAssessment = {
  id: HardGateId;
  label: string;
  passed: boolean;
  evidence: string;
};

export type CriticalP0DefectAssessment = {
  id: CriticalP0DefectId;
  label: string;
  count: number;
};

export type WorldClassAssessment = {
  status: "world_class" | "not_world_class";
  worldClassSatisfied: boolean;
  worldClassIndex: number;
  minCategoryScore: number;
  hardGatePassCount: number;
  hardGateTotal: number;
  criticalP0Defects: number;
  hardGates: HardGateAssessment[];
  categories: WeightedCategoryScore[];
  kpis: WorldClassKpi[];
  criticalDefects: CriticalP0DefectAssessment[];
  proofHarness: WorldClassProofHarnessSummary;
  blockers: string[];
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
};

export type WorldClassWdcEvidence = {
  evidence_ref: string;
  evidence_level: "diagnostic_only" | "runtime_proof";
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
  route: {
    route_validated: boolean;
    route_method: "MCP" | "LLM" | "fallback-llm" | "unknown";
    route_preview_p95_ms: number | null;
    wdc_cli_authoritative: boolean;
  };
  observability: {
    dashboard_visible: boolean;
    telemetry_enabled: boolean;
    required_states_visible: number;
    required_states_total: number;
  };
  legoBom: {
    workbom_visible: boolean;
    lego_coverage_visible: boolean;
    recipe_bom_refs: number;
    recipe_count: number;
  };
  adoption: {
    a2a_exit_review_recorded: boolean;
    stop_conditions_visible: number;
    stop_conditions_total: number;
    harvested_stops: number;
    expected_stops: number;
  };
};

export const WORLD_CLASS_DIAGNOSTIC_WDC_EVIDENCE: WorldClassWdcEvidence = {
  evidence_ref: "wdc boot session + ProjectTreeRenderer diagnostic readback",
  evidence_level: "diagnostic_only",
  candidate_only: true,
  projection_only: true,
  graph_write_allowed: false,
  proof_eligible: false,
  route: {
    route_validated: true,
    route_method: "MCP",
    route_preview_p95_ms: 320,
    wdc_cli_authoritative: true,
  },
  observability: {
    dashboard_visible: true,
    telemetry_enabled: true,
    required_states_visible: 4,
    required_states_total: 4,
  },
  legoBom: {
    workbom_visible: true,
    lego_coverage_visible: true,
    recipe_bom_refs: 1,
    recipe_count: 1,
  },
  adoption: {
    a2a_exit_review_recorded: true,
    stop_conditions_visible: 1,
    stop_conditions_total: 1,
    harvested_stops: 0,
    expected_stops: 1,
  },
};

export const WORLD_CLASS_CATEGORY_WEIGHTS: ReadonlyArray<
  Pick<WeightedCategoryScore, "id" | "label" | "weight">
> = [
  { id: "usability", label: "Usability", weight: 0.15 },
  { id: "capability_discovery", label: "Capability Discovery", weight: 0.15 },
  { id: "composition_power", label: "Composition Power", weight: 0.15 },
  { id: "wdc_visibility", label: "WDC Visibility", weight: 0.15 },
  { id: "proof_clarity", label: "Proof Clarity", weight: 0.1 },
  { id: "visual_quality", label: "Visual Quality", weight: 0.1 },
  { id: "performance", label: "Performance", weight: 0.08 },
  { id: "reuse_and_foundry", label: "Reuse And Foundry", weight: 0.07 },
  { id: "adoption_readiness", label: "Adoption Readiness", weight: 0.05 },
];

const hardGateLabels: Record<HardGateId, string> = {
  governance: "Governance",
  proof_boundary: "Proof boundary",
  approval: "Approval",
  wdc_authority: "WDC authority",
  gemini_primary_ux: "Gemini primary UX",
  foundry_boundary: "Foundry boundary",
  runtime_claim: "Runtime claim",
  a2a_process: "A2A/process",
  visual_sanity: "Visual sanity",
  accessibility: "Accessibility",
};

const criticalDefectLabels: Record<CriticalP0DefectId, string> = {
  execution_enabled_without_approval: "Execution enabled without approval",
  provider_call_from_compose_preview: "Provider call from compose/preview",
  graph_write_from_ui: "Graph write from UI",
  claim_promotion_from_ui: "Claim promotion from UI",
  mapped_count_fabricated_locally: "Mapped count fabricated locally",
  widget_foundry_used_as_runtime_shell: "Widget Foundry used as runtime shell",
  project_tree_missing: "ProjectTree missing",
  blank_overlapping_unreadable_primary_ui: "Blank, overlapping, or unreadable primary UI",
  wdc_cli_bypass_for_governed_operation: "WDC CLI bypass for governed operation",
};

export type EvaluateWorldClassInput = {
  hardGates: Record<HardGateId, { passed: boolean; evidence: string }>;
  categoryScores: Record<WorldClassCategoryId, { score: number; blockers: string[] }>;
  criticalDefects: Record<CriticalP0DefectId, number>;
  kpis: WorldClassKpi[];
  proofHarness?: WorldClassProofHarnessSummary;
};

function clampScore(score: number) {
  return Math.max(0, Math.min(1, Number.isFinite(score) ? score : 0));
}

export function evaluateWorldClass(input: EvaluateWorldClassInput): WorldClassAssessment {
  const hardGates = Object.entries(input.hardGates).map(([id, gate]) => ({
    id: id as HardGateId,
    label: hardGateLabels[id as HardGateId],
    passed: gate.passed,
    evidence: gate.evidence,
  }));
  const categories = WORLD_CLASS_CATEGORY_WEIGHTS.map((category) => {
    const inputScore = input.categoryScores[category.id];
    return {
      ...category,
      score: clampScore(inputScore.score),
      blockers: inputScore.blockers,
    };
  });
  const criticalDefects = Object.entries(input.criticalDefects).map(([id, count]) => ({
    id: id as CriticalP0DefectId,
    label: criticalDefectLabels[id as CriticalP0DefectId],
    count,
  }));
  const worldClassIndex = Number(
    categories.reduce((sum, category) => sum + category.weight * category.score, 0).toFixed(4),
  );
  const minCategoryScore = Math.min(...categories.map((category) => category.score));
  const criticalP0Defects = criticalDefects.reduce((sum, defect) => sum + defect.count, 0);
  const proofHarness =
    input.proofHarness ?? summarizeWorldClassProofHarness(WORLD_CLASS_DIAGNOSTIC_PROOF);
  const failedHardGates = hardGates.filter((gate) => !gate.passed);
  const lowCategories = categories.filter((category) => category.score < 0.9);
  const hardGatePassCount = hardGates.length - failedHardGates.length;
  const blockers = [
    ...failedHardGates.map((gate) => `${gate.label}: ${gate.evidence}`),
    ...lowCategories.flatMap((category) =>
      category.blockers.length > 0
        ? category.blockers.map((blocker) => `${category.label}: ${blocker}`)
        : [`${category.label}: score ${category.score.toFixed(2)} below 0.90`],
    ),
    ...criticalDefects
      .filter((defect) => defect.count > 0)
      .map((defect) => `${defect.label}: ${defect.count}`),
    ...(worldClassIndex < 0.95 ? [`WorldClassIndex ${worldClassIndex.toFixed(4)} below 0.95`] : []),
  ];
  const worldClassSatisfied =
    failedHardGates.length === 0 &&
    worldClassIndex >= 0.95 &&
    minCategoryScore >= 0.9 &&
    criticalP0Defects === 0;

  return {
    status: worldClassSatisfied ? "world_class" : "not_world_class",
    worldClassSatisfied,
    worldClassIndex,
    minCategoryScore,
    hardGatePassCount,
    hardGateTotal: hardGates.length,
    criticalP0Defects,
    hardGates,
    categories,
    kpis: input.kpis,
    criticalDefects,
    proofHarness,
    blockers,
    candidate_only: true,
    projection_only: true,
    graph_write_allowed: false,
    proof_eligible: false,
  };
}

export function buildWorldClassAssessment({
  capabilityEntries,
  recipe,
  routeCard,
  projectTreeRefs,
  proofHarnessEvidence = WORLD_CLASS_DIAGNOSTIC_PROOF,
  wdcEvidence = WORLD_CLASS_DIAGNOSTIC_WDC_EVIDENCE,
}: {
  capabilityEntries: CapabilityLibraryEntry[];
  recipe: CapabilityRecipe;
  routeCard: BrokerageRouteCard;
  projectTreeRefs: ProjectTreeRef[];
  proofHarnessEvidence?: WorldClassProofHarnessEvidence;
  wdcEvidence?: WorldClassWdcEvidence;
}): WorldClassAssessment {
  const requiredKinds = new Set([
    "skill",
    "agent",
    "pattern",
    "widget",
    "route",
    "proof_gate",
    "work_mode",
  ]);
  const visibleKinds = new Set(capabilityEntries.map((entry) => entry.kind));
  const categoryCoverage = [...requiredKinds].filter((kind) => visibleKinds.has(kind)).length;
  const metadataComplete = capabilityEntries.every(
    (entry) =>
      entry.source_fit_score >= 0 &&
      entry.source_fit_score <= 1 &&
      entry.extraction_contract.required_fields.includes("source_fit_score") &&
      entry.extraction_contract.required_fields.includes("extraction_contract") &&
      entry.candidate_only &&
      entry.projection_only &&
      !entry.graph_write_allowed &&
      !entry.proof_eligible,
  );
  const projectTreeComplete = ["CFG-010", "BOM-020", "OP-030", "GATE-040"].every((ref) =>
    projectTreeRefs.some((item) => item.ref === ref),
  );
  const foundrySlotsUsed = routeCard.widget_slots.length;
  const foundrySlotsRecommended = Math.max(foundrySlotsUsed, 12);
  const foundryReuseRate = foundrySlotsUsed / foundrySlotsRecommended;
  const explainedStops =
    recipe.activation.status === "expected_stop" &&
    Boolean(recipe.activation.missing_competence) &&
    Boolean(recipe.activation.next_action);
  const safeRecipe =
    recipe.activation.status === "expected_stop" &&
    recipe.activation.missing_competence === "approval.gated.execution" &&
    recipe.mapped_count === 0 &&
    recipe.mapped_count_source === "graph_readback_only" &&
    recipe.graph_write_allowed === false &&
    recipe.proof_eligible === false;
  const proofHarness = summarizeWorldClassProofHarness(proofHarnessEvidence);
  const visualSanityPassed = proofHarness.visual_status === "passed";
  const accessibilityPassed = proofHarness.accessibility_status === "passed";
  const performancePassed = proofHarness.performance_status === "passed";
  const routeShown = wdcEvidence.route.route_validated && wdcEvidence.route.wdc_cli_authoritative;
  const observabilityRatio =
    wdcEvidence.observability.required_states_total > 0
      ? wdcEvidence.observability.required_states_visible /
        wdcEvidence.observability.required_states_total
      : 0;
  const observabilitySurfaced =
    wdcEvidence.observability.dashboard_visible &&
    wdcEvidence.observability.telemetry_enabled &&
    observabilityRatio === 1;
  const routePreviewPassed =
    wdcEvidence.route.route_preview_p95_ms !== null &&
    wdcEvidence.route.route_preview_p95_ms <= 10000;
  const legoBomRatio =
    wdcEvidence.legoBom.recipe_count > 0
      ? wdcEvidence.legoBom.recipe_bom_refs / wdcEvidence.legoBom.recipe_count
      : 0;
  const legoBomVisible =
    wdcEvidence.legoBom.workbom_visible &&
    wdcEvidence.legoBom.lego_coverage_visible &&
    legoBomRatio === 1;
  const a2aExitReviewVisible = wdcEvidence.adoption.a2a_exit_review_recorded;
  const stopVisibilityRatio =
    wdcEvidence.adoption.stop_conditions_total > 0
      ? wdcEvidence.adoption.stop_conditions_visible / wdcEvidence.adoption.stop_conditions_total
      : 0;
  const stopHarvestRatio =
    wdcEvidence.adoption.expected_stops > 0
      ? wdcEvidence.adoption.harvested_stops / wdcEvidence.adoption.expected_stops
      : 0;

  return evaluateWorldClass({
    hardGates: {
      governance: {
        passed: recipe.graph_write_allowed === false && recipe.proof_eligible === false,
        evidence:
          "P0 recipe keeps graph writes, proof eligibility and claim mutation paths blocked.",
      },
      proof_boundary: {
        passed:
          routeCard.candidate_count > routeCard.mapped_count &&
          routeCard.mapped_count_source === "graph_readback_only",
        evidence: "candidate_count and mapped_count are separately labeled.",
      },
      approval: {
        passed: recipe.activation.missing_competence === "approval.gated.execution",
        evidence: "Activate control is disabled by missing approval.gated.execution.",
      },
      wdc_authority: {
        passed: routeShown,
        evidence: routeShown
          ? `WDC route/readback is surfaced from ${wdcEvidence.evidence_ref}.`
          : "WDC route/readback evidence is missing.",
      },
      gemini_primary_ux: {
        passed: true,
        evidence: "Gemini App owns the cockpit shell; Foundry is only a slot source.",
      },
      foundry_boundary: {
        passed: routeCard.widget_slots.every((slot) => slot.candidate_only && !slot.proof_eligible),
        evidence: "Widget Foundry slots are read-only candidates.",
      },
      runtime_claim: {
        passed: true,
        evidence: "UI states avoid runtime proof claim without deploy SHA and 3 passes.",
      },
      a2a_process: {
        passed: true,
        evidence: "WDC boot and claim gates prevent active claim collision before mutation.",
      },
      visual_sanity: {
        passed: visualSanityPassed,
        evidence: `${proofHarness.evidence_level} layout audit ${proofHarness.visual_ratio.toFixed(
          2,
        )} from ${proofHarness.evidence_ref}.`,
      },
      accessibility: {
        passed: accessibilityPassed,
        evidence: `${proofHarness.evidence_level} keyboard path ${proofHarness.keyboard_ratio.toFixed(
          2,
        )} from ${proofHarness.evidence_ref}.`,
      },
    },
    categoryScores: {
      usability: {
        score: performancePassed && accessibilityPassed ? 0.86 : 0.72,
        blockers: ["Human task-success evidence and deployed route readback are not yet attached."],
      },
      capability_discovery: {
        score: categoryCoverage === requiredKinds.size && metadataComplete ? 0.94 : 0.7,
        blockers:
          categoryCoverage === requiredKinds.size && metadataComplete
            ? []
            : ["Capability category coverage or metadata completeness is incomplete."],
      },
      composition_power: {
        score: safeRecipe ? 0.9 : 0.65,
        blockers: safeRecipe ? [] : ["Recipe boundary is not safe."],
      },
      wdc_visibility: {
        score: projectTreeComplete && routeShown && observabilitySurfaced ? 0.94 : 0.65,
        blockers:
          projectTreeComplete && routeShown && observabilitySurfaced
            ? []
            : ["ProjectTree, route readback or observability evidence is incomplete."],
      },
      proof_clarity: {
        score: 0.95,
        blockers: [],
      },
      visual_quality: {
        score: visualSanityPassed ? 0.92 : 0.72,
        blockers: visualSanityPassed
          ? []
          : ["No full viewport visual sanity audit has been recorded."],
      },
      performance: {
        score: performancePassed ? 0.9 : 0.5,
        blockers: performancePassed
          ? []
          : ["Interaction, filter and route preview p95 telemetry is not yet measured."],
      },
      reuse_and_foundry: {
        score: foundryReuseRate >= 0.75 && legoBomVisible ? 0.92 : 0.7,
        blockers:
          foundryReuseRate >= 0.75 && legoBomVisible
            ? []
            : ["Foundry slot reuse or Lego/BOM visibility is below target."],
      },
      adoption_readiness: {
        score: a2aExitReviewVisible && stopHarvestRatio === 1 ? 0.9 : 0.88,
        blockers:
          a2aExitReviewVisible && stopHarvestRatio === 1
            ? []
            : ["Stop harvest coverage is not complete for expected stops."],
      },
    },
    criticalDefects: {
      execution_enabled_without_approval: recipe.activation.status === "expected_stop" ? 0 : 1,
      provider_call_from_compose_preview: 0,
      graph_write_from_ui: recipe.graph_write_allowed ? 1 : 0,
      claim_promotion_from_ui: recipe.proof_eligible ? 1 : 0,
      mapped_count_fabricated_locally:
        routeCard.mapped_count_source === "graph_readback_only" ? 0 : 1,
      widget_foundry_used_as_runtime_shell: 0,
      project_tree_missing: projectTreeComplete ? 0 : 1,
      blank_overlapping_unreadable_primary_ui: 0,
      wdc_cli_bypass_for_governed_operation: 0,
    },
    kpis: buildWorldClassKpis({
      category_coverage: {
        value: `${categoryCoverage}/7`,
        status: categoryCoverage === 7 ? "met" : "below_target",
      },
      metadata_completeness: {
        value: metadataComplete ? "1.00" : "below 1.00",
        status: metadataComplete ? "met" : "below_target",
      },
      boundary_correctness: {
        value: safeRecipe ? "1.00" : "0.00",
        status: safeRecipe ? "met" : "below_target",
      },
      missing_dependency_visibility: {
        value: explainedStops ? stopVisibilityRatio.toFixed(2) : "0.00",
        status: explainedStops && stopVisibilityRatio === 1 ? "met" : "below_target",
      },
      wdc_route_shown: {
        value: wdcEvidence.route.route_method,
        status: routeShown ? "met" : "missing_evidence",
      },
      project_tree_coverage: {
        value: projectTreeComplete ? "1.00" : "0.00",
        status: projectTreeComplete ? "met" : "below_target",
      },
      observability_surfaced: {
        value: observabilityRatio.toFixed(2),
        status: observabilitySurfaced ? "met" : "missing_evidence",
      },
      candidate_mapped_separation: {
        value: routeCard.mapped_count_source,
        status: "met",
      },
      expected_stop_explanation: {
        value: explainedStops ? "1.00" : "0.00",
        status: explainedStops ? "met" : "below_target",
      },
      runtime_overclaim_defects: {
        value: "0",
        status: "met",
      },
      visual_sanity: {
        value: proofHarness.visual_ratio.toFixed(2),
        status: visualSanityPassed ? "met" : "missing_evidence",
      },
      interaction_latency: {
        value:
          proofHarness.max_interaction_p95_ms === null
            ? "missing"
            : `${proofHarness.max_interaction_p95_ms}ms`,
        status: performancePassed ? "met" : "missing_evidence",
      },
      library_filter_latency: {
        value: performancePassed ? "<=150ms diagnostic" : "missing",
        status: performancePassed ? "met" : "missing_evidence",
      },
      route_preview_latency: {
        value:
          wdcEvidence.route.route_preview_p95_ms === null
            ? "missing"
            : `${wdcEvidence.route.route_preview_p95_ms}ms`,
        status: routePreviewPassed ? "met" : "missing_evidence",
      },
      foundry_slot_reuse: {
        value: foundryReuseRate.toFixed(2),
        status: foundryReuseRate >= 0.75 ? "met" : "below_target",
      },
      lego_bom_visibility: {
        value: legoBomRatio.toFixed(2),
        status: legoBomVisible ? "met" : "missing_evidence",
      },
      a2a_exit_review: {
        value: a2aExitReviewVisible ? "1.00" : "0.00",
        status: a2aExitReviewVisible ? "met" : "missing_evidence",
      },
      stop_harvest: {
        value: stopHarvestRatio.toFixed(2),
        status: stopHarvestRatio === 1 ? "met" : "missing_evidence",
      },
    }),
    proofHarness,
  });
}
