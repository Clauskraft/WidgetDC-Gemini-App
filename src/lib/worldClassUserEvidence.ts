import type { ExternalFrontendReviewAppId } from "@/lib/externalFrontendReview";

export type WorldClassUserEvidenceLevel = "diagnostic_only" | "user_evidence";

export type WorldClassUserTaskResult = {
  task_id: "find-next-action" | "compose-safe-recipe" | "inspect-proof-boundary";
  reviewer_id: string;
  next_action_identified: boolean;
  completed_without_raw_json: boolean;
  boundary_confusion: boolean;
};

export type WorldClassExternalReviewResult = {
  app_id: ExternalFrontendReviewAppId;
  status: "not_started" | "completed" | "rejected";
  reviewer_id: string;
  next_action_identified: boolean;
  runtime_overclaim_seen: boolean;
  candidate_mapped_confusion_seen: boolean;
  recommended_delta_count: number;
};

export type WorldClassUserEvidence = {
  evidence_ref: string;
  evidence_level: WorldClassUserEvidenceLevel;
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
  provider_executions: 0;
  task_results: WorldClassUserTaskResult[];
  external_review_results: WorldClassExternalReviewResult[];
};

export type WorldClassUserEvidenceSummary = {
  userEvidenceReady: boolean;
  testedUsers: number;
  taskResultCount: number;
  nextActionClarityRatio: number;
  rawJsonAvoidanceRatio: number;
  externalReviewCoverageRatio: number;
  externalReviewsCompleted: number;
  externalReviewsRequired: number;
  boundaryDefectCount: number;
};

const requiredExternalApps: ExternalFrontendReviewAppId[] = [
  "claude_design",
  "v0_vercel",
  "figma_make",
];

const boundary = {
  candidate_only: true,
  projection_only: true,
  graph_write_allowed: false,
  proof_eligible: false,
  provider_executions: 0,
} as const;

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

export function buildEmptyWorldClassUserEvidence(): WorldClassUserEvidence {
  return {
    evidence_ref: "world-class user evidence intake pending",
    evidence_level: "diagnostic_only",
    ...boundary,
    task_results: [],
    external_review_results: requiredExternalApps.map((appId) => ({
      app_id: appId,
      status: "not_started",
      reviewer_id: "pending",
      next_action_identified: false,
      runtime_overclaim_seen: false,
      candidate_mapped_confusion_seen: false,
      recommended_delta_count: 0,
    })),
  };
}

export function summarizeWorldClassUserEvidence(
  evidence: WorldClassUserEvidence = buildEmptyWorldClassUserEvidence(),
): WorldClassUserEvidenceSummary {
  const reviewerIds = new Set(
    evidence.task_results.map((result) => result.reviewer_id).filter(Boolean),
  );
  const nextActionClarityRatio = ratio(
    evidence.task_results.filter((result) => result.next_action_identified).length,
    evidence.task_results.length,
  );
  const rawJsonAvoidanceRatio = ratio(
    evidence.task_results.filter((result) => result.completed_without_raw_json).length,
    evidence.task_results.length,
  );
  const completedExternalApps = new Set(
    evidence.external_review_results
      .filter((result) => result.status === "completed")
      .map((result) => result.app_id),
  );
  const externalReviewsCompleted = requiredExternalApps.filter((appId) =>
    completedExternalApps.has(appId),
  ).length;
  const boundaryDefectCount =
    evidence.task_results.filter((result) => result.boundary_confusion).length +
    evidence.external_review_results.filter(
      (result) => result.runtime_overclaim_seen || result.candidate_mapped_confusion_seen,
    ).length;
  const externalReviewCoverageRatio = ratio(
    externalReviewsCompleted,
    requiredExternalApps.length,
  );
  const userEvidenceReady =
    evidence.evidence_level === "user_evidence" &&
    evidence.provider_executions === 0 &&
    evidence.task_results.length > 0 &&
    nextActionClarityRatio >= 0.95 &&
    rawJsonAvoidanceRatio >= 0.98 &&
    externalReviewCoverageRatio === 1 &&
    boundaryDefectCount === 0;

  return {
    userEvidenceReady,
    testedUsers: reviewerIds.size,
    taskResultCount: evidence.task_results.length,
    nextActionClarityRatio,
    rawJsonAvoidanceRatio,
    externalReviewCoverageRatio,
    externalReviewsCompleted,
    externalReviewsRequired: requiredExternalApps.length,
    boundaryDefectCount,
  };
}
