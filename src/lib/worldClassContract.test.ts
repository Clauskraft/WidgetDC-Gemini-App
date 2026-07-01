import { describe, expect, it } from "vitest";
import { resolveAgentOfficeProductionLoop } from "@/lib/agentOfficeProductionLoop";
import { buildBrokerageRouteCard } from "@/lib/brokerageRoute";
import { buildCapabilityLibrary } from "@/lib/capabilityLibrary";
import { buildCapabilityRecipe } from "@/lib/capabilityRecipe";
import {
  WORLD_CLASS_CATEGORY_WEIGHTS,
  buildWorldClassAssessment,
  evaluateWorldClass,
  type CriticalP0DefectId,
  type HardGateId,
  type WorldClassCategoryId,
} from "@/lib/worldClassContract";
import { WORLD_CLASS_KPI_TARGETS } from "@/lib/worldClassKpiMatrix";

const hardGateIds: HardGateId[] = [
  "governance",
  "proof_boundary",
  "approval",
  "wdc_authority",
  "gemini_primary_ux",
  "foundry_boundary",
  "runtime_claim",
  "a2a_process",
  "visual_sanity",
  "accessibility",
];

const categoryIds: WorldClassCategoryId[] = [
  "usability",
  "capability_discovery",
  "composition_power",
  "wdc_visibility",
  "proof_clarity",
  "visual_quality",
  "performance",
  "reuse_and_foundry",
  "adoption_readiness",
];

const criticalDefectIds: CriticalP0DefectId[] = [
  "execution_enabled_without_approval",
  "provider_call_from_compose_preview",
  "graph_write_from_ui",
  "claim_promotion_from_ui",
  "mapped_count_fabricated_locally",
  "widget_foundry_used_as_runtime_shell",
  "project_tree_missing",
  "blank_overlapping_unreadable_primary_ui",
  "wdc_cli_bypass_for_governed_operation",
];

describe("worldClassContract", () => {
  it("keeps the weighted WorldClassIndex formula normalized", () => {
    const total = WORLD_CLASS_CATEGORY_WEIGHTS.reduce((sum, category) => sum + category.weight, 0);

    expect(total).toBeCloseTo(1, 8);
  });

  it("passes only when all hard gates, category scores, and P0 defect gates pass", () => {
    const assessment = evaluateWorldClass({
      hardGates: Object.fromEntries(
        hardGateIds.map((id) => [id, { passed: true, evidence: "verified" }]),
      ) as Record<HardGateId, { passed: boolean; evidence: string }>,
      categoryScores: Object.fromEntries(
        categoryIds.map((id) => [id, { score: 0.96, blockers: [] }]),
      ) as Record<WorldClassCategoryId, { score: number; blockers: string[] }>,
      criticalDefects: Object.fromEntries(criticalDefectIds.map((id) => [id, 0])) as Record<
        CriticalP0DefectId,
        number
      >,
      kpis: [],
    });

    expect(assessment.status).toBe("world_class");
    expect(assessment.worldClassSatisfied).toBe(true);
    expect(assessment.worldClassIndex).toBeGreaterThanOrEqual(0.95);
    expect(assessment.minCategoryScore).toBeGreaterThanOrEqual(0.9);
    expect(assessment.criticalP0Defects).toBe(0);
  });

  it("keeps current P0 cockpit as expected not-world-class until runtime and adoption evidence is attached", () => {
    const entries = buildCapabilityLibrary();
    const selectedEntries = entries.slice(0, 3);
    const recipe = buildCapabilityRecipe("World-class capability cockpit", selectedEntries);
    const routeCard = buildBrokerageRouteCard("general");
    const productionLoop = resolveAgentOfficeProductionLoop("general");
    const assessment = buildWorldClassAssessment({
      capabilityEntries: entries,
      recipe,
      routeCard,
      projectTreeRefs: productionLoop.projectTreeRefs,
    });

    expect(assessment.status).toBe("not_world_class");
    expect(assessment.worldClassSatisfied).toBe(false);
    expect(assessment.criticalP0Defects).toBe(0);
    expect(assessment.hardGatePassCount).toBe(assessment.hardGateTotal);
    expect(assessment.proofHarness.evidence_level).toBe("diagnostic_only");
    expect(assessment.proofHarness.visual_status).toBe("passed");
    expect(assessment.proofHarness.accessibility_status).toBe("passed");
    expect(assessment.proofHarness.performance_status).toBe("passed");
    expect(assessment.proofHarness.runtime_status).toBe("missing_evidence");
    expect(assessment.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Human task-success evidence"),
        expect.stringContaining("WorldClassIndex"),
      ]),
    );
    expect(assessment.kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "candidate_mapped_separation",
          status: "met",
          value: "graph_readback_only",
        }),
        expect.objectContaining({
          id: "interaction_latency",
          status: "met",
        }),
        expect.objectContaining({
          id: "wdc_route_shown",
          status: "met",
          value: "MCP",
        }),
        expect.objectContaining({
          id: "observability_surfaced",
          status: "met",
          value: "1.00",
        }),
        expect.objectContaining({
          id: "lego_bom_visibility",
          status: "met",
          value: "1.00",
        }),
        expect.objectContaining({
          id: "a2a_exit_review",
          status: "met",
          value: "1.00",
        }),
        expect.objectContaining({
          id: "stop_harvest",
          status: "missing_evidence",
          value: "0.00",
        }),
      ]),
    );
    expect(assessment.kpis).toHaveLength(WORLD_CLASS_KPI_TARGETS.length);
    expect(
      assessment.kpis.filter((kpi) => kpi.status === "missing_evidence").length,
    ).toBeGreaterThan(0);
  });
});
