import { describe, expect, it } from "vitest";
import { getRecommendedWidgetSlots } from "@/lib/widgetFoundryBridge";

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
});
