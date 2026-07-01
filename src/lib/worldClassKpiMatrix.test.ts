import { describe, expect, it } from "vitest";
import {
  WORLD_CLASS_KPI_TARGETS,
  buildWorldClassKpis,
  summarizeWorldClassKpiMatrix,
} from "@/lib/worldClassKpiMatrix";

describe("worldClassKpiMatrix", () => {
  it("covers every KPI target from the world-class objective exactly once", () => {
    expect(WORLD_CLASS_KPI_TARGETS).toHaveLength(25);
    expect(new Set(WORLD_CLASS_KPI_TARGETS.map((target) => target.id)).size).toBe(25);
    expect(WORLD_CLASS_KPI_TARGETS.map((target) => target.id)).toEqual([
      "first_useful_route",
      "next_action_clarity",
      "raw_json_avoidance",
      "category_coverage",
      "search_success",
      "metadata_completeness",
      "valid_recipe_rate",
      "boundary_correctness",
      "missing_dependency_visibility",
      "wdc_route_shown",
      "project_tree_coverage",
      "observability_surfaced",
      "candidate_mapped_separation",
      "expected_stop_explanation",
      "runtime_overclaim_defects",
      "visual_sanity",
      "inspector_usefulness",
      "visual_artifact_readability",
      "interaction_latency",
      "library_filter_latency",
      "route_preview_latency",
      "foundry_slot_reuse",
      "lego_bom_visibility",
      "a2a_exit_review",
      "stop_harvest",
    ]);
  });

  it("defaults unmeasured KPI targets to missing evidence", () => {
    const kpis = buildWorldClassKpis({
      candidate_mapped_separation: {
        value: "graph_readback_only",
        status: "met",
        observed_level: "diagnostic_only",
        evidence_ref: "graph_readback_only count label audit",
      },
    });
    const summary = summarizeWorldClassKpiMatrix(kpis);

    expect(summary.total).toBe(25);
    expect(summary.objectiveCoverage).toBe(1);
    expect(summary.met).toBe(1);
    expect(summary.missingEvidence).toBe(24);
    expect(summary.proofReady).toBe(1);
    expect(kpis.find((kpi) => kpi.id === "first_useful_route")).toMatchObject({
      value: "missing",
      status: "missing_evidence",
      required_level: "diagnostic_only",
      observed_level: "diagnostic_only",
      evidence_ref: "missing",
      proof_ready: false,
    });
    expect(kpis.find((kpi) => kpi.id === "candidate_mapped_separation")).toMatchObject({
      required_level: "diagnostic_only",
      observed_level: "diagnostic_only",
      evidence_ref: "graph_readback_only count label audit",
      proof_ready: true,
    });
  });

  it("keeps met diagnostic KPI values separate from user and runtime proof readiness", () => {
    const kpis = buildWorldClassKpis({
      next_action_clarity: {
        value: "2/2 diagnostic",
        status: "met",
        observed_level: "diagnostic_only",
        evidence_ref: "world-class UX diagnostic contract",
      },
      runtime_overclaim_defects: {
        value: "0",
        status: "met",
        observed_level: "diagnostic_only",
        evidence_ref: "P0 static overclaim audit",
      },
    });

    expect(kpis.find((kpi) => kpi.id === "next_action_clarity")).toMatchObject({
      required_level: "user_evidence",
      observed_level: "diagnostic_only",
      proof_ready: false,
    });
    expect(kpis.find((kpi) => kpi.id === "runtime_overclaim_defects")).toMatchObject({
      required_level: "runtime_proof",
      observed_level: "diagnostic_only",
      proof_ready: false,
    });
  });
});
