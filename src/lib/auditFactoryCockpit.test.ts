import { describe, expect, it } from "vitest";
import {
  getAuditFactoryCockpitModel,
  getRequiredPanelIds,
  validateAuditFactoryCockpit,
} from "@/lib/auditFactoryCockpit";

describe("auditFactoryCockpit", () => {
  it("covers every required audit factory panel with source, boundary and next action", () => {
    const model = getAuditFactoryCockpitModel();
    const validation = validateAuditFactoryCockpit(model);

    expect(validation).toEqual({ ok: true, failures: [] });
    expect(model.panels.map((panel) => panel.id)).toEqual(
      expect.arrayContaining(getRequiredPanelIds()),
    );
    expect(model.panels).toHaveLength(getRequiredPanelIds().length);
    for (const panel of model.panels) {
      expect(panel.evidenceSource).toBeTruthy();
      expect(panel.proofBoundary).toBeTruthy();
      expect(panel.lastReadback).toBeTruthy();
      expect(panel.nextSafeAction).toBeTruthy();
    }
  });

  it("keeps capability resolution before providers and scoring", () => {
    const ids = getAuditFactoryCockpitModel().routeTree.nodes.map((node) => node.id);

    expect(ids.indexOf("capability")).toBeLessThan(ids.indexOf("required"));
    expect(ids.indexOf("required")).toBeLessThan(ids.indexOf("providers"));
    expect(ids.indexOf("providers")).toBeLessThan(ids.indexOf("scoring"));
  });

  it("keeps stale readback mismatches visible instead of hiding them", () => {
    const model = getAuditFactoryCockpitModel();

    expect(model.latestRuntimeReadback.capabilitiesActive).toBe(431);
    expect(model.latestRuntimeReadback.capabilitiesUnstable).toBe(1);
    expect(model.latestRuntimeReadback.capabilityReadbackNote).toContain("Static cockpit sample");
    expect(model.latestRuntimeReadback.capabilityReadbackNote).toContain("432 active");
    expect(model.cockpitReadbackCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "capability-count",
          observed: "431 active / 1 unstable / 0 offline",
          caveat: expect.stringContaining("volatile static sample"),
        }),
      ]),
    );
  });

  it("does not grant frontend authority or mutation paths", () => {
    const model = getAuditFactoryCockpitModel();
    const serialized = JSON.stringify(model).toLowerCase();

    expect(model.claimBoundary).toContain("WDC CLI and Agent Office remain the authority");
    expect(serialized).toContain("graph writes");
    expect(serialized).toContain("provider executions");
    expect(serialized).toContain("claim promotions");
    expect(serialized).not.toContain("frontend is the authority");
    expect(model.forbiddenLanguage).toEqual(
      expect.arrayContaining(["graph gaps closed", "fully autonomous"]),
    );
    expect(model.panels.map((panel) => panel.status)).not.toContain("claim");
  });
});
