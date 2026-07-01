import {
  buildBuildabilityLedger,
  buildEvidenceContractLedger,
  buildMappingCandidateLedger,
  buildProofAdoptionLadder,
  buildProductionLoopCoverageMatrix,
  createLearningBroadcastEnvelope,
  summarizeCompetenceMapping,
  summarizeOperationalLedgers,
  summarizeProofGate,
  type ResolvedAgentOfficeProductionLoop,
} from "@/lib/agentOfficeProductionLoop";

export type WDCObjectCardKind =
  | "ProjectTreeCard"
  | "WorkBOMCard"
  | "RouteCard"
  | "CapabilityGapCard"
  | "AgentTeamCard"
  | "ProofGateCard"
  | "A2ACard"
  | "EvidenceCard"
  | "SessionCard"
  | "NextActionCard";

export type WDCObjectCardTone = "neutral" | "ok" | "warning" | "danger" | "info";

export type WDCObjectCardMetric = {
  label: string;
  value: string | number;
  tone?: WDCObjectCardTone;
};

export type WDCObjectCardItem = {
  label: string;
  meta: string;
  state?: string;
};

export type WDCObjectCardModel = {
  id: string;
  kind: WDCObjectCardKind;
  eyebrow: string;
  title: string;
  summary: string;
  status: string;
  tone: WDCObjectCardTone;
  proofBoundary: string;
  metrics: WDCObjectCardMetric[];
  items: WDCObjectCardItem[];
  detailsLabel: string;
};

function countBy<T>(items: T[], predicate: (item: T) => boolean): number {
  return items.filter(predicate).length;
}

