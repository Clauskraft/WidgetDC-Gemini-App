import { describe, expect, it } from "vitest";
import {
  EXTERNAL_FRONTEND_REVIEW_LOOP,
  buildExternalFrontendReviewPlan,
  summarizeExternalFrontendReviewReadiness,
} from "@/lib/externalFrontendReview";

describe("externalFrontendReview", () => {
  it("defines a three-app candidate-only review loop for the world-class cockpit", () => {
    const plan = buildExternalFrontendReviewPlan();

    expect(plan.review_loop_id).toBe("external.frontend.review.worldclass.v0");
    expect(plan.task_bom_id).toBe("taskbom:adaptive:533f9e462430");
    expect(plan.target_surface).toBe("Gemini App World-Class Capability Cockpit");
    expect(plan.candidate_only).toBe(true);
    expect(plan.projection_only).toBe(true);
    expect(plan.graph_write_allowed).toBe(false);
    expect(plan.proof_eligible).toBe(false);
    expect(plan.provider_executions).toBe(0);
    expect(plan.mapped_count).toBe(0);
    expect(plan.mapped_count_source).toBe("graph_readback_only");

    expect(plan.apps.map((app) => app.id)).toEqual([
      "claude_design",
      "v0_vercel",
      "figma_make",
    ]);
    expect(plan.apps.find((app) => app.id === "claude_design")?.access_status).toBe("ready");
    expect(plan.apps.find((app) => app.id === "v0_vercel")?.access_status).toBe(
      "login_required",
    );
    expect(plan.apps.find((app) => app.id === "figma_make")?.access_status).toBe(
      "login_required",
    );

    for (const app of plan.apps) {
      expect(app.review_prompt).toContain("candidate-only");
      expect(app.review_prompt).toContain("no runtime proof");
      expect(app.import_back_contract.candidate_only).toBe(true);
      expect(app.import_back_contract.projection_only).toBe(true);
      expect(app.import_back_contract.graph_write_allowed).toBe(false);
      expect(app.import_back_contract.proof_eligible).toBe(false);
      expect(app.import_back_contract.provider_execution_allowed).toBe(false);
      expect(app.import_back_contract.mapped_count_allowed).toBe(false);
    }
  });

  it("maps external review scoring to world-class categories without making proof claims", () => {
    const plan = buildExternalFrontendReviewPlan();
    const readiness = summarizeExternalFrontendReviewReadiness(plan);

    expect(readiness.apps_total).toBe(3);
    expect(readiness.apps_ready).toBe(1);
    expect(readiness.apps_requiring_login).toBe(2);
    expect(readiness.provider_executions).toBe(0);
    expect(readiness.boundary_status).toBe("candidate_only");
    expect(readiness.can_run_without_governed_review_execution).toBe(false);

    expect(plan.scoring_rubric.map((item) => item.category)).toEqual([
      "usability",
      "visual_quality",
      "capability_discovery",
      "composition_power",
      "proof_clarity",
      "reuse_and_foundry",
    ]);
    for (const item of plan.scoring_rubric) {
      expect(item.weight).toBeGreaterThan(0);
      expect(item.world_class_kpi_refs.length).toBeGreaterThan(0);
      expect(item.evidence_level_ceiling).toBe("diagnostic_only");
    }
  });

  it("keeps the default exported contract immutable and primary-UX aligned", () => {
    expect(EXTERNAL_FRONTEND_REVIEW_LOOP.gemini_primary_ux).toBe(true);
    expect(EXTERNAL_FRONTEND_REVIEW_LOOP.consulting_frontend_role).toBe(
      "widget_artifact_foundry_only",
    );
    expect(EXTERNAL_FRONTEND_REVIEW_LOOP.stop_conditions).toContain(
      "stop_if_external_output_claims_runtime_proof",
    );
    expect(EXTERNAL_FRONTEND_REVIEW_LOOP.stop_conditions).toContain(
      "stop_if_review_requires_credentials_in_chat",
    );
  });
});
