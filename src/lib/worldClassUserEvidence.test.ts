import { describe, expect, it } from "vitest";
import {
  buildEmptyWorldClassUserEvidence,
  summarizeWorldClassUserEvidence,
  type WorldClassUserEvidence,
} from "@/lib/worldClassUserEvidence";

const validUserEvidence: WorldClassUserEvidence = {
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
    {
      task_id: "find-next-action",
      reviewer_id: "reviewer:2",
      next_action_identified: true,
      completed_without_raw_json: true,
      boundary_confusion: false,
    },
    {
      task_id: "compose-safe-recipe",
      reviewer_id: "reviewer:2",
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
      reviewer_id: "reviewer:2",
      next_action_identified: true,
      runtime_overclaim_seen: false,
      candidate_mapped_confusion_seen: false,
      recommended_delta_count: 2,
    },
  ],
};

describe("worldClassUserEvidence", () => {
  it("starts as missing user evidence with safe candidate boundaries", () => {
    const evidence = buildEmptyWorldClassUserEvidence();
    const summary = summarizeWorldClassUserEvidence(evidence);

    expect(evidence.evidence_level).toBe("diagnostic_only");
    expect(evidence.provider_executions).toBe(0);
    expect(evidence.graph_write_allowed).toBe(false);
    expect(evidence.proof_eligible).toBe(false);
    expect(summary.userEvidenceReady).toBe(false);
    expect(summary.externalReviewCoverageRatio).toBe(0);
  });

  it("accepts user evidence only when tasks and all external review apps pass boundaries", () => {
    const summary = summarizeWorldClassUserEvidence(validUserEvidence);

    expect(summary.userEvidenceReady).toBe(true);
    expect(summary.testedUsers).toBe(2);
    expect(summary.nextActionClarityRatio).toBe(1);
    expect(summary.rawJsonAvoidanceRatio).toBe(1);
    expect(summary.externalReviewCoverageRatio).toBe(1);
    expect(summary.boundaryDefectCount).toBe(0);
  });

  it("rejects user evidence if an external review confuses candidate output with runtime proof", () => {
    const unsafeEvidence: WorldClassUserEvidence = {
      ...validUserEvidence,
      external_review_results: [
        {
          ...validUserEvidence.external_review_results[0],
          runtime_overclaim_seen: true,
        },
      ],
    };

    const summary = summarizeWorldClassUserEvidence(unsafeEvidence);

    expect(summary.userEvidenceReady).toBe(false);
    expect(summary.boundaryDefectCount).toBe(1);
  });
});
