export type ApprovalReadback = {
  approved: boolean;
  plan_id: string;
  scope: string | null;
  approved_by?: string | null;
  correlation_id?: string | null;
  source: "wdc_agent_office_readback";
};

export type ApprovalGateReadiness = {
  gate_id: "approval.gated.execution";
  status: "expected_stop" | "approval_present_execution_not_exposed";
  missing_competence: "approval.gated.execution" | null;
  approved_scope: string | null;
  approval_ref: string | null;
  approved_by: string | null;
  correlation_id: string | null;
  source: "read_only_candidate" | "wdc_agent_office_readback";
  allowed_actions: ["preview", "compose", "explain", "dry-run", "request approval"];
  blocked_actions: ["execute provider", "deploy agent", "write graph", "promote claim"];
  ui_execution_enabled: false;
  next_action: string;
  provider_executions: 0;
  graph_writes: 0;
  claim_mutations: 0;
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
};

const boundary = {
  provider_executions: 0,
  graph_writes: 0,
  claim_mutations: 0,
  candidate_only: true,
  projection_only: true,
  graph_write_allowed: false,
  proof_eligible: false,
} as const;

const allowed_actions = ["preview", "compose", "explain", "dry-run", "request approval"] as const;
const blocked_actions = ["execute provider", "deploy agent", "write graph", "promote claim"] as const;

export function buildApprovalGateReadiness(
  readback?: ApprovalReadback | null,
): ApprovalGateReadiness {
  if (readback?.approved && readback.scope) {
    return {
      gate_id: "approval.gated.execution",
      status: "approval_present_execution_not_exposed",
      missing_competence: null,
      approved_scope: readback.scope,
      approval_ref: readback.plan_id,
      approved_by: readback.approved_by ?? null,
      correlation_id: readback.correlation_id ?? null,
      source: readback.source,
      allowed_actions,
      blocked_actions,
      ui_execution_enabled: false,
      next_action:
        "Continue through WDC CLI approved execution surface; P0 cockpit does not execute.",
      ...boundary,
    };
  }

  return {
    gate_id: "approval.gated.execution",
    status: "expected_stop",
    missing_competence: "approval.gated.execution",
    approved_scope: null,
    approval_ref: null,
    approved_by: null,
    correlation_id: null,
    source: "read_only_candidate",
    allowed_actions,
    blocked_actions,
    ui_execution_enabled: false,
    next_action: "Request approval through WDC Agent Office before execution.",
    ...boundary,
  };
}
