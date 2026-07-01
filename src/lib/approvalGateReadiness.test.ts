import { describe, expect, it } from "vitest";
import { buildApprovalGateReadiness } from "@/lib/approvalGateReadiness";

describe("approvalGateReadiness", () => {
  it("fails closed when WDC approval readback is missing", () => {
    const readiness = buildApprovalGateReadiness();

    expect(readiness).toMatchObject({
      gate_id: "approval.gated.execution",
      status: "expected_stop",
      missing_competence: "approval.gated.execution",
      approved_scope: null,
      ui_execution_enabled: false,
      provider_executions: 0,
      graph_writes: 0,
      claim_mutations: 0,
      candidate_only: true,
      projection_only: true,
      graph_write_allowed: false,
      proof_eligible: false,
    });
    expect(readiness.allowed_actions).toEqual([
      "preview",
      "compose",
      "explain",
      "dry-run",
      "request approval",
    ]);
    expect(readiness.blocked_actions).toEqual([
      "execute provider",
      "deploy agent",
      "write graph",
      "promote claim",
    ]);
  });

  it("keeps P0 UI execution disabled even when approval readback is present", () => {
    const readiness = buildApprovalGateReadiness({
      approved: true,
      plan_id: "hyp-123",
      scope: "strategy-cockpit-readiness",
      approved_by: "clauskraft@gmail.com",
      correlation_id: "corr-123",
      source: "wdc_agent_office_readback",
    });

    expect(readiness.status).toBe("approval_present_execution_not_exposed");
    expect(readiness.approved_scope).toBe("strategy-cockpit-readiness");
    expect(readiness.approval_ref).toBe("hyp-123");
    expect(readiness.correlation_id).toBe("corr-123");
    expect(readiness.ui_execution_enabled).toBe(false);
    expect(readiness.next_action).toContain("Continue through WDC CLI");
  });
});
