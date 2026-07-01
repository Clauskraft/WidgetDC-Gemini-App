import { describe, expect, it } from "vitest";
import {
  agentOfficeProductionLoop,
  buildBuildabilityLedger,
  buildEvidenceContractLedger,
  buildMappingCandidateLedger,
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
      stopConditionCount: 5,
      promotionBlockedCount: 5,
      buildabilityLedgerCount: 7,
      buildabilityBlockedCount: 2,
      evidenceContractCount: 10,
      evidenceContractIncompleteCount: 0,
      mappingCandidateCount: 11,
      mappingMappedCount: 0,
      mappingCandidateOnlyCount: 11,
    });
    expect(envelope.payload.stopConditionIds).toEqual([
      "MAPPED_COUNT_ZERO_EXPECTED_STOP",
      "CANDIDATE_COUNT_NOT_MAPPED_COUNT",
      "READBACK_NOT_RUNTIME_PROOF",
      "MISSING_OSINT_DOCUMENTS",
      "MISSING_OSINT_EMBEDDINGS",
    ]);
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

  it("builds a BuildabilityLedger from WorkBOM, RouteCatalog and EnvironmentBOM", () => {
    const ledger = buildBuildabilityLedger(resolveAgentOfficeProductionLoop("operate"));
    expect(ledger).toHaveLength(7);
    expect(ledger.map((item) => item.source)).toEqual([
      "workbom",
      "workbom",
      "workbom",
      "route-catalog",
      "environment-bom",
      "environment-bom",
      "environment-bom",
    ]);
    expect(ledger.filter((item) => item.status === "blocked").map((item) => item.id)).toEqual([
      "workbom:operate-proof",
      "environment:operate-runtime",
    ]);
    expect(ledger.every((item) => item.requiredEvidence.length > 0)).toBe(true);
    expect(ledger.every((item) => item.proofBoundary.length > 0)).toBe(true);
  });

  it("builds an EvidenceContractLedger with source fit and extraction contracts", () => {
    const ledger = buildEvidenceContractLedger(resolveAgentOfficeProductionLoop("operate"));
    expect(ledger).toHaveLength(10);
    expect(ledger.map((item) => item.source)).toEqual([
      "competence",
      "competence",
      "competence",
      "competence",
      "agent-team",
      "agent-team",
      "agent-team",
      "environment",
      "environment",
      "environment",
    ]);
    expect(ledger.every((item) => item.status === "complete")).toBe(true);
    expect(
      ledger
        .filter((item) => item.source !== "environment")
        .every((item) => item.source_fit_score !== null && item.source_fit_score >= 0),
    ).toBe(true);
    expect(ledger.every((item) => item.contractArtifact.length > 0)).toBe(true);
    expect(ledger.every((item) => item.requiredEvidence.length > 0)).toBe(true);
  });

  it("builds a MappingCandidateLedger for every production-loop edge", () => {
    const ledger = buildMappingCandidateLedger(resolveAgentOfficeProductionLoop("operate"));
    expect(ledger).toHaveLength(11);
    expect(ledger.at(0)).toMatchObject({
      source_ref: "Demand",
      target_ref: "CapabilityResolution",
      relation_type: "PRODUCTION_LOOP_NEXT",
      state: "candidate",
      candidate_only: true,
      projection_only: true,
      proof_eligible: false,
    });
    expect(ledger.at(-1)).toMatchObject({
      source_ref: "CloseoutTree",
      target_ref: "LearningExtractor",
    });
    expect(ledger.filter((item) => item.state === "mapped")).toHaveLength(0);
    expect(ledger.every((item) => item.source_fit_score >= 0 && item.source_fit_score <= 1)).toBe(
      true,
    );
    expect(
      ledger.every(
        (item) =>
          item.extraction_contract.required_fields.includes("source_fit_score") &&
          item.extraction_contract.required_fields.includes("extraction_contract"),
      ),
    ).toBe(true);
    expect(ledger.every((item) => item.proofBoundary.includes("graph readback"))).toBe(true);
  });

  it("rejects incomplete evidence contracts surfaced by the ledger", () => {
    const model = {
      ...resolveAgentOfficeProductionLoop("operate"),
      competenceRows: [
        {
          ...resolveAgentOfficeProductionLoop("operate").competenceRows[0],
          source_fit_score: 1.2,
        },
      ],
    };
    expect(validateProductionLoopModel(model).failures).toContain(
      "EvidenceContractLedger contains incomplete extraction contracts",
    );
  });

  it("keeps every demand scope buildable through WorkBOM and RouteCatalog readiness", () => {
    for (const scopeId of Object.keys(demandLoopProfiles) as Array<
      keyof typeof demandLoopProfiles
    >) {
      const model = resolveAgentOfficeProductionLoop(scopeId);
      const ledger = buildBuildabilityLedger(model);
      expect(ledger.some((item) => item.source === "workbom" && item.status === "ready")).toBe(
        true,
      );
      expect(
        ledger.some((item) => item.source === "route-catalog" && item.status === "ready"),
      ).toBe(true);
      expect(validateProductionLoopModel(model)).toEqual({ ok: true, failures: [] });
    }
  });

  it("rejects demand loops without a routed build method", () => {
    const model = {
      ...resolveAgentOfficeProductionLoop("app"),
      routeCatalog: [{ ...resolveAgentOfficeProductionLoop("app").routeCatalog[0], method: "" }],
    };
    expect(validateProductionLoopModel(model).failures).toContain(
      "RouteCatalog entries must include an execution method",
    );
  });

  it("keeps WDC stop conditions explicit and proof-ineligible", () => {
    const model = resolveAgentOfficeProductionLoop("operate");
    expect(model.stopConditions).toHaveLength(5);
    expect(model.stopConditions.map((item) => item.id)).toContain("READBACK_NOT_RUNTIME_PROOF");
    expect(model.stopConditions.map((item) => item.id)).toContain(
      "CANDIDATE_COUNT_NOT_MAPPED_COUNT",
    );
    expect(model.stopConditions.every((item) => item.proofEligible === false)).toBe(true);
    expect(model.stopConditions.every((item) => item.proofBoundary.length > 0)).toBe(true);
    expect(model.stopConditions.every((item) => item.nextAction.length > 0)).toBe(true);
    expect(validateProductionLoopModel(model)).toEqual({ ok: true, failures: [] });
  });

  it("rejects production loops that hide runtime readback stop conditions", () => {
    const model = {
      ...resolveAgentOfficeProductionLoop("operate"),
      stopConditions: resolveAgentOfficeProductionLoop("operate").stopConditions.filter(
        (item) => item.id !== "READBACK_NOT_RUNTIME_PROOF",
      ),
    };
    expect(validateProductionLoopModel(model).failures).toContain(
      "StopConditionLedger must include readback runtime-proof boundary",
    );
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
