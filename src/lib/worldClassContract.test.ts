import { describe, expect, it } from "vitest";
import { resolveAgentOfficeProductionLoop } from "@/lib/agentOfficeProductionLoop";
import { buildBrokerageRouteCard } from "@/lib/brokerageRoute";
import { buildCapabilityLibrary } from "@/lib/capabilityLibrary";
import { buildCapabilityRecipe } from "@/lib/capabilityRecipe";
import {
  WORLD_CLASS_DIAGNOSTIC_WDC_EVIDENCE,
  WORLD_CLASS_CATEGORY_WEIGHTS,
  buildWorldClassAssessment,
  evaluateWorldClass,
  type CriticalP0DefectId,
  type HardGateId,
  type WorldClassCategoryId,
} from "@/lib/worldClassContract";
import { WORLD_CLASS_KPI_TARGETS } from "@/lib/worldClassKpiMatrix";
import {
  WORLD_CLASS_DIAGNOSTIC_PROOF,
  type WorldClassProofHarnessEvidence,
} from "@/lib/worldClassProofHarness";
import type { WorldClassUserEvidence } from "@/lib/worldClassUserEvidence";

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

  it("does not let diagnostic evidence satisfy user or runtime proof gates", () => {
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
      evidenceGates: [
        {
          id: "human_task_success",
          label: "Human task success",
          required_level: "user_evidence",
          observed_level: "diagnostic_only",
          evidence: "diagnostic walkthrough only",
        },
        {
          id: "runtime_proof_readback",
          label: "Runtime proof readback",
          required_level: "runtime_proof",
          observed_level: "diagnostic_only",
          evidence: "no deployed SHA or 3-pass proof",
        },
      ],
    });

    expect(assessment.worldClassSatisfied).toBe(false);
    expect(assessment.status).toBe("not_world_class");
    expect(assessment.evidenceGatePassCount).toBe(0);
    expect(assessment.evidenceGateTotal).toBe(2);
    expect(assessment.evidenceGates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "human_task_success",
          passed: false,
          required_level: "user_evidence",
          observed_level: "diagnostic_only",
        }),
        expect.objectContaining({
          id: "runtime_proof_readback",
          passed: false,
          required_level: "runtime_proof",
          observed_level: "diagnostic_only",
        }),
      ]),
    );
    expect(assessment.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Human task success"),
        expect.stringContaining("Runtime proof readback"),
      ]),
    );
  });

  it("allows world-class only when required evidence levels are also satisfied", () => {
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
      evidenceGates: [
        {
          id: "human_task_success",
          label: "Human task success",
          required_level: "user_evidence",
          observed_level: "user_evidence",
          evidence: "task success sample attached",
        },
        {
          id: "runtime_proof_readback",
          label: "Runtime proof readback",
          required_level: "runtime_proof",
          observed_level: "runtime_proof",
          evidence: "deployed SHA and 3 consecutive passes attached",
        },
      ],
    });

    expect(assessment.worldClassSatisfied).toBe(true);
    expect(assessment.status).toBe("world_class");
    expect(assessment.evidenceGatePassCount).toBe(2);
  });

  it("keeps current P0 cockpit as expected not-world-class until runtime and human evidence is attached", () => {
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
    expect(assessment.uxEvidence?.evidence_level).toBe("diagnostic_only");
    expect(assessment.evidenceGates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "human_task_success",
          passed: false,
          observed_level: "diagnostic_only",
        }),
        expect.objectContaining({
          id: "runtime_proof_readback",
          passed: false,
          observed_level: "diagnostic_only",
        }),
      ]),
    );
    expect(assessment.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Diagnostic UX evidence is attached"),
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
          id: "library_filter_latency",
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
          status: "met",
          value: "1.00",
        }),
        expect.objectContaining({
          id: "next_action_clarity",
          status: "missing_evidence",
          value: "2/2 diagnostic",
        }),
        expect.objectContaining({
          id: "raw_json_avoidance",
          status: "met",
          value: "1.00",
        }),
        expect.objectContaining({
          id: "search_success",
          status: "met",
          value: "1.00",
        }),
        expect.objectContaining({
          id: "valid_recipe_rate",
          status: "met",
          value: "1.00",
        }),
        expect.objectContaining({
          id: "inspector_usefulness",
          status: "met",
          value: "1.00",
        }),
        expect.objectContaining({
          id: "visual_artifact_readability",
          status: "met",
          value: "1.00",
        }),
      ]),
    );
    expect(assessment.kpis).toHaveLength(WORLD_CLASS_KPI_TARGETS.length);
    expect(
      assessment.kpis.filter((kpi) => kpi.status === "missing_evidence").length,
    ).toBeGreaterThan(0);
    expect(WORLD_CLASS_DIAGNOSTIC_WDC_EVIDENCE.evidence_level).toBe("diagnostic_only");
  });

  it("can satisfy the mathematical contract when user evidence and runtime proof are both attached", () => {
    const entries = buildCapabilityLibrary();
    const selectedEntries = entries.slice(0, 3);
    const recipe = buildCapabilityRecipe("World-class capability cockpit", selectedEntries);
    const routeCard = buildBrokerageRouteCard("general");
    const productionLoop = resolveAgentOfficeProductionLoop("general");
    const userEvidence: WorldClassUserEvidence = {
      evidence_ref: "external-review://manual/clauskraft/world-class-cockpit",
      evidence_level: "user_evidence",
      candidate_only: true,
      projection_only: true,
      graph_write_allowed: false,
      proof_eligible: false,
      provider_executions: 0,
      task_results: [
        {
          task_id: "find-next-action",
          reviewer_id: "reviewer:1",
          next_action_identified: true,
          completed_without_raw_json: true,
          boundary_confusion: false,
        },
        {
          task_id: "compose-safe-recipe",
          reviewer_id: "reviewer:1",
          next_action_identified: true,
          completed_without_raw_json: true,
          boundary_confusion: false,
        },
      ],
      external_review_results: [
        {
          app_id: "claude_design",
          status: "completed",
          reviewer_id: "reviewer:1",
          next_action_identified: true,
          runtime_overclaim_seen: false,
          candidate_mapped_confusion_seen: false,
          recommended_delta_count: 3,
        },
        {
          app_id: "v0_vercel",
          status: "completed",
          reviewer_id: "reviewer:1",
          next_action_identified: true,
          runtime_overclaim_seen: false,
          candidate_mapped_confusion_seen: false,
          recommended_delta_count: 2,
        },
        {
          app_id: "figma_make",
          status: "completed",
          reviewer_id: "reviewer:1",
          next_action_identified: true,
          runtime_overclaim_seen: false,
          candidate_mapped_confusion_seen: false,
          recommended_delta_count: 2,
        },
      ],
    };
    const runtimeProof: WorldClassProofHarnessEvidence = {
      ...WORLD_CLASS_DIAGNOSTIC_PROOF,
      evidence_ref: "runtime://gemini-app/deployed-sha/3-pass",
      evidence_level: "runtime_proof",
      runtime: {
        deployed_sha: "sha:verified",
        consecutive_runtime_passes: 3,
      },
    };

    const assessment = buildWorldClassAssessment({
      capabilityEntries: entries,
      recipe,
      routeCard,
      projectTreeRefs: productionLoop.projectTreeRefs,
      proofHarnessEvidence: runtimeProof,
      userEvidence,
    });

    expect(assessment.worldClassSatisfied).toBe(true);
    expect(assessment.status).toBe("world_class");
    expect(assessment.worldClassIndex).toBeGreaterThanOrEqual(0.95);
    expect(assessment.minCategoryScore).toBeGreaterThanOrEqual(0.9);
    expect(assessment.evidenceGatePassCount).toBe(assessment.evidenceGateTotal);
    expect(assessment.criticalP0Defects).toBe(0);
    expect(assessment.kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "next_action_clarity",
          status: "met",
          observed_level: "user_evidence",
        }),
      ]),
    );
  });
});
