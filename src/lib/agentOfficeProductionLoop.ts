export type ProductionLoopStageId =
  | "demand"
  | "capability"
  | "workbom"
  | "route"
  | "project"
  | "agent"
  | "environment"
  | "execution"
  | "verification"
  | "proof"
  | "closeout"
  | "learning";

export type DemandLoopScopeId = "app" | "book" | "investigation" | "operate" | "general";

export type ProjectTreePhase = "Start" | "Closeout";

export type CompetenceMappingState = "matched" | "mapped" | "debt";

export type ProofEvidenceKind = "code" | "deploy" | "verification-pass";

export type ProofEvidenceStatus = "present" | "missing";

export type ExtractionContract = {
  source: "agent-office-static-model" | "wdc-graph-readback";
  artifact: string;
  requiredEvidence: string[];
};

export type ProductionLoopStage = {
  id: ProductionLoopStageId;
  label: string;
  proofBoundary: string;
};

export type ProjectTreeRef = {
  ref: string;
  label: string;
  phase: ProjectTreePhase;
};

export type CompetenceMappingCandidate = {
  required: string;
  provided: string;
  state: CompetenceMappingState;
  source_fit_score: number;
  extraction_contract: ExtractionContract;
};

export type CapabilityDebtItem = {
  id: string;
  label: string;
  reason: string;
};

export type ProofGateEvidence = {
  id: string;
  label: string;
  kind: ProofEvidenceKind;
  status: ProofEvidenceStatus;
  source: "github-pr" | "deployment-readback" | "verification-readback";
};

export type ProofGateLedger = {
  claim: "code-model-proof" | "runtime-proof";
  runtimeProof: boolean;
  evidence: ProofGateEvidence[];
  runtimeRequirements: string[];
  boundary: string;
};

export type WorkBomItem = {
  id: string;
  label: string;
  stage: ProductionLoopStageId;
  buildable: boolean;
};

export type RouteCatalogEntry = {
  id: string;
  label: string;
  method: string;
};

export type EnvironmentBomItem = {
  id: string;
  label: string;
  status: CompetenceMappingState;
};

export type ExplicitDependency = {
  from: ProductionLoopStageId;
  to: ProductionLoopStageId;
  reason: "stage-order";
};

export type DemandLoopProfile = {
  scopeId: DemandLoopScopeId;
  label: string;
  demand: string;
  workBom: WorkBomItem[];
  routeCatalog: RouteCatalogEntry[];
  environmentBom: EnvironmentBomItem[];
  competenceCandidate: CompetenceMappingCandidate;
  explicitDependencies: ExplicitDependency[];
};

export type StandardCandidateLearning = {
  type: "STANDARD_CANDIDATE";
  transport: "A2A";
  label: string;
  proofBoundary: string;
};

export type LearningBroadcastEnvelope = {
  transport: "A2A";
  messageType: "STANDARD_CANDIDATE";
  adoptionState: "candidate";
  sourceScopeId: DemandLoopScopeId;
  artifactId: string;
  label: string;
  proofBoundary: string;
  payload: {
    demand: string;
    stageOrder: ProductionLoopStageId[];
    candidateCount: number;
    mappedCount: number;
    debtCount: number;
    capabilityDebtIds: string[];
    extractionContracts: ExtractionContract[];
  };
};

export type AgentOfficeProductionLoopModel = {
  stages: ProductionLoopStage[];
  projectTreeRefs: ProjectTreeRef[];
  competenceRows: CompetenceMappingCandidate[];
  capabilityDebt: CapabilityDebtItem[];
  proofGate: ProofGateLedger;
  learning: StandardCandidateLearning;
};

export type ResolvedAgentOfficeProductionLoop = AgentOfficeProductionLoopModel & DemandLoopProfile;

export type CompetenceMappingSummary = {
  candidateCount: number;
  mappedCount: number;
  debtCount: number;
};

const expectedStageOrder: ProductionLoopStageId[] = [
  "demand",
  "capability",
  "workbom",
  "route",
  "project",
  "agent",
  "environment",
  "execution",
  "verification",
  "proof",
  "closeout",
  "learning",
];

