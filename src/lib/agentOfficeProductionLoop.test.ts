import { describe, expect, it } from "vitest";
import {
  agentOfficeProductionLoop,
  summarizeCompetenceMapping,
  validateProductionLoopModel,
} from "./agentOfficeProductionLoop";

describe("agentOfficeProductionLoop", () => {
  it("keeps the WDC production loop in the required order", () => {
    expect(agentOfficeProductionLoop.stages.map((stage) => stage.label)).toEqual([
      "Demand",
      "CapabilityResolution",
      "WorkBOM",
      "RouteCatalog",
      "ProjectTree",
      "AgentTeamBOM",
      "EnvironmentBOM",
      "Execution",
      "Verification",
      "ProofGate",
      "CloseoutTree",
      "LearningExtractor",
    ]);
  });

  it("keeps candidate count separate from mapped count", () => {
    expect(summarizeCompetenceMapping(agentOfficeProductionLoop.competenceRows)).toEqual({
      candidateCount: 3,
      mappedCount: 2,
      debtCount: 1,
    });
  });

  it("requires source fit and extraction contracts for every mapping candidate", () => {
    for (const candidate of agentOfficeProductionLoop.competenceRows) {
      expect(candidate.source_fit_score).toBeGreaterThanOrEqual(0);
      expect(candidate.source_fit_score).toBeLessThanOrEqual(1);
      expect(candidate.extraction_contract.artifact).toBeTruthy();
      expect(candidate.extraction_contract.requiredEvidence.length).toBeGreaterThan(0);
    }
  });

  it("keeps ProjectTree visible for both start and closeout", () => {
    expect(agentOfficeProductionLoop.projectTreeRefs.some((ref) => ref.phase === "Start")).toBe(
      true,
    );
    expect(agentOfficeProductionLoop.projectTreeRefs.some((ref) => ref.phase === "Closeout")).toBe(
      true,
    );
  });

  it("keeps reusable learning behind A2A STANDARD_CANDIDATE semantics", () => {
    expect(agentOfficeProductionLoop.learning).toMatchObject({
      transport: "A2A",
      type: "STANDARD_CANDIDATE",
    });
    expect(agentOfficeProductionLoop.learning.proofBoundary).toContain("pending adoption");
  });

  it("passes the production loop model validator", () => {
    expect(validateProductionLoopModel(agentOfficeProductionLoop)).toEqual({
      ok: true,
      failures: [],
    });
  });
});
