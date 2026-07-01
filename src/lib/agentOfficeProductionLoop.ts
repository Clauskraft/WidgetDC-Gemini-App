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

export type OperationalLedgerStatus = "modelled" | "requires-readback";

export type AgentTeamBomMember = {
  id: string;
  label: string;
  required: string;
  provided: string;
  status: CompetenceMappingState;
  source_fit_score: number;
  extraction_contract: ExtractionContract;
};

export type ExecutionLedgerItem = {
  id: string;
  label: string;
  stage: ProductionLoopStageId;
  claimRequired: boolean;
  status: OperationalLedgerStatus;
  proofBoundary: string;
};

export type VerificationLedgerItem = {
  id: string;
  label: string;
  kind: "unit" | "lint" | "visual" | "build" | "runtime";
  status: OperationalLedgerStatus;
  runtimeProof: false;
  proofBoundary: string;
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

export type EnvironmentBomCategory = "repo" | "branch" | "dependency" | "runtime" | "evidence";

export type EnvironmentBomItem = {
  id: string;
  label: string;
  category: EnvironmentBomCategory;
  status: CompetenceMappingState;
  extraction_contract: ExtractionContract;
  proofBoundary: string;
};

export type CloseoutTreeItem = {
  id: string;
  label: string;
  handoff: "release" | "a2a" | "adoption-followup";
  status: OperationalLedgerStatus;
  requiredEvidence: string[];
  proofBoundary: string;
};

export type ProductionLoopCoverageRequirementId =
  | "stage-order"
  | "required-provided-primary"
  | "explicit-dependencies-stage-order"
  | "candidate-mapped-count-separation"
  | "source-fit-extraction-contracts"
  | "capability-debt-ledger"
  | "project-tree-start-closeout"
  | "runtime-proof-boundary"
  | "a2a-standard-candidate"
  | "dirty-claimed-scope-handoff";

export type ProductionLoopCoverageItem = {
  id: ProductionLoopCoverageRequirementId;
  label: string;
  status: "covered" | "debt";
  evidence: string[];
  proofBoundary: string;
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
    agentTeamBomCount: number;
    environmentBomCount: number;
    executionLedgerCount: number;
    verificationLedgerCount: number;
    closeoutTreeCount: number;
    coverageRequirementCount: number;
    coverageDebtCount: number;
    capabilityDebtIds: string[];
    extractionContracts: ExtractionContract[];
  };
};