const stageIndex = new Map(expectedStageOrder.map((stageId, index) => [stageId, index]));

const stageOrderDependencies: ExplicitDependency[] = expectedStageOrder
  .slice(0, -1)
  .map((stageId, index) => ({
    from: stageId,
    to: expectedStageOrder[index + 1],
    reason: "stage-order",
  }));

export const agentOfficeProductionLoop = {
  stages: [
    { id: "demand", label: "Demand", proofBoundary: "intake" },
    { id: "capability", label: "CapabilityResolution", proofBoundary: "required/provided" },
    { id: "workbom", label: "WorkBOM", proofBoundary: "scope" },
    { id: "route", label: "RouteCatalog", proofBoundary: "method" },
    { id: "project", label: "ProjectTree", proofBoundary: "start + closeout" },
    { id: "agent", label: "AgentTeamBOM", proofBoundary: "competence match" },
    { id: "environment", label: "EnvironmentBOM", proofBoundary: "repo + branch + deps" },
    { id: "execution", label: "Execution", proofBoundary: "claim-gated" },
    { id: "verification", label: "Verification", proofBoundary: "tests + visual" },
    { id: "proof", label: "ProofGate", proofBoundary: "no dry-run promotion" },
    { id: "closeout", label: "CloseoutTree", proofBoundary: "handoff" },
    { id: "learning", label: "LearningExtractor", proofBoundary: "A2A standard" },
  ],
  projectTreeRefs: [
    { ref: "CFG-010", label: "Demand + context", phase: "Start" },
    { ref: "BOM-020", label: "WorkBOM + gaps", phase: "Start" },
    { ref: "OP-030", label: "Execution path", phase: "Closeout" },
    { ref: "GATE-040", label: "Proof boundary", phase: "Closeout" },
  ],
  competenceRows: [
    {
      required: "source_code mutation",
      provided: "verified actor + WDC claim",
      state: "matched",
      source_fit_score: 0.92,
      extraction_contract: {
        source: "wdc-graph-readback",
        artifact: "actorAuthority + work claim",
        requiredEvidence: ["verified actor", "active claim", "conflicts empty"],
      },
    },
    {
      required: "visual production loop",
      provided: "AgentOfficeShell canvas",
      state: "mapped",
      source_fit_score: 0.86,
      extraction_contract: {
        source: "agent-office-static-model",
        artifact: "AgentOfficeShell",
        requiredEvidence: ["rendered loop", "ProjectTree panel", "CapabilityDebtLedger panel"],
      },
    },
    {
      required: "runtime proof",
      provided: "candidate-only UI marker",
      state: "debt",
      source_fit_score: 0.34,
      extraction_contract: {
        source: "wdc-graph-readback",
        artifact: "ProofGate",
        requiredEvidence: ["merge commit", "deploy readback", "three verification passes"],
      },
    },
  ],
  capabilityDebt: [
    {
      id: "agent-team-bom-readback",
      label: "Live AgentTeamBOM from graph",
      reason: "Required/provided competence matching is not graph-backed yet.",
    },
    {
      id: "environment-bom-readback",
      label: "EnvironmentBOM readback in UI",
      reason: "Repo, branch and dependency evidence is not rendered from WDC state yet.",
    },
    {
      id: "proof-gate-readback",
      label: "ProofGate promotion readback",
      reason: "Runtime promotion requires merge, deploy and three verification passes.",
    },
  ],
  proofGate: {
    claim: "code-model-proof",
    runtimeProof: false,
    evidence: [
      {
        id: "merged-pr",
        label: "Merged PR / code evidence",
        kind: "code",
        status: "present",
        source: "github-pr",
      },
      {
        id: "deployment-readback",
        label: "Deployment SHA readback",
        kind: "deploy",
        status: "missing",
        source: "deployment-readback",
      },
      {
        id: "verification-pass-1",
        label: "Verification pass 1",
        kind: "verification-pass",
        status: "missing",
        source: "verification-readback",
      },
      {
        id: "verification-pass-2",
        label: "Verification pass 2",
        kind: "verification-pass",
        status: "missing",
        source: "verification-readback",
      },
      {
        id: "verification-pass-3",
        label: "Verification pass 3",
        kind: "verification-pass",
        status: "missing",
        source: "verification-readback",
      },
    ],
    runtimeRequirements: ["merged code", "deployed SHA readback", "three verification passes"],
    boundary: "Candidate, projection, dry-run and read-only output is not runtime proof.",
  },
  learning: {
    type: "STANDARD_CANDIDATE",
    transport: "A2A",
    label: "Reusable Agent Office production-loop candidate",
    proofBoundary: "pending adoption until routed, reused and verified",
  },
} satisfies AgentOfficeProductionLoopModel;

