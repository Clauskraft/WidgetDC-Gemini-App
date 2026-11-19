import { describe, expect, it } from "vitest";
import {
  WORLD_CLASS_USER_EVIDENCE_TARGETS,
  externalReviewPassed,
  isWorldClassUserEvidence,
  summarizeUserEvidence,
  taskResultPassed,
  type WorldClassUserEvidence,
} from "@/lib/worldClassUserEvidence";

/**
 * Builders, not fixtures. The module ships no evidence data on purpose — task results and
 * external reviews describe what human reviewers actually did — so the tests construct exactly
 * the shape each assertion needs and nothing is importable as a ready-made passing payload.
 */
function evidence(overrides: Partial<WorldClassUserEvidence> = {}): WorldClassUserEvidence {
  return {
    evidence_ref: "docs/evidence/world-class-user-round-1.md",
    evidence_level: "user_evidence",
    provider_executions: 0,
    task_results: [
      {
        reviewer_id: "reviewer-a",
        completed_without_raw_json: true,
        next_action_identified: true,
        boundary_confusion: false,
      },
    ],
    external_review_results: ["claude_design", "v0", "figma_make"].map((app) => ({
      app,
      completed: true,
      runtime_overclaim_seen: false,
      candidate_mapped_confusion_seen: false,
    })),
    ...overrides,
  };
}

describe("worldClassUserEvidence", () => {
  it("passes only when every condition holds at once", () => {
    const summary = summarizeUserEvidence(evidence());

    expect(summary.status).toBe("passed");
    expect(summary.stop_codes).toEqual([]);
    expect(summary.external_review_pass_count).toBe(3);
    expect(summary.task_result_count).toBe(1);
  });

  it("reports missing evidence rather than throwing on null", () => {
    // Absent evidence is the ordinary state before a review round, not an error.
    const summary = summarizeUserEvidence(null);

    expect(summary.status).toBe("expected_stop");
    expect(summary.stop_codes).toEqual(["USER_EVIDENCE_MISSING"]);
    expect(summary.external_review_pass_count).toBe(0);
  });

  it("does not pass an empty task list", () => {
    // The vacuity trap: [].every(...) is true, so a naive implementation would report success
    // for a run in which no human did anything.
    const summary = summarizeUserEvidence(evidence({ task_results: [] }));

    expect(summary.status).toBe("expected_stop");
    expect(summary.stop_codes).toContain("USER_TASK_SUCCESS_INCOMPLETE");
  });

  it("treats boundary confusion as a defect, not a detail", () => {
    // A reviewer who mistook a candidate for a proven result is the exact failure the whole
    // candidate/mapped distinction exists to prevent.
    const summary = summarizeUserEvidence(evidence({
      task_results: [{
        reviewer_id: "reviewer-a",
        completed_without_raw_json: true,
        next_action_identified: true,
        boundary_confusion: true,
      }],
    }));

    expect(summary.status).toBe("expected_stop");
    expect(summary.stop_codes).toContain("USER_TASK_SUCCESS_INCOMPLETE");
  });

  it("requires three clean external reviews, and two is not enough", () => {
    const twoClean = evidence().external_review_results.slice(0, 2);
    const summary = summarizeUserEvidence(evidence({ external_review_results: twoClean }));

    expect(summary.external_review_pass_count).toBe(2);
    expect(summary.stop_codes).toContain("EXTERNAL_REVIEW_COVERAGE_UNDER_3");
    expect(WORLD_CLASS_USER_EVIDENCE_TARGETS.external_review_pass_count).toBe(3);
  });

  it("does not count a review that overclaimed runtime", () => {
    // Three reviews present, but one of them presented a candidate as runtime-proven — so the
    // count is two and the coverage stop fires. Completing is not the same as passing.
    const reviews = evidence().external_review_results.map((review, index) =>
      index === 0 ? { ...review, runtime_overclaim_seen: true } : review);
    const summary = summarizeUserEvidence(evidence({ external_review_results: reviews }));

    expect(summary.external_review_pass_count).toBe(2);
    expect(summary.stop_codes).toContain("EXTERNAL_REVIEW_COVERAGE_UNDER_3");
  });

  it("rejects a run that executed a provider", () => {
    // User evidence is a readback of what humans did; any provider call means the run spent or
    // mutated, which disqualifies it as a projection.
    const summary = summarizeUserEvidence(evidence({ provider_executions: 1 }));

    expect(summary.stop_codes).toContain("USER_EVIDENCE_PROVIDER_EXECUTION_NOT_ZERO");
    expect(summary.status).toBe("expected_stop");
  });

  it("reports every applicable stop code, not just the first", () => {
    const summary = summarizeUserEvidence(evidence({
      provider_executions: 2,
      task_results: [],
      external_review_results: [],
    }));

    expect(summary.stop_codes).toEqual([
      "USER_EVIDENCE_PROVIDER_EXECUTION_NOT_ZERO",
      "USER_TASK_SUCCESS_INCOMPLETE",
      "EXTERNAL_REVIEW_COVERAGE_UNDER_3",
    ]);
  });

  it("scores individual results in both directions", () => {
    expect(taskResultPassed({
      reviewer_id: "r",
      completed_without_raw_json: true,
      next_action_identified: true,
      boundary_confusion: false,
    })).toBe(true);
    expect(taskResultPassed({
      reviewer_id: "r",
      completed_without_raw_json: false,
      next_action_identified: true,
      boundary_confusion: false,
    })).toBe(false);

    expect(externalReviewPassed({
      app: "v0",
      completed: true,
      runtime_overclaim_seen: false,
      candidate_mapped_confusion_seen: false,
    })).toBe(true);
    expect(externalReviewPassed({
      app: "v0",
      completed: true,
      runtime_overclaim_seen: false,
      candidate_mapped_confusion_seen: true,
    })).toBe(false);
  });

  describe("shape validation", () => {
    it("accepts a well-formed payload whose outcomes are failures", () => {
      // Validation is about shape, never about outcome: a payload full of defects is valid
      // input, and summarizeUserEvidence is what decides whether it passes.
      const failing = evidence({
        provider_executions: 9,
        task_results: [{
          reviewer_id: "reviewer-a",
          completed_without_raw_json: false,
          next_action_identified: false,
          boundary_confusion: true,
        }],
      });

      expect(isWorldClassUserEvidence(failing)).toBe(true);
      expect(summarizeUserEvidence(failing).status).toBe("expected_stop");
    });

    it("rejects payloads that are not this contract", () => {
      expect(isWorldClassUserEvidence(null)).toBe(false);
      expect(isWorldClassUserEvidence({})).toBe(false);
      expect(isWorldClassUserEvidence({ ...evidence(), evidence_level: "runtime_proof" })).toBe(false);
      expect(isWorldClassUserEvidence({ ...evidence(), evidence_ref: "" })).toBe(false);
      expect(isWorldClassUserEvidence({ ...evidence(), provider_executions: "0" })).toBe(false);
      expect(isWorldClassUserEvidence({ ...evidence(), task_results: [{ reviewer_id: "r" }] })).toBe(false);
    });
  });
});