export type AgentOfficeProductionLoopModel = {
  stages: ProductionLoopStage[];
  projectTreeRefs: ProjectTreeRef[];
  competenceRows: CompetenceMappingCandidate[];
  capabilityDebt: CapabilityDebtItem[];
  agentTeamBom: AgentTeamBomMember[];
  closeoutTree: CloseoutTreeItem[];
  executionLedger: ExecutionLedgerItem[];
  verificationLedger: VerificationLedgerItem[];
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
  agentTeamBom: [
    {
      id: "codex-operator",
      label: "Codex implementation lane",
      required: "source_code mutation",
      provided: "verified actor + scoped WDC claim",
      status: "matched",
      source_fit_score: 0.9,
      extraction_contract: {
        source: "wdc-graph-readback",
        artifact: "actorAuthority + work claim",
        requiredEvidence: ["verified actor", "active WDC session", "conflicts empty"],
      },
    },
    {
      id: "wdc-cli-governor",
      label: "WDC CLI governance lane",
      required: "boot/session/claim gates",
      provided: "WDC Agent Office boot sequence",
      status: "matched",
      source_fit_score: 0.88,
      extraction_contract: {
        source: "wdc-graph-readback",
        artifact: "boot session + work claim",
        requiredEvidence: ["boot ok", "claim ok", "session release"],
      },
    },
    {
      id: "runtime-verifier",
      label: "Runtime verification lane",
      required: "deployment readback + three passes",
      provided: "ProofGate debt marker",
      status: "debt",
      source_fit_score: 0.42,
      extraction_contract: {
        source: "wdc-graph-readback",
        artifact: "ProofGate runtime evidence",
        requiredEvidence: [
          "deployed SHA",
          "verification pass 1",
          "verification pass 2",
          "verification pass 3",
        ],
      },
    },
  ],
  executionLedger: [
    {
      id: "branch-session",
      label: "Branch + WDC session lease",
      stage: "execution",
      claimRequired: true,
      status: "modelled",
      proofBoundary: "Execution starts only after a clean branch and active session.",
    },
    {
      id: "claim-conflict-gate",
      label: "Claim + conflict gate",
      stage: "execution",
      claimRequired: true,
      status: "modelled",
      proofBoundary: "Dirty or claimed scopes require A2A/handoff before edits.",
    },
    {
      id: "closeout-release",
      label: "Release + closeout handoff",
      stage: "closeout",
      claimRequired: false,
      status: "requires-readback",
      proofBoundary: "Closeout is not runtime proof without deployment and verification readback.",
    },
  ],
  verificationLedger: [
    {
      id: "unit-contract",
      label: "Production-loop unit contract",
      kind: "unit",
      status: "modelled",
      runtimeProof: false,
      proofBoundary: "Unit tests are code/model proof, not runtime proof.",
    },
    {
      id: "lint-contract",
      label: "Scoped lint contract",
      kind: "lint",
      status: "modelled",
      runtimeProof: false,
      proofBoundary: "Lint proves static conformance only.",
    },
    {
      id: "visual-readback",
      label: "Desktop/mobile visual readback",
      kind: "visual",
      status: "modelled",
      runtimeProof: false,
      proofBoundary: "Rendered local UI readback is not deployed runtime proof.",
    },
    {
      id: "production-build",
      label: "Production build contract",
      kind: "build",
      status: "modelled",
      runtimeProof: false,
      proofBoundary: "A build artifact is not runtime proof without deployment SHA readback.",
    },
    {
      id: "runtime-pass-chain",
      label: "Three runtime verification passes",
      kind: "runtime",
      status: "requires-readback",
      runtimeProof: false,
      proofBoundary:
        "Runtime proof requires deploy readback plus three consecutive verification passes.",
    },
  ],
  closeoutTree: [
    {
      id: "release-claims",
      label: "Release WDC claim and session",
      handoff: "release",
      status: "requires-readback",
      requiredEvidence: ["work release ok", "session release ok"],
      proofBoundary: "Released claims close the edit scope but do not prove runtime behavior.",
    },
    {
      id: "standard-candidate-broadcast",
      label: "Broadcast reusable learning",
      handoff: "a2a",
      status: "requires-readback",
      requiredEvidence: ["A2A STANDARD_CANDIDATE id", "inbox readback"],
      proofBoundary: "A2A candidate broadcast is reusable learning, not adopted runtime proof.",
    },
    {
      id: "adoption-followup",
      label: "Track adoption follow-up",
      handoff: "adoption-followup",
      status: "requires-readback",
      requiredEvidence: ["reuse route", "adoption record", "verification readback"],
      proofBoundary: "Learning remains candidate until reused, adopted and verified.",
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
      {
        id: "app-repo",
        label: "WidgetDC-Gemini-App repo",
        category: "repo",
        status: "mapped",
        extraction_contract: {
          source: "agent-office-static-model",
          artifact: "demandLoopProfiles.app.environmentBom",
          requiredEvidence: ["target repo", "branch", "PR route"],
        },
        proofBoundary: "Repo evidence makes the app buildable, not runtime-proven.",
      },
      {
        id: "app-control",
        label: "WDC CLI Agent Office claim",
        category: "branch",
        status: "matched",
        extraction_contract: {
          source: "wdc-graph-readback",
          artifact: "WDC work claim",
          requiredEvidence: ["active claim", "conflicts empty", "release readback"],
        },
        proofBoundary: "A clean claim authorizes edits but does not prove deployment.",
      },
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
      {
        id: "book-canvas",
        label: "Canvas notes",
        category: "evidence",
        status: "mapped",
        extraction_contract: {
          source: "agent-office-static-model",
          artifact: "demandLoopProfiles.book.environmentBom",
          requiredEvidence: ["canvas notes", "outline state"],
        },
        proofBoundary: "Book canvas evidence is planning proof, not publication proof.",
      },
      {
        id: "book-sources",
        label: "Source evidence register",
        category: "evidence",
        status: "debt",
        extraction_contract: {
          source: "agent-office-static-model",
          artifact: "demandLoopProfiles.book.environmentBom",
          requiredEvidence: ["source list", "citation state", "review readback"],
        },
        proofBoundary: "Missing sources remain CapabilityDebtLedger input.",
      },
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
      {
        id: "investigation-canvas",
        label: "Evidence canvas",
        category: "evidence",
        status: "mapped",
        extraction_contract: {
          source: "agent-office-static-model",
          artifact: "demandLoopProfiles.investigation.environmentBom",
          requiredEvidence: ["hypothesis set", "source matrix"],
        },
        proofBoundary: "Evidence canvas is investigative structure, not factual proof by itself.",
      },
      {
        id: "investigation-chain",
        label: "Chain-of-custody readback",
        category: "evidence",
        status: "debt",
        extraction_contract: {
          source: "agent-office-static-model",
          artifact: "demandLoopProfiles.investigation.environmentBom",
          requiredEvidence: ["source provenance", "timestamped custody", "reviewer readback"],
        },
        proofBoundary: "Chain-of-custody debt blocks proof promotion.",
      },
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
      {
        id: "operate-control",
        label: "WidgeTDC control repo",
        category: "repo",
        status: "matched",
        extraction_contract: {
          source: "wdc-graph-readback",
          artifact: "WDC control repo bootstrap",
          requiredEvidence: ["control repo", "preflight ok"],
        },
        proofBoundary: "Control repo readiness is an execution precondition only.",
      },
      {
        id: "operate-target",
        label: "Target repo branch",
        category: "branch",
        status: "matched",
        extraction_contract: {
          source: "wdc-graph-readback",
          artifact: "target repo bootstrap",
          requiredEvidence: ["target branch", "upstream", "clean worktree"],
        },
        proofBoundary: "A clean branch is buildable state, not deployed runtime proof.",
      },
      {
        id: "operate-runtime",
        label: "Runtime deployment readback",
        category: "runtime",
        status: "debt",
        extraction_contract: {
          source: "wdc-graph-readback",
          artifact: "runtime deployment readback",
          requiredEvidence: ["deployed SHA", "runtime URL", "three verification passes"],
        },
        proofBoundary: "Runtime environment remains debt until deploy and verification readback.",
      },
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
      {
        id: "general-canvas",
        label: "Canvas scratchpad",
        category: "evidence",
        status: "mapped",
        extraction_contract: {
          source: "agent-office-static-model",
          artifact: "demandLoopProfiles.general.environmentBom",
          requiredEvidence: ["goal frame", "options", "next action"],
        },
        proofBoundary: "Canvas reasoning is decision support, not external proof.",
      },
      {
        id: "general-proof",
        label: "External proof readback",
        category: "runtime",
        status: "debt",
        extraction_contract: {
          source: "agent-office-static-model",
          artifact: "demandLoopProfiles.general.environmentBom",
          requiredEvidence: ["external source", "readback", "verification state"],
        },
        proofBoundary: "External proof debt must remain visible before promotion.",
      },
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
  const coverage = buildProductionLoopCoverageMatrix(model);
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
      agentTeamBomCount: model.agentTeamBom.length,
      environmentBomCount: model.environmentBom.length,
      executionLedgerCount: model.executionLedger.length,
      verificationLedgerCount: model.verificationLedger.length,
      closeoutTreeCount: model.closeoutTree.length,
      coverageRequirementCount: coverage.length,
      coverageDebtCount: coverage.filter((item) => item.status === "debt").length,
      capabilityDebtIds: model.capabilityDebt.map((item) => item.id),
      extractionContracts: [
        ...model.competenceRows.map((candidate) => candidate.extraction_contract),
        ...model.agentTeamBom.map((member) => member.extraction_contract),
        ...model.environmentBom.map((item) => item.extraction_contract),
      ],
    },
  };
}

