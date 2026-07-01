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

export type ProjectTreePhase = "Start" | "Closeout";

export type CompetenceMappingState = "matched" | "mapped" | "debt";

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

export type StandardCandidateLearning = {
  type: "STANDARD_CANDIDATE";
  transport: "A2A";
  label: string;
  proofBoundary: string;
};

export type AgentOfficeProductionLoopModel = {
  stages: ProductionLoopStage[];
  projectTreeRefs: ProjectTreeRef[];
  competenceRows: CompetenceMappingCandidate[];
  capabilityDebt: CapabilityDebtItem[];
  learning: StandardCandidateLearning;
};

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
  learning: {
    type: "STANDARD_CANDIDATE",
    transport: "A2A",
    label: "Reusable Agent Office production-loop candidate",
    proofBoundary: "pending adoption until routed, reused and verified",
  },
} satisfies AgentOfficeProductionLoopModel;

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
  return { ok: failures.length === 0, failures };
}
