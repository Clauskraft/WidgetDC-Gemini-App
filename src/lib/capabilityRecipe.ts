import type { CapabilityLibraryEntry } from "@/lib/capabilityLibrary";
import {
  buildApprovalGateReadiness,
  type ApprovalGateReadiness,
} from "@/lib/approvalGateReadiness";

export type CapabilityRecipe = {
  id: string;
  intent: string;
  entries: CapabilityLibraryEntry[];
  candidate_count: number;
  mapped_count: 0;
  mapped_count_source: "graph_readback_only";
  activation: {
    status: "expected_stop";
    missing_competence: "approval.gated.execution";
    next_action: "Request approval through WDC Agent Office before execution.";
  };
  approval_readiness: ApprovalGateReadiness;
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
};

export function buildCapabilityRecipe(
  intent: string,
  entries: CapabilityLibraryEntry[],
): CapabilityRecipe {
  return {
    id: `recipe:${
      intent
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "untitled"
    }`,
    intent,
    entries,
    candidate_count: entries.length,
    mapped_count: 0,
    mapped_count_source: "graph_readback_only",
    activation: {
      status: "expected_stop",
      missing_competence: "approval.gated.execution",
      next_action: "Request approval through WDC Agent Office before execution.",
    },
    approval_readiness: buildApprovalGateReadiness(),
    candidate_only: true,
    projection_only: true,
    graph_write_allowed: false,
    proof_eligible: false,
  };
}
