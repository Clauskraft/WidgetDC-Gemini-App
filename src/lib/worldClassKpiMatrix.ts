import type {
  KpiStatus,
  WorldClassCategoryId,
  WorldClassEvidenceLevel,
  WorldClassKpi,
} from "@/lib/worldClassContract";

export type WorldClassKpiId =
  | "first_useful_route"
  | "next_action_clarity"
  | "raw_json_avoidance"
  | "category_coverage"
  | "search_success"
  | "metadata_completeness"
  | "valid_recipe_rate"
  | "boundary_correctness"
  | "missing_dependency_visibility"
  | "wdc_route_shown"
  | "project_tree_coverage"
  | "observability_surfaced"
  | "candidate_mapped_separation"
  | "expected_stop_explanation"
  | "runtime_overclaim_defects"
  | "visual_sanity"
  | "inspector_usefulness"
  | "visual_artifact_readability"
  | "interaction_latency"
  | "library_filter_latency"
  | "route_preview_latency"
  | "foundry_slot_reuse"
  | "lego_bom_visibility"
  | "a2a_exit_review"
  | "stop_harvest";

export type WorldClassKpiDefinition = Omit<
  WorldClassKpi,
  "value" | "status" | "required_level" | "observed_level" | "evidence_ref" | "proof_ready"
> & {
  id: WorldClassKpiId;
};

export type WorldClassKpiMeasurement = {
  value: string;
  status: KpiStatus;
  observed_level?: WorldClassEvidenceLevel;
  evidence_ref?: string;
};

export type WorldClassKpiMeasurements = Partial<Record<WorldClassKpiId, WorldClassKpiMeasurement>>;

export type WorldClassKpiMatrixSummary = {
  total: number;
  met: number;
  proofReady: number;
  proofPending: number;
  missingEvidence: number;
  belowTarget: number;
  objectiveCoverage: number;
};

const defaultRequiredLevel: WorldClassEvidenceLevel = "diagnostic_only";

const requiredEvidenceLevelByKpi = {
  next_action_clarity: "user_evidence",
  runtime_overclaim_defects: "runtime_proof",
} satisfies Partial<Record<WorldClassKpiId, WorldClassEvidenceLevel>>;

const evidenceLevelRank: Record<WorldClassEvidenceLevel, number> = {
  diagnostic_only: 0,
  user_evidence: 1,
  runtime_proof: 2,
};

function evidenceMeetsRequirement(
  observed: WorldClassEvidenceLevel,
  required: WorldClassEvidenceLevel,
) {
  return evidenceLevelRank[observed] >= evidenceLevelRank[required];
}

