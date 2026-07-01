import { describe, expect, it } from "vitest";
import {
  getRecommendedWidgetSlots,
  getWidgetFoundryReuseRatio,
  getWidgetFoundrySourceReadback,
} from "@/lib/widgetFoundryBridge";

describe("widgetFoundryBridge", () => {
  it("exposes read-only foundry widget candidates with fit and extraction contracts", () => {
    const slots = getRecommendedWidgetSlots();

    expect(slots.length).toBeGreaterThanOrEqual(12);
    expect(slots.map((slot) => slot.slot_id)).toContain("widget.slot.vibe-canvas");
    for (const slot of slots) {
      expect(slot.source_ref).toContain("widgetdc-consulting-frontend");
      expect(slot.source_fit_score).toBeGreaterThanOrEqual(0);
      expect(slot.source_fit_score).toBeLessThanOrEqual(1);
      expect(slot.extraction_contract.validation_status).toBe("candidate_only");
      expect(slot.extraction_contract.required_fields).toEqual([
        "source_fit_score",
        "extraction_contract",
      ]);
      expect(slot.candidate_only).toBe(true);
      expect(slot.projection_only).toBe(true);
      expect(slot.graph_write_allowed).toBe(false);
      expect(slot.proof_eligible).toBe(false);
    }
  });

  it("exposes source-backed Foundry readback without treating candidates as mapped graph coverage", () => {
    const readback = getWidgetFoundrySourceReadback();

    expect(readback.source_doc_ref).toBe(
      "widgetdc-consulting-frontend/docs/WIDGET_FOUNDRY_INVENTORY.md",
    );
    expect(readback.inventory_contract_ref).toContain("widgetFoundryInventory.ts");
    expect(readback.local_component_registry_count).toBe(22);
    expect(readback.recommended_slot_candidate_count).toBe(getRecommendedWidgetSlots().length);
    expect(readback.graph_widget_nodes).toBe(52);
    expect(readback.graph_ui_component_nodes).toBe(2273);
    expect(readback.graph_harvested_component_nodes).toBe(0);
    expect(readback.mapped_count).toBe(0);
    expect(readback.mapped_count_source).toBe("graph_readback_only");
    expect(readback.parity_status).toBe("stats_parity_required");
    expect(readback.graph_write_allowed).toBe(false);
    expect(readback.proof_eligible).toBe(false);
    expect(readback.provider_executions).toBe(0);
    expect(getWidgetFoundryReuseRatio()).toBe(1);
  });
});
