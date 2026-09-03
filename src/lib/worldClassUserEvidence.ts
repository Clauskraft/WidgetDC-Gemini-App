/**
 * worldClassUserEvidence — the typed shape and validator for human task-success evidence.
 *
 * WHY THIS FILE EXISTS
 * `wdc world-class readback` lists six required source contracts and computes `sourceComplete`
 * from their presence. This was the missing one, so `governance_boundary`, `proof_boundary` and
 * `diagnostic_contract` failed and five category scores sat at their floor.
 *
 * IMPORTANT, AND THE REASON THIS FILE SHIPS NO DATA
 * That presence check is `existsSync` only — an empty file with the right name would move the
 * same gates and the same scores. So the gate cannot tell a real contract from a placeholder,
 * and the only thing that makes this file honest is that it actually encodes the rule the
 * readback applies. It does not, and must not, ship a populated evidence object: `task_results`
 * and `external_review_results` describe what human reviewers did. Hardcoding a passing set
 * here would flip `human_task_success` on invented outcomes, which is worse than the missing
 * file it replaces.
 *
 * Evidence is supplied at invocation:
 *   wdc world-class readback --target-repo <gemini-app> --user-evidence <path-to.json>
 *
 * The acceptance rule below mirrors `summarizeUserEvidence` in the CLI's
 * `world-class-readback.ts`. It is duplicated deliberately: the CLI decides the gate, this
 * module lets the app validate a candidate payload before anyone attaches it, and the shared
 * test asserts the two agree.
 */

export type UserEvidenceStatus = "passed" | "expected_stop";

/** One human task run. Every field must hold for the task to count as a success. */
export type WorldClassUserTaskResult = {
  reviewer_id: string;
  /** The reviewer finished without being shown raw JSON — the surface explained itself. */
  completed_without_raw_json: boolean;
  /** The reviewer could state what to do next unaided. */
  next_action_identified: boolean;
  /** The reviewer mistook a candidate for a mapped/proven result. A defect, so it must be false. */
  boundary_confusion: boolean;
};

/** One external design/build app used to review the surface. Three must pass cleanly. */
export type WorldClassExternalReviewResult = {
  app: "claude_design" | "v0" | "figma_make" | string;
  completed: boolean;
  /** The app presented a candidate as runtime-proven. A defect. */
  runtime_overclaim_seen: boolean;
  /** The app blurred candidate_count and mapped_count. A defect. */
  candidate_mapped_confusion_seen: boolean;
};

export type WorldClassUserEvidence = {
  evidence_ref: string;
  evidence_level: "user_evidence";
  /**
   * Provider executions during the evidence run. MUST be zero: user evidence is a readback of
   * what humans did, and any provider call means the run mutated or spent, which disqualifies
   * it as a projection.
   */
  provider_executions: number;
  task_results: WorldClassUserTaskResult[];
  external_review_results: WorldClassExternalReviewResult[];
};

export type WorldClassUserEvidenceSummary = {
  status: UserEvidenceStatus;
  task_result_count: number;
  external_review_pass_count: number;
  external_review_required_count: number;
  stop_codes: string[];
};

export const WORLD_CLASS_USER_EVIDENCE_TARGETS = {
  external_review_pass_count: 3,
  provider_executions: 0,
} as const;

/** A task run counts only when all three conditions hold; boundary confusion is a defect. */
export function taskResultPassed(task: WorldClassUserTaskResult): boolean {
  return task.completed_without_raw_json
    && task.next_action_identified
    && !task.boundary_confusion;
}

/** An external review counts only when it completed and neither confusion defect appeared. */
export function externalReviewPassed(review: WorldClassExternalReviewResult): boolean {
  return review.completed
    && !review.runtime_overclaim_seen
    && !review.candidate_mapped_confusion_seen;
}

/**
 * Mirror of the CLI's `summarizeUserEvidence`. Same stop codes, same order, same thresholds.
 *
 * `null` is a legitimate input and yields USER_EVIDENCE_MISSING rather than throwing: absent
 * evidence is the ordinary state before a review round, not an error.
 *
 * An empty `task_results` array does NOT pass. `[].every(...)` is true, so a naive
 * implementation would report success for a run in which nobody did anything — the exact shape
 * of a vacuous gate.
 */
export function summarizeUserEvidence(
  evidence: WorldClassUserEvidence | null,
): WorldClassUserEvidenceSummary {
  const stopCodes: string[] = [];
  if (!evidence) stopCodes.push("USER_EVIDENCE_MISSING");

  const externalReviewPassCount = evidence?.external_review_results.filter(externalReviewPassed).length ?? 0;
  const taskResultsPassed = evidence?.task_results.length
    ? evidence.task_results.every(taskResultPassed)
    : false;

  if (evidence && evidence.provider_executions !== WORLD_CLASS_USER_EVIDENCE_TARGETS.provider_executions) {
    stopCodes.push("USER_EVIDENCE_PROVIDER_EXECUTION_NOT_ZERO");
  }
  if (evidence && !taskResultsPassed) stopCodes.push("USER_TASK_SUCCESS_INCOMPLETE");
  if (evidence && externalReviewPassCount < WORLD_CLASS_USER_EVIDENCE_TARGETS.external_review_pass_count) {
    stopCodes.push("EXTERNAL_REVIEW_COVERAGE_UNDER_3");
  }

  return {
    status: stopCodes.length === 0 ? "passed" : "expected_stop",
    task_result_count: evidence?.task_results.length ?? 0,
    external_review_pass_count: externalReviewPassCount,
    external_review_required_count: WORLD_CLASS_USER_EVIDENCE_TARGETS.external_review_pass_count,
    stop_codes: stopCodes,
  };
}

/**
 * Structural check for a payload read off disk before it is attached with `--user-evidence`.
 * This validates SHAPE, never outcome — a well-formed payload full of failures is valid input;
 * `summarizeUserEvidence` is what decides whether it passes.
 */
export function isWorldClassUserEvidence(value: unknown): value is WorldClassUserEvidence {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<WorldClassUserEvidence>;
  if (typeof candidate.evidence_ref !== "string" || candidate.evidence_ref.length === 0) return false;
  if (candidate.evidence_level !== "user_evidence") return false;
  if (typeof candidate.provider_executions !== "number") return false;
  if (!Array.isArray(candidate.task_results) || !Array.isArray(candidate.external_review_results)) return false;

  const taskShapeOk = candidate.task_results.every((task) =>
    typeof task?.reviewer_id === "string"
    && typeof task?.completed_without_raw_json === "boolean"
    && typeof task?.next_action_identified === "boolean"
    && typeof task?.boundary_confusion === "boolean");

  const reviewShapeOk = candidate.external_review_results.every((review) =>
    typeof review?.app === "string"
    && typeof review?.completed === "boolean"
    && typeof review?.runtime_overclaim_seen === "boolean"
    && typeof review?.candidate_mapped_confusion_seen === "boolean");

  return taskShapeOk && reviewShapeOk;
}
