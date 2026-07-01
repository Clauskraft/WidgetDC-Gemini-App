import { describe, expect, it } from "vitest";
import {
  agentOfficeProductionLoop,
  buildProofAdoptionLadder,
  buildProductionLoopCoverageMatrix,
  createLearningBroadcastEnvelope,
  demandLoopProfiles,
  resolveAgentOfficeProductionLoop,
  summarizeCompetenceMapping,
  summarizeOperationalLedgers,
  summarizeProofGate,
  validateLearningBroadcastEnvelope,
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

  it("resolves every supported demand scope into a buildable production loop", () => {
    for (const scopeId of Object.keys(demandLoopProfiles) as Array<
      keyof typeof demandLoopProfiles
    >) {
      const model = resolveAgentOfficeProductionLoop(scopeId);
      expect(model.scopeId).toBe(scopeId);
      expect(model.demand).toBeTruthy();
      expect(model.workBom.length).toBeGreaterThan(0);
      expect(model.routeCatalog.length).toBeGreaterThan(0);
      expect(model.environmentBom.length).toBeGreaterThan(0);
      expect(model.competenceRows.at(-1)).toMatchObject(model.competenceCandidate);
      expect(validateProductionLoopModel(model)).toEqual({ ok: true, failures: [] });
    }
  });

  it("uses required/provided competence matching before dependency ordering", () => {
    const model = resolveAgentOfficeProductionLoop("operate");
    expect(model.competenceCandidate).toMatchObject({
      required: "WDC operation demand",
      provided: "WDC CLI session + claim route",
      state: "matched",
    });
    expect(
      model.explicitDependencies.every((dependency) => dependency.reason === "stage-order"),
    ).toBe(true);
  });

  it("keeps demand-resolved candidate count separate from mapped count", () => {
    expect(
      summarizeCompetenceMapping(resolveAgentOfficeProductionLoop("app").competenceRows),
    ).toEqual({
      candidateCount: 4,
      mappedCount: 3,
      debtCount: 1,
    });
  });

  it("builds an A2A STANDARD_CANDIDATE learning envelope from a resolved demand", () => {
    const model = resolveAgentOfficeProductionLoop("operate");
    const envelope = createLearningBroadcastEnvelope(model);
    expect(envelope).toMatchObject({
      transport: "A2A",
      messageType: "STANDARD_CANDIDATE",
      adoptionState: "candidate",
      sourceScopeId: "operate",
      artifactId: "agent-office-production-loop:operate",
    });
    expect(envelope.payload).toMatchObject({
      candidateCount: 4,
      mappedCount: 3,
      debtCount: 1,
      agentTeamBomCount: 3,
      environmentBomCount: 3,
      executionLedgerCount: 3,
      verificationLedgerCount: 5,
      closeoutTreeCount: 3,
      coverageRequirementCount: 10,
      coverageDebtCount: 0,
      proofAdoptionLadderCount: 5,
      proofAdoptionBlockedCount: 2,
    });
    expect(envelope.payload.stageOrder.at(0)).toBe("demand");
    expect(envelope.payload.stageOrder.at(-1)).toBe("learning");
    expect(envelope.payload.extractionContracts.length).toBe(
      envelope.payload.candidateCount +
        envelope.payload.agentTeamBomCount +
        envelope.payload.environmentBomCount,
    );
    expect(envelope.proofBoundary).toContain("pending adoption");
    expect(validateLearningBroadcastEnvelope(envelope)).toEqual({ ok: true, failures: [] });
  });

  it("models AgentTeamBOM, ExecutionLedger and VerificationLedger without runtime proof claims", () => {
    const model = resolveAgentOfficeProductionLoop("operate");
    expect(summarizeOperationalLedgers(model)).toMatchObject({
      agentTeamBomCount: 3,
      environmentBomCount: 3,
      executionLedgerCount: 3,
      verificationLedgerCount: 5,
      closeoutTreeCount: 3,
      claimGatedExecutionCount: 2,
      environmentDebtCount: 1,
      runtimeProofClaims: 0,
    });
    expect(model.agentTeamBom.every((member) => member.source_fit_score >= 0)).toBe(true);
    expect(model.agentTeamBom.every((member) => member.extraction_contract.artifact)).toBe(true);
    expect(model.executionLedger.some((item) => item.claimRequired)).toBe(true);
    expect(model.verificationLedger.every((item) => item.runtimeProof === false)).toBe(true);
    expect(model.verificationLedger.map((item) => item.kind)).toEqual([
      "unit",
      "lint",
      "visual",
      "build",
      "runtime",
    ]);
    expect(validateProductionLoopModel(model)).toEqual({ ok: true, failures: [] });
  });

  it("keeps EnvironmentBOM evidence contracts visible per demand scope", () => {
    const model = resolveAgentOfficeProductionLoop("operate");
    expect(model.environmentBom.map((item) => item.category)).toEqual([
      "repo",
      "branch",
      "runtime",
    ]);
    expect(model.environmentBom.every((item) => item.extraction_contract.artifact)).toBe(true);
    expect(
      model.environmentBom.every((item) => item.extraction_contract.requiredEvidence.length > 0),
    ).toBe(true);
    expect(model.environmentBom.find((item) => item.id === "operate-runtime")).toMatchObject({
      status: "debt",
      category: "runtime",
    });
    expect(validateProductionLoopModel(model)).toEqual({ ok: true, failures: [] });
  });

  it("keeps CloseoutTree release and A2A handoff before learning adoption", () => {
    const model = resolveAgentOfficeProductionLoop("operate");
    expect(model.closeoutTree.map((item) => item.handoff)).toEqual([
      "release",
      "a2a",
      "adoption-followup",
    ]);
    expect(model.closeoutTree.every((item) => item.requiredEvidence.length > 0)).toBe(true);
    expect(model.closeoutTree.at(-1)?.proofBoundary).toContain("candidate");
    expect(validateProductionLoopModel(model)).toEqual({ ok: true, failures: [] });
  });

  it("rejects EnvironmentBOM rows without extraction evidence", () => {
    const model = {
      ...resolveAgentOfficeProductionLoop("operate"),
      environmentBom: [
        {
          ...resolveAgentOfficeProductionLoop("operate").environmentBom[0],
          extraction_contract: {
            ...resolveAgentOfficeProductionLoop("operate").environmentBom[0].extraction_contract,
            requiredEvidence: [],
          },
        },
      ],
    };
    expect(validateProductionLoopModel(model).failures).toContain(
      "operate-control is missing EnvironmentBOM extraction evidence contract",
    );
  });

  it("rejects verification ledgers that claim runtime proof directly", () => {
    const model = {
      ...resolveAgentOfficeProductionLoop("operate"),
      verificationLedger: [
        {
          ...resolveAgentOfficeProductionLoop("operate").verificationLedger[0],
          runtimeProof: true,
        },
      ],
    };
    expect(validateProductionLoopModel(model).failures).toContain(
      "VerificationLedger cannot claim runtime proof",
    );
  });

  it("builds a covered production-loop requirement matrix for every demand scope", () => {
    for (const scopeId of Object.keys(demandLoopProfiles) as Array<
      keyof typeof demandLoopProfiles
    >) {
      const matrix = buildProductionLoopCoverageMatrix(resolveAgentOfficeProductionLoop(scopeId));
      expect(matrix).toHaveLength(10);
      expect(matrix.map((item) => item.id)).toEqual([
        "stage-order",
        "required-provided-primary",
        "explicit-dependencies-stage-order",
        "candidate-mapped-count-separation",
        "source-fit-extraction-contracts",
        "capability-debt-ledger",
        "project-tree-start-closeout",
        "runtime-proof-boundary",
        "a2a-standard-candidate",
        "dirty-claimed-scope-handoff",
      ]);
      expect(matrix.every((item) => item.status === "covered")).toBe(true);
      expect(matrix.every((item) => item.evidence.length > 0)).toBe(true);
    }
  });

  it("rejects production loops with coverage debt", () => {
    const model = {
      ...resolveAgentOfficeProductionLoop("operate"),
      learning: {
        ...resolveAgentOfficeProductionLoop("operate").learning,
        transport: "file" as const,
      },
    };
    expect(
      buildProductionLoopCoverageMatrix(model).find((item) => item.status === "debt"),
    ).toMatchObject({
      id: "a2a-standard-candidate",
    });
    expect(validateProductionLoopModel(model).failures).toContain(
      "LearningExtractor must broadcast an A2A STANDARD_CANDIDATE",
    );
    expect(validateProductionLoopModel(model).failures).toContain(
      "coverage debt: a2a-standard-candidate",
    );
  });

  it("keeps ProofGate at code/model proof until deploy and three verification passes are present", () => {
    const model = resolveAgentOfficeProductionLoop("operate");
    expect(summarizeProofGate(model.proofGate)).toMatchObject({
      claim: "code-model-proof",
      runtimeProof: false,
      presentCount: 1,
      missingCount: 4,
      requiredPasses: 3,
      passedVerifications: 0,
    });
    expect(model.proofGate.boundary).toContain("not runtime proof");
    expect(validateProductionLoopModel(model)).toEqual({ ok: true, failures: [] });
  });

  it("builds a proof adoption ladder without promoting readback to runtime proof", () => {
    const ladder = buildProofAdoptionLadder(resolveAgentOfficeProductionLoop("operate"));
    expect(ladder.map((item) => item.id)).toEqual([
      "code-model-evidence",
      "ci-verification",
      "deployment-readback",
      "runtime-pass-chain",
      "adoption-readback",
    ]);
    expect(ladder.filter((item) => item.status === "satisfied").map((item) => item.id)).toEqual([
      "code-model-evidence",
      "ci-verification",
      "adoption-readback",
    ]);
    expect(ladder.filter((item) => item.status === "blocked").map((item) => item.id)).toEqual([
      "deployment-readback",
      "runtime-pass-chain",
    ]);
    expect(ladder.every((item) => item.runtimeProofEligible === false)).toBe(true);
    expect(ladder.at(-1)?.proofBoundary).toContain("candidate");
  });

  it("rejects runtime proof without deployment readback and three verification passes", () => {
    const model = {
      ...resolveAgentOfficeProductionLoop("operate"),
      proofGate: {
        ...resolveAgentOfficeProductionLoop("operate").proofGate,
        claim: "runtime-proof" as const,
        runtimeProof: true,
      },
    };
    expect(validateProductionLoopModel(model).failures).toContain(
      "runtime proof requires deployment readback and three verification passes",
    );
  });
});