export const demandLoopProfiles = {
  app: {
    scopeId: "app",
    label: "Build app",
    demand: "Convert a product demand into a governed app delivery loop.",
    workBom: [
      { id: "app-scope", label: "Scope + user flow", stage: "workbom", buildable: true },
      { id: "app-ui", label: "Chat + canvas surface", stage: "execution", buildable: true },
      {
        id: "app-proof",
        label: "Visual + build verification",
        stage: "verification",
        buildable: true,
      },
    ],
    routeCatalog: [
      { id: "app-route", label: "Frontend implementation route", method: "branch -> PR -> checks" },
    ],
    environmentBom: [
      { id: "app-repo", label: "WidgetDC-Gemini-App repo", status: "mapped" },
      { id: "app-control", label: "WDC CLI Agent Office claim", status: "matched" },
    ],
    competenceCandidate: {
      required: "app delivery demand",
      provided: "scope-specific WorkBOM + UI route",
      state: "mapped",
      source_fit_score: 0.82,
      extraction_contract: {
        source: "agent-office-static-model",
        artifact: "demandLoopProfiles.app",
        requiredEvidence: ["active scope", "WorkBOM entries", "RouteCatalog entry"],
      },
    },
    explicitDependencies: stageOrderDependencies,
  },
  book: {
    scopeId: "book",
    label: "Write book",
    demand: "Convert a writing demand into a governed book production loop.",
    workBom: [
      {
        id: "book-outline",
        label: "Synopsis + chapter outline",
        stage: "workbom",
        buildable: true,
      },
      { id: "book-research", label: "Research backlog", stage: "execution", buildable: true },
      { id: "book-closeout", label: "Draft handoff tree", stage: "closeout", buildable: true },
    ],
    routeCatalog: [
      { id: "book-route", label: "Editorial route", method: "outline -> draft -> review" },
    ],
    environmentBom: [
      { id: "book-canvas", label: "Canvas notes", status: "mapped" },
      { id: "book-sources", label: "Source evidence register", status: "debt" },
    ],
    competenceCandidate: {
      required: "book production demand",
      provided: "outline WorkBOM + editorial route",
      state: "mapped",
      source_fit_score: 0.78,
      extraction_contract: {
        source: "agent-office-static-model",
        artifact: "demandLoopProfiles.book",
        requiredEvidence: ["active scope", "chapter outline", "source backlog"],
      },
    },
    explicitDependencies: stageOrderDependencies,
  },
  investigation: {
    scopeId: "investigation",
    label: "Investigate",
    demand: "Convert an investigation demand into a governed evidence loop.",
    workBom: [
      {
        id: "investigation-hypothesis",
        label: "Hypothesis set",
        stage: "workbom",
        buildable: true,
      },
      { id: "investigation-sources", label: "Source matrix", stage: "execution", buildable: true },
      { id: "investigation-proof", label: "Evidence boundary", stage: "proof", buildable: true },
    ],
    routeCatalog: [
      {
        id: "investigation-route",
        label: "Evidence route",
        method: "hypothesis -> source -> proof",
      },
    ],
    environmentBom: [
      { id: "investigation-canvas", label: "Evidence canvas", status: "mapped" },
      { id: "investigation-chain", label: "Chain-of-custody readback", status: "debt" },
    ],
    competenceCandidate: {
      required: "investigation demand",
      provided: "hypothesis WorkBOM + evidence route",
      state: "mapped",
      source_fit_score: 0.8,
      extraction_contract: {
        source: "agent-office-static-model",
        artifact: "demandLoopProfiles.investigation",
        requiredEvidence: ["active scope", "hypothesis list", "source matrix"],
      },
    },
    explicitDependencies: stageOrderDependencies,
  },
  operate: {
    scopeId: "operate",
    label: "Operate WDC",
    demand: "Convert an operational WDC demand into a governed Agent Office loop.",
    workBom: [
      { id: "operate-boot", label: "Boot + actor authority", stage: "workbom", buildable: true },
      { id: "operate-claim", label: "Claim + conflict gate", stage: "execution", buildable: true },
      { id: "operate-proof", label: "ProofGate readback", stage: "proof", buildable: false },
    ],
    routeCatalog: [
      { id: "operate-route", label: "WDC CLI route", method: "boot -> claim -> verify -> release" },
    ],
    environmentBom: [
      { id: "operate-control", label: "WidgeTDC control repo", status: "matched" },
      { id: "operate-target", label: "Target repo branch", status: "matched" },
      { id: "operate-runtime", label: "Runtime deployment readback", status: "debt" },
    ],
    competenceCandidate: {
      required: "WDC operation demand",
      provided: "WDC CLI session + claim route",
      state: "matched",
      source_fit_score: 0.9,
      extraction_contract: {
        source: "wdc-graph-readback",
        artifact: "WDC boot session",
        requiredEvidence: ["verified actor", "boot session", "claim conflicts empty"],
      },
    },
    explicitDependencies: stageOrderDependencies,
  },
  general: {
    scopeId: "general",
    label: "Think",
    demand: "Convert an open-ended demand into a governed reasoning loop.",
    workBom: [
      { id: "general-goal", label: "Goal framing", stage: "workbom", buildable: true },
      { id: "general-options", label: "Options + tradeoffs", stage: "route", buildable: true },
      { id: "general-next", label: "Next action", stage: "closeout", buildable: true },
    ],
    routeCatalog: [
      { id: "general-route", label: "Decision route", method: "frame -> compare -> decide" },
    ],
    environmentBom: [
      { id: "general-canvas", label: "Canvas scratchpad", status: "mapped" },
      { id: "general-proof", label: "External proof readback", status: "debt" },
    ],
    competenceCandidate: {
      required: "general reasoning demand",
      provided: "decision WorkBOM + canvas route",
      state: "mapped",
      source_fit_score: 0.74,
      extraction_contract: {
        source: "agent-office-static-model",
        artifact: "demandLoopProfiles.general",
        requiredEvidence: ["active scope", "goal frame", "next action"],
      },
    },
    explicitDependencies: stageOrderDependencies,
  },
} satisfies Record<DemandLoopScopeId, DemandLoopProfile>;