const definitions = [
  {
    id: "first_useful_route",
    category: "usability",
    label: "First useful route",
    formula: "p95(intent_to_route_preview_ms)",
    target: "<=10000ms",
  },
  {
    id: "next_action_clarity",
    category: "usability",
    label: "Next action clarity",
    formula: "users_identify_next_action / tested_users",
    target: ">=0.95",
  },
  {
    id: "raw_json_avoidance",
    category: "usability",
    label: "Raw JSON avoidance",
    formula: "non_raw_outputs / total_primary_outputs",
    target: ">=0.98",
  },
  {
    id: "category_coverage",
    category: "capability_discovery",
    label: "Category coverage",
    formula: "visible_categories / required_categories",
    target: "9/9",
  },
  {
    id: "search_success",
    category: "capability_discovery",
    label: "Search success",
    formula: "successful_queries / query_tests",
    target: ">=0.95",
  },
  {
    id: "metadata_completeness",
    category: "capability_discovery",
    label: "Capability metadata completeness",
    formula: "entries_with_required_fields / entries",
    target: "1.00",
  },
  {
    id: "valid_recipe_rate",
    category: "composition_power",
    label: "Valid recipe rate",
    formula: "valid_recipes / recipe_attempts",
    target: ">=0.95",
  },
  {
    id: "boundary_correctness",
    category: "composition_power",
    label: "Boundary correctness",
    formula: "safe_recipes / all_recipes",
    target: "1.00",
  },
  {
    id: "missing_dependency_visibility",
    category: "composition_power",
    label: "Missing dependency visibility",
    formula: "visible_missing_deps / actual_missing_deps",
    target: "1.00",
  },
  {
    id: "wdc_route_shown",
    category: "wdc_visibility",
    label: "WDC route shown",
    formula: "routes_with_wdc_readback / routes",
    target: "1.00",
  },
  {
    id: "project_tree_coverage",
    category: "wdc_visibility",
    label: "ProjectTree coverage",
    formula: "activities_with_CFG_BOM_OP_GATE / activities",
    target: "1.00",
  },
  {
    id: "observability_surfaced",
    category: "wdc_visibility",
    label: "Observability surfaced",
    formula: "visible_observability_states / required_states",
    target: "1.00",
  },
  {
    id: "candidate_mapped_separation",
    category: "proof_clarity",
    label: "Candidate/mapped separation",
    formula: "correct_count_labels / count_labels",
    target: "1.00",
  },
  {
    id: "expected_stop_explanation",
    category: "proof_clarity",
    label: "Expected-stop explanation",
    formula: "explained_stops / stop_states",
    target: "1.00",
  },
  {
    id: "runtime_overclaim_defects",
    category: "proof_clarity",
    label: "Runtime overclaim defects",
    formula: "count",
    target: "0",
  },
  {
    id: "visual_sanity",
    category: "visual_quality",
    label: "No layout defects",
    formula: "clean_viewports / tested_viewports",
    target: "1.00",
  },
  {
    id: "inspector_usefulness",
    category: "visual_quality",
    label: "Inspector usefulness",
    formula: "objects_with_inspector / selectable_objects",
    target: "1.00",
  },
  {
    id: "visual_artifact_readability",
    category: "visual_quality",
    label: "Visual artifact readability",
    formula: "readable_visuals / generated_visuals",
    target: ">=0.98",
  },
  {
    id: "interaction_latency",
    category: "performance",
    label: "Interaction latency",
    formula: "p95(click_to_feedback_ms)",
    target: "<=250ms",
  },
  {
    id: "library_filter_latency",
    category: "performance",
    label: "Library filter latency",
    formula: "p95(filter_ms)",
    target: "<=150ms",
  },
  {
    id: "route_preview_latency",
    category: "performance",
    label: "Route preview latency",
    formula: "p95(route_preview_ms)",
    target: "<=10000ms",
  },
  {
    id: "foundry_slot_reuse",
    category: "reuse_and_foundry",
    label: "Foundry slot reuse",
    formula: "foundry_slots_used / recommended_slots",
    target: ">=0.75 P0, >=0.95 later",
  },
  {
    id: "lego_bom_visibility",
    category: "reuse_and_foundry",
    label: "Lego/BOM visibility",
    formula: "recipes_with_bom_refs / recipes",
    target: "1.00",
  },
  {
    id: "a2a_exit_review",
    category: "adoption_readiness",
    label: "A2A exit-review",
    formula: "activities_with_standard_candidate / activities",
    target: "1.00",
  },
  {
    id: "stop_harvest",
    category: "adoption_readiness",
    label: "Stop harvest",
    formula: "harvested_stops / expected_stops",
    target: "1.00",
  },
] satisfies ReadonlyArray<WorldClassKpiDefinition>;

export const WORLD_CLASS_KPI_TARGETS: ReadonlyArray<WorldClassKpiDefinition> = definitions;

export function buildWorldClassKpis(measurements: WorldClassKpiMeasurements): WorldClassKpi[] {
  return WORLD_CLASS_KPI_TARGETS.map((definition) => {
    const measurement = measurements[definition.id];
    const requiredLevel = requiredEvidenceLevelByKpi[definition.id] ?? defaultRequiredLevel;
    const observedLevel = measurement?.observed_level ?? "diagnostic_only";
    const evidenceRef = measurement
      ? (measurement.evidence_ref ?? "diagnostic KPI measurement")
      : "missing";
    const status = measurement?.status ?? "missing_evidence";
    return {
      ...definition,
      required_level: requiredLevel,
      observed_level: observedLevel,
      evidence_ref: evidenceRef,
      value: measurement?.value ?? "missing",
      status,
      proof_ready:
        status === "met" &&
        evidenceRef !== "missing" &&
        evidenceMeetsRequirement(observedLevel, requiredLevel),
    };
  });
}

export function summarizeWorldClassKpiMatrix(kpis: WorldClassKpi[]): WorldClassKpiMatrixSummary {
  const met = kpis.filter((kpi) => kpi.status === "met").length;
  const proofReady = kpis.filter((kpi) => kpi.proof_ready).length;
  const missingEvidence = kpis.filter((kpi) => kpi.status === "missing_evidence").length;
  const belowTarget = kpis.filter((kpi) => kpi.status === "below_target").length;

  return {
    total: kpis.length,
    met,
    proofReady,
    proofPending: kpis.length - proofReady,
    missingEvidence,
    belowTarget,
    objectiveCoverage: Number((kpis.length / WORLD_CLASS_KPI_TARGETS.length).toFixed(4)),
  };
}