export function buildProductionLoopCoverageMatrix(
  model: AgentOfficeProductionLoopModel & Partial<DemandLoopProfile>,
): ProductionLoopCoverageItem[] {
  const competenceSummary = summarizeCompetenceMapping(model.competenceRows);
  const operationalSummary = summarizeOperationalLedgers(model);
  const stageOrder = model.stages.map((stage) => stage.id);
  const explicitDependencies = model.explicitDependencies ?? [];
  const environmentBom = model.environmentBom ?? [];
  const coverage = (item: Omit<ProductionLoopCoverageItem, "status">, ok: boolean) =>
    ({
      ...item,
      status: ok ? "covered" : "debt",
    }) satisfies ProductionLoopCoverageItem;

  return [
    coverage(
      {
        id: "stage-order",
        label: "Demand -> LearningExtractor stage order",
        evidence: model.stages.map((stage) => stage.label),
        proofBoundary: "Stage order is model proof, not runtime proof.",
      },
      stageOrder.join(">") === expectedStageOrder.join(">"),
    ),
    coverage(
      {
        id: "required-provided-primary",
        label: "Required/provided competence matching",
        evidence: model.competenceRows.map((row) => `${row.required} -> ${row.provided}`),
        proofBoundary: "Competence matching precedes dependency ordering.",
      },
      model.competenceRows.length > 0 &&
        model.competenceRows.every((row) => row.required && row.provided),
    ),
    coverage(
      {
        id: "explicit-dependencies-stage-order",
        label: "Explicit dependencies only order stages",
        evidence: explicitDependencies.map((item) => `${item.from}->${item.to}`),
        proofBoundary: "Dependencies are ordering hints only.",
      },
      explicitDependencies.every((item) => item.reason === "stage-order"),
    ),
    coverage(
      {
        id: "candidate-mapped-count-separation",
        label: "Candidate count separate from mapped count",
        evidence: [
          `candidate=${competenceSummary.candidateCount}`,
          `mapped=${competenceSummary.mappedCount}`,
          `debt=${competenceSummary.debtCount}`,
        ],
        proofBoundary: "Candidate count must not be read as mapped count.",
      },
      competenceSummary.candidateCount >= competenceSummary.mappedCount,
    ),
    coverage(
      {
        id: "source-fit-extraction-contracts",
        label: "source_fit_score + extraction_contract",
        evidence: [
          ...model.competenceRows.map((row) => row.extraction_contract.artifact),
          ...model.agentTeamBom.map((member) => member.extraction_contract.artifact),
          ...environmentBom.map((item) => item.extraction_contract.artifact),
        ],
        proofBoundary: "Extraction contracts define evidence requirements, not proof promotion.",
      },
      [...model.competenceRows, ...model.agentTeamBom].every(
        (item) =>
          item.source_fit_score >= 0 &&
          item.source_fit_score <= 1 &&
          item.extraction_contract.requiredEvidence.length > 0,
      ) && environmentBom.every((item) => item.extraction_contract.requiredEvidence.length > 0),
    ),
    coverage(
      {
        id: "capability-debt-ledger",
        label: "CapabilityDebtLedger for missing pieces",
        evidence: model.capabilityDebt.map((item) => item.id),
        proofBoundary: "Debt remains explicit until evidence closes it.",
      },
      model.capabilityDebt.length > 0 || operationalSummary.environmentDebtCount > 0,
    ),
    coverage(
      {
        id: "project-tree-start-closeout",
        label: "ProjectTree start + closeout",
        evidence: model.projectTreeRefs.map((item) => `${item.phase}:${item.ref}`),
        proofBoundary: "ProjectTree visibility is planning/readback proof only.",
      },
      model.projectTreeRefs.some((item) => item.phase === "Start") &&
        model.projectTreeRefs.some((item) => item.phase === "Closeout"),
    ),
    coverage(
      {
        id: "runtime-proof-boundary",
        label: "No candidate/dry-run/read-only runtime proof",
        evidence: [
          model.proofGate.boundary,
          ...model.verificationLedger.map((item) => item.proofBoundary),
        ],
        proofBoundary: "Runtime proof requires deploy readback plus three verification passes.",
      },
      !model.proofGate.runtimeProof && operationalSummary.runtimeProofClaims === 0,
    ),
    coverage(
      {
        id: "a2a-standard-candidate",
        label: "Reusable learning via A2A STANDARD_CANDIDATE",
        evidence: [`${model.learning.transport}:${model.learning.type}`],
        proofBoundary: "A2A broadcast is candidate learning until adopted and verified.",
      },
      model.learning.transport === "A2A" && model.learning.type === "STANDARD_CANDIDATE",
    ),
    coverage(
      {
        id: "dirty-claimed-scope-handoff",
        label: "Dirty/claimed scopes require handoff",
        evidence: model.executionLedger.map((item) => item.proofBoundary),
        proofBoundary: "Claim-gated execution prevents uncoordinated source edits.",
      },
      model.executionLedger.some((item) =>
        item.proofBoundary.toLowerCase().includes("claimed scopes"),
      ),
    ),
  ];
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

export function summarizeOperationalLedgers(
  model: AgentOfficeProductionLoopModel & Partial<Pick<DemandLoopProfile, "environmentBom">>,
) {
  const environmentBom = model.environmentBom ?? [];
  return {
    agentTeamBomCount: model.agentTeamBom.length,
    environmentBomCount: environmentBom.length,
    executionLedgerCount: model.executionLedger.length,
    verificationLedgerCount: model.verificationLedger.length,
    closeoutTreeCount: model.closeoutTree.length,
    claimGatedExecutionCount: model.executionLedger.filter((item) => item.claimRequired).length,
    environmentDebtCount: environmentBom.filter((item) => item.status === "debt").length,
    runtimeProofClaims: model.verificationLedger.filter((item) => item.runtimeProof).length,
  };
}

export function validateProductionLoopModel(
  model: AgentOfficeProductionLoopModel & Partial<Pick<DemandLoopProfile, "environmentBom">>,
) {
  const failures: string[] = [];
  const environmentBom = model.environmentBom ?? [];
  const coverageMatrix = buildProductionLoopCoverageMatrix(model);
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
  if (!model.agentTeamBom.length) {
    failures.push("AgentTeamBOM is missing");
  }
  for (const member of model.agentTeamBom) {
    if (member.source_fit_score < 0 || member.source_fit_score > 1) {
      failures.push(`${member.id} has invalid AgentTeamBOM source_fit_score`);
    }
    if (
      !member.extraction_contract.artifact ||
      !member.extraction_contract.requiredEvidence.length
    ) {
      failures.push(`${member.id} is missing AgentTeamBOM extraction evidence contract`);
    }
  }
  for (const item of environmentBom) {
    if (!item.extraction_contract.artifact || !item.extraction_contract.requiredEvidence.length) {
      failures.push(`${item.id} is missing EnvironmentBOM extraction evidence contract`);
    }
    if (!item.proofBoundary.trim()) {
      failures.push(`${item.id} is missing EnvironmentBOM proof boundary`);
    }
  }
  const operationalSummary = summarizeOperationalLedgers(model);
  if (!model.closeoutTree.some((item) => item.handoff === "release")) {
    failures.push("CloseoutTree must include WDC release handoff");
  }
  if (!model.closeoutTree.some((item) => item.handoff === "a2a")) {
    failures.push("CloseoutTree must include A2A learning handoff");
  }
  for (const item of model.closeoutTree) {
    if (!item.requiredEvidence.length) {
      failures.push(`${item.id} is missing CloseoutTree evidence`);
    }
    const proofBoundary = item.proofBoundary.toLowerCase();
    if (proofBoundary.includes("runtime proof") && !proofBoundary.includes("not")) {
      failures.push(`${item.id} CloseoutTree must not claim runtime proof`);
    }
  }
  if (operationalSummary.claimGatedExecutionCount === 0) {
    failures.push("ExecutionLedger must include a claim-gated step");
  }
  if (
    !model.executionLedger.some((item) =>
      item.proofBoundary.toLowerCase().includes("claimed scopes"),
    )
  ) {
    failures.push("ExecutionLedger must preserve dirty/claimed scope handoff boundary");
  }
  if (operationalSummary.runtimeProofClaims > 0) {
    failures.push("VerificationLedger cannot claim runtime proof");
  }
  if (!model.verificationLedger.some((item) => item.kind === "visual")) {
    failures.push("VerificationLedger must include visual readback");
  }
  if (!model.verificationLedger.some((item) => item.kind === "build")) {
    failures.push("VerificationLedger must include build verification");
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
  for (const item of coverageMatrix) {
    if (item.status === "debt") {
      failures.push(`coverage debt: ${item.id}`);
    }
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