export function buildWDCObjectCards(
  model: ResolvedAgentOfficeProductionLoop,
): WDCObjectCardModel[] {
  const competenceSummary = summarizeCompetenceMapping(model.competenceRows);
  const operationalSummary = summarizeOperationalLedgers(model);
  const proofSummary = summarizeProofGate(model.proofGate);
  const learningEnvelope = createLearningBroadcastEnvelope(model);
  const buildabilityLedger = buildBuildabilityLedger(model);
  const evidenceContractLedger = buildEvidenceContractLedger(model);
  const mappingCandidateLedger = buildMappingCandidateLedger(model);
  const coverageMatrix = buildProductionLoopCoverageMatrix(model);
  const proofAdoptionLadder = buildProofAdoptionLadder(model);
  const buildableWorkBomCount = countBy(model.workBom, (item) => item.buildable);
  const blockedBuildabilityCount = countBy(buildabilityLedger, (item) => item.status === "blocked");
  const mappedEdgeCount = countBy(mappingCandidateLedger, (item) => item.state === "mapped");
  const coverageDebtCount = countBy(coverageMatrix, (item) => item.status === "debt");
  const proofAdoptionBlockedCount = countBy(
    proofAdoptionLadder,
    (item) => item.status === "blocked",
  );
  const stopConditionCount = model.stopConditions.length;

  return [
    {
      id: "project-tree",
      kind: "ProjectTreeCard",
      eyebrow: "ProjectTree",
      title: "Start + closeout refs",
      summary: "ProjectTree is visible at activity start and closeout without claiming proof.",
      status: "candidate readback",
      tone: "info",
      proofBoundary: "ProjectTree visibility is planning/readback proof only.",
      metrics: [
        {
          label: "Start refs",
          value: countBy(model.projectTreeRefs, (item) => item.phase === "Start"),
        },
        {
          label: "Closeout refs",
          value: countBy(model.projectTreeRefs, (item) => item.phase === "Closeout"),
        },
      ],
      items: model.projectTreeRefs.map((item) => ({
        label: item.ref,
        meta: item.label,
        state: item.phase,
      })),
      detailsLabel: "Show ProjectTree refs",
    },
    {
      id: "work-bom",
      kind: "WorkBOMCard",
      eyebrow: "WorkBOM",
      title: "Buildable work scope",
      summary: "Work items are implementation readiness, not runtime proof.",
      status: blockedBuildabilityCount === 0 ? "ready" : "blocked items",
      tone: blockedBuildabilityCount === 0 ? "ok" : "warning",
      proofBoundary: "Buildable WorkBOM items are readiness evidence only.",
      metrics: [
        { label: "Work items", value: model.workBom.length },
        { label: "Buildable", value: buildableWorkBomCount, tone: "ok" },
        {
          label: "Blocked",
          value: blockedBuildabilityCount,
          tone: blockedBuildabilityCount ? "warning" : "ok",
        },
      ],
      items: model.workBom.map((item) => ({
        label: item.label,
        meta: item.stage,
        state: item.buildable ? "buildable" : "blocked",
      })),
      detailsLabel: "Show WorkBOM items",
    },
    {
      id: "route",
      kind: "RouteCard",
      eyebrow: "RouteCatalog",
      title: "Execution route",
      summary: "Routes select method and lane; they do not prove execution.",
      status: "method selected",
      tone: "info",
      proofBoundary: "RouteCatalog selects execution method; it does not prove execution.",
      metrics: [
        { label: "Routes", value: model.routeCatalog.length },
        { label: "Mapped edges", value: mappedEdgeCount },
        { label: "Candidates", value: mappingCandidateLedger.length },
      ],
      items: model.routeCatalog.map((item) => ({
        label: item.label,
        meta: item.method,
        state: "route",
      })),
      detailsLabel: "Show route details",
    },
    {
      id: "capability-gaps",
      kind: "CapabilityGapCard",
      eyebrow: "Capability gaps",
      title: "Debt stays explicit",
      summary: "Missing readbacks remain visible as CapabilityDebtLedger items before promotion.",
      status: model.capabilityDebt.length ? "debt present" : "no debt",
      tone: model.capabilityDebt.length ? "warning" : "ok",
      proofBoundary: "Capability debt remains non-proof until required evidence closes it.",
      metrics: [
        {
          label: "Debt items",
          value: model.capabilityDebt.length,
          tone: model.capabilityDebt.length ? "warning" : "ok",
        },
        {
          label: "Coverage debt",
          value: coverageDebtCount,
          tone: coverageDebtCount ? "warning" : "ok",
        },
      ],
      items: model.capabilityDebt.map((item) => ({
        label: item.label,
        meta: item.reason,
        state: "debt",
      })),
      detailsLabel: "Show debt ledger",
    },
    {
      id: "agent-team",
      kind: "AgentTeamCard",
      eyebrow: "AgentTeamBOM",
      title: "Required / provided lanes",
      summary: "Competence matching remains primary; dependencies only order stages.",
      status: "competence mapped",
      tone: "info",
      proofBoundary: "AgentTeamBOM is competence planning evidence, not runtime proof.",
      metrics: [
        { label: "Candidates", value: competenceSummary.candidateCount },
        { label: "Mapped", value: competenceSummary.mappedCount, tone: "ok" },
        {
          label: "Debt",
          value: competenceSummary.debtCount,
          tone: competenceSummary.debtCount ? "warning" : "ok",
        },
      ],
      items: model.agentTeamBom.map((member) => ({
        label: member.required,
        meta: member.provided,
        state: member.status,
      })),
      detailsLabel: "Show AgentTeamBOM",
    },
    {
      id: "proof-gate",
      kind: "ProofGateCard",
      eyebrow: "ProofGate",
      title: "Runtime proof blocked",
      summary: "Code/model evidence is present, but deploy readback and three passes are missing.",
      status: model.proofGate.runtimeProof ? "runtime proof" : "not runtime proof",
      tone: model.proofGate.runtimeProof ? "ok" : "danger",
      proofBoundary: model.proofGate.boundary,
      metrics: [
        {
          label: "Evidence",
          value: `${proofSummary.presentCount}/${proofSummary.presentCount + proofSummary.missingCount}`,
        },
        {
          label: "Passes",
          value: `${proofSummary.passedVerifications}/${proofSummary.requiredPasses}`,
        },
        {
          label: "Blocked",
          value: proofAdoptionBlockedCount,
          tone: proofAdoptionBlockedCount ? "danger" : "ok",
        },
      ],
      items: model.proofGate.evidence.map((item) => ({
        label: item.label,
        meta: item.source,
        state: item.status,
      })),
      detailsLabel: "Show proof evidence",
    },
    {
      id: "a2a",
      kind: "A2ACard",
      eyebrow: "A2A",
      title: "Reusable learning candidate",
      summary: "Closeout learning is broadcast as STANDARD_CANDIDATE until adoption is verified.",
      status: learningEnvelope.adoptionState,
      tone: "warning",
      proofBoundary: learningEnvelope.proofBoundary,
      metrics: [
        { label: "Transport", value: learningEnvelope.transport },
        { label: "Type", value: learningEnvelope.messageType },
        { label: "Closeout", value: operationalSummary.closeoutTreeCount },
      ],
      items: model.closeoutTree.map((item) => ({
        label: item.label,
        meta: item.requiredEvidence.join(", "),
        state: item.handoff,
      })),
      detailsLabel: "Show closeout handoff",
    },
    {
      id: "evidence",
      kind: "EvidenceCard",
      eyebrow: "Evidence contracts",
      title: "Fit score + extraction",
      summary: "Every mapping keeps source_fit_score and extraction_contract visible.",
      status: "contracted",
      tone: "info",
      proofBoundary: "Extraction contracts define evidence requirements, not proof promotion.",
      metrics: [
        { label: "Contracts", value: evidenceContractLedger.length },
        {
          label: "Incomplete",
          value: countBy(evidenceContractLedger, (item) => item.status === "incomplete"),
          tone: countBy(evidenceContractLedger, (item) => item.status === "incomplete")
            ? "warning"
            : "ok",
        },
      ],
      items: evidenceContractLedger.map((item) => ({
        label: item.label,
        meta:
          item.source_fit_score === null
            ? item.contractArtifact
            : `${item.contractArtifact} · ${item.source_fit_score.toFixed(2)}`,
        state: item.status,
      })),
      detailsLabel: "Show evidence contracts",
    },
    {
      id: "session",
      kind: "SessionCard",
      eyebrow: "Session",
      title: "Claim-gated execution",
      summary: "Source mutation requires a clean branch, active claim and empty conflicts.",
      status: "claim gated",
      tone: "ok",
      proofBoundary: "Released claims close edit scope but do not prove runtime behavior.",
      metrics: [
        { label: "Execution", value: operationalSummary.executionLedgerCount },
        { label: "Claim gated", value: operationalSummary.claimGatedExecutionCount },
        { label: "Verification", value: operationalSummary.verificationLedgerCount },
      ],
      items: model.executionLedger.map((item) => ({
        label: item.label,
        meta: item.proofBoundary,
        state: item.claimRequired ? "claim" : item.status,
      })),
      detailsLabel: "Show execution ledger",
    },
    {
      id: "next-action",
      kind: "NextActionCard",
      eyebrow: "Next action",
      title: "Promotion blockers",
      summary: "Blocked states explain exact next action before any proof upgrade.",
      status: stopConditionCount ? "blocked" : "clear",
      tone: stopConditionCount ? "warning" : "ok",
      proofBoundary: "Stop conditions are proof-ineligible until their next actions are satisfied.",
      metrics: [
        {
          label: "Stop conditions",
          value: stopConditionCount,
          tone: stopConditionCount ? "warning" : "ok",
        },
        {
          label: "Runtime claims",
          value: operationalSummary.runtimeProofClaims,
          tone: operationalSummary.runtimeProofClaims ? "danger" : "ok",
        },
      ],
      items: model.stopConditions.map((item) => ({
        label: item.label,
        meta: item.nextAction,
        state: item.severity,
      })),
      detailsLabel: "Show next actions",
    },
  ];
}