export function resolveAgentOfficeProductionLoop(
  scopeId: DemandLoopScopeId,
): ResolvedAgentOfficeProductionLoop {
  const profile = demandLoopProfiles[scopeId];
  return {
    ...agentOfficeProductionLoop,
    ...profile,
    competenceRows: [...agentOfficeProductionLoop.competenceRows, profile.competenceCandidate],
  };
}

export function createLearningBroadcastEnvelope(
  model: ResolvedAgentOfficeProductionLoop,
): LearningBroadcastEnvelope {
  const summary = summarizeCompetenceMapping(model.competenceRows);
  return {
    transport: model.learning.transport,
    messageType: model.learning.type,
    adoptionState: "candidate",
    sourceScopeId: model.scopeId,
    artifactId: `agent-office-production-loop:${model.scopeId}`,
    label: model.learning.label,
    proofBoundary: model.learning.proofBoundary,
    payload: {
      demand: model.demand,
      stageOrder: model.stages.map((stage) => stage.id),
      candidateCount: summary.candidateCount,
      mappedCount: summary.mappedCount,
      debtCount: summary.debtCount,
      capabilityDebtIds: model.capabilityDebt.map((item) => item.id),
      extractionContracts: model.competenceRows.map((candidate) => candidate.extraction_contract),
    },
  };
}

export function getProductionStage(
  model: AgentOfficeProductionLoopModel,
  stageId: ProductionLoopStageId,
) {
  return model.stages.find((stage) => stage.id === stageId) ?? model.stages[0];
}

