import { describe, expect, it } from "vitest";
import { buildBrokerageRouteCard } from "@/lib/brokerageRoute";
import { buildCapabilityLibrary } from "@/lib/capabilityLibrary";
import { buildCapabilityRecipe } from "@/lib/capabilityRecipe";
import {
  buildWorldClassUxEvidence,
  summarizeWorldClassUxEvidence,
} from "@/lib/worldClassUxEvidence";

describe("worldClassUxEvidence", () => {
  it("measures P0 UX evidence without graph writes, provider execution, or proof eligibility", () => {
    const entries = buildCapabilityLibrary();
    const routeCard = buildBrokerageRouteCard("general");
    const recipe = buildCapabilityRecipe("World-class capability cockpit", entries.slice(0, 8));
    const evidence = buildWorldClassUxEvidence({ capabilityEntries: entries, recipe, routeCard });
    const summary = summarizeWorldClassUxEvidence(evidence);

    expect(evidence.evidence_level).toBe("diagnostic_only");
    expect(evidence.candidate_only).toBe(true);
    expect(evidence.projection_only).toBe(true);
    expect(evidence.graph_write_allowed).toBe(false);
    expect(evidence.proof_eligible).toBe(false);
    expect(summary.firstUsefulRoutePassed).toBe(true);
    expect(summary.nextActionClarityRatio).toBe(1);
    expect(summary.rawJsonAvoidanceRatio).toBe(1);
    expect(summary.searchSuccessRatio).toBe(1);
    expect(summary.validRecipeRatio).toBe(1);
    expect(summary.inspectorUsefulnessRatio).toBe(1);
    expect(summary.visualArtifactReadabilityRatio).toBe(1);
    expect(summary.stopHarvestRatio).toBe(1);
  });

  it("keeps search evidence anchored to capability inventory terms", () => {
    const entries = buildCapabilityLibrary();
    const routeCard = buildBrokerageRouteCard("general");
    const recipe = buildCapabilityRecipe("World-class capability cockpit", entries.slice(0, 4));
    const evidence = buildWorldClassUxEvidence({ capabilityEntries: entries, recipe, routeCard });

    expect(evidence.library_search.query_tests).toBeGreaterThanOrEqual(7);
    expect(evidence.library_search.queries).toEqual(
      expect.arrayContaining(["skill", "agent", "pattern", "widget", "route", "proof_gate"]),
    );
  });
});
