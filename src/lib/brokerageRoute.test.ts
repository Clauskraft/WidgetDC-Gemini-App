import { describe, expect, it } from "vitest";
import { buildBrokerageRouteCard } from "@/lib/brokerageRoute";

describe("brokerageRoute", () => {
  it("builds a read-only candidate route card with graph-readback mapped_count", () => {
    const card = buildBrokerageRouteCard("operate");

    expect(card.candidate_only).toBe(true);
    expect(card.projection_only).toBe(true);
    expect(card.graph_write_allowed).toBe(false);
    expect(card.proof_eligible).toBe(false);
    expect(card.candidate_count).toBeGreaterThan(0);
    expect(card.mapped_count).toBe(0);
    expect(card.mapped_count_source).toBe("graph_readback_only");
    expect(card.foundry_source_readback.parity_status).toBe("stats_parity_required");
    expect(card.foundry_source_readback.mapped_count).toBe(0);
    expect(card.foundry_source_readback.graph_write_allowed).toBe(false);
    expect(card.proof_boundary.missing_competence).toBe("approval.gated.execution");
    expect(card.route_operation.status).toBe("expected_stop");
  });

  it("keeps WidgetSlot contracts candidate-only and projection-only", () => {
    const card = buildBrokerageRouteCard("app");

    expect(card.widget_slots.length).toBeGreaterThanOrEqual(3);
    for (const slot of card.widget_slots) {
      expect(slot.slot_id).toMatch(/^widget\.slot\./);
      expect(slot.source_ref).toContain("widgetdc-consulting-frontend");
      expect(slot.required_competences.length).toBeGreaterThan(0);
      expect(slot.provided_competences.length).toBeGreaterThan(0);
      expect(slot.source_fit_score).toBeGreaterThanOrEqual(0);
      expect(slot.extraction_contract.validation_status).toBe("candidate_only");
      expect(slot.candidate_only).toBe(true);
      expect(slot.projection_only).toBe(true);
      expect(slot.graph_write_allowed).toBe(false);
      expect(slot.proof_eligible).toBe(false);
    }
  });
});