export function summarizeCompetenceMapping(
  candidates: CompetenceMappingCandidate[],
): CompetenceMappingSummary {
  return {
    candidateCount: candidates.length,
    mappedCount: candidates.filter((candidate) => candidate.state !== "debt").length,
    debtCount: candidates.filter((candidate) => candidate.state === "debt").length,
  };
}

export function summarizeProofGate(ledger: ProofGateLedger) {
  const presentCount = ledger.evidence.filter((item) => item.status === "present").length;
  const missingCount = ledger.evidence.length - presentCount;
  return {
    claim: ledger.claim,
    runtimeProof: ledger.runtimeProof,
    presentCount,
    missingCount,
    requiredPasses: ledger.evidence.filter((item) => item.kind === "verification-pass").length,
    passedVerifications: ledger.evidence.filter(
      (item) => item.kind === "verification-pass" && item.status === "present",
    ).length,
  };
}

export function validateProductionLoopModel(model: AgentOfficeProductionLoopModel) {
  const failures: string[] = [];
  const stageOrder = model.stages.map((stage) => stage.id);
  if (stageOrder.join(">") !== expectedStageOrder.join(">")) {
    failures.push("production loop stage order changed");
  }
  if (!model.projectTreeRefs.some((ref) => ref.phase === "Start")) {
    failures.push("ProjectTree is missing Start refs");
  }
  if (!model.projectTreeRefs.some((ref) => ref.phase === "Closeout")) {
    failures.push("ProjectTree is missing Closeout refs");
  }
  for (const candidate of model.competenceRows) {
    if (candidate.source_fit_score < 0 || candidate.source_fit_score > 1) {
      failures.push(`${candidate.required} has invalid source_fit_score`);
    }
    if (!candidate.extraction_contract.requiredEvidence.length) {
      failures.push(`${candidate.required} is missing extraction evidence contract`);
    }
  }
  if (model.learning.transport !== "A2A" || model.learning.type !== "STANDARD_CANDIDATE") {
    failures.push("LearningExtractor must broadcast an A2A STANDARD_CANDIDATE");
  }
  const proofSummary = summarizeProofGate(model.proofGate);
  if (model.proofGate.runtimeProof) {
    const hasDeployment = model.proofGate.evidence.some(
      (item) => item.kind === "deploy" && item.status === "present",
    );
    if (!hasDeployment || proofSummary.passedVerifications < 3) {
      failures.push("runtime proof requires deployment readback and three verification passes");
    }
  }
  if (!model.proofGate.boundary.includes("not runtime proof")) {
    failures.push("ProofGate boundary must reject candidate/projection/dry-run runtime proof");
  }
  if ("explicitDependencies" in model) {
    for (const dependency of model.explicitDependencies as ExplicitDependency[]) {
      const fromIndex = stageIndex.get(dependency.from);
      const toIndex = stageIndex.get(dependency.to);
      if (dependency.reason !== "stage-order" || toIndex !== (fromIndex ?? -2) + 1) {
        failures.push(`invalid explicit dependency ${dependency.from}->${dependency.to}`);
      }
    }
  }
  return { ok: failures.length === 0, failures };
}

export function validateLearningBroadcastEnvelope(envelope: LearningBroadcastEnvelope) {
  const failures: string[] = [];
  if (envelope.transport !== "A2A" || envelope.messageType !== "STANDARD_CANDIDATE") {
    failures.push("Learning envelope must use A2A STANDARD_CANDIDATE");
  }
  if (envelope.adoptionState !== "candidate") {
    failures.push("Learning envelope must remain candidate until adopted and verified");
  }
  if (envelope.payload.candidateCount < envelope.payload.mappedCount) {
    failures.push("Learning envelope mapped count cannot exceed candidate count");
  }
  if (!envelope.payload.extractionContracts.length) {
    failures.push("Learning envelope must include extraction contracts");
  }
  if (!envelope.payload.capabilityDebtIds.length) {
    failures.push("Learning envelope must carry CapabilityDebtLedger ids");
  }
  if (envelope.proofBoundary.toLowerCase().includes("runtime proof")) {
    failures.push("Learning envelope must not claim runtime proof");
  }
  return { ok: failures.length === 0, failures };
}
