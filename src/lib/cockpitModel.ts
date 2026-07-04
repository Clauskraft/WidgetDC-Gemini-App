import {
  candidateProviders,
  capabilitiesForDemand,
  exampleDemands,
  providersForDemand,
  scoreProviderById,
  type CandidateProvider,
  type ExampleDemand,
  type RequiredCapability,
} from "@/lib/capabilityOrchestration";

/**
 * Cockpit-only projection model.
 *
 * Data-integrity boundary: the Gemini App is a cockpit/UX surface only. Nothing
 * in this module performs orchestration, graph writes, Railway mutation, claim
 * promotion, or deploy/runtime proof. Every value here is a candidate or a
 * read-only projection. `candidateCount` and `mappedCount` are tracked
 * separately and are never merged into a single "proven" number.
 */

export type CockpitStatusState = "boot" | "ready" | "attention" | "blocked";

export type CockpitStatusChip = {
  id: string;
  label: string;
  value: string;
  state: CockpitStatusState;
  detail: string;
};

export const cockpitStatusStrip: CockpitStatusChip[] = [
  {
    id: "boot",
    label: "Boot",
    value: "Ready",
    state: "ready",
    detail: "WDC boot + route validation readback complete. Cockpit mounted read-only.",
  },
  {
    id: "route",
    label: "Route validate",
    value: "Ready",
    state: "ready",
    detail: "Adaptive BOM route catalog resolved. No governed writes issued from cockpit.",
  },
  {
    id: "session",
    label: "Session",
    value: "Claim gated",
    state: "attention",
    detail: "Any source mutation must be protected by a WDC session + claim owned by the CLI.",
  },
  {
    id: "authority",
    label: "Authority",
    value: "Cockpit only",
    state: "attention",
    detail: "Gemini App has no orchestrator authority. No graph writes, no claim promotion.",
  },
  {
    id: "proof",
    label: "Proof",
    value: "Not runtime proof",
    state: "attention",
    detail: "Candidate + diagnostic evidence only. Runtime proof requires deployed SHA readback.",
  },
];

export type ProofBoundaryClass = "candidate" | "diagnostic" | "runtime" | "claim";

export type ProofBoundaryCard = {
  id: ProofBoundaryClass;
  label: string;
  description: string;
  reachable: boolean;
  reason: string;
};

export const proofBoundaryCards: ProofBoundaryCard[] = [
  {
    id: "candidate",
    label: "Candidate",
    description: "Prototype, fixture, or generated UI candidate produced inside the cockpit.",
    reachable: true,
    reason: "Cockpit may render candidates.",
  },
  {
    id: "diagnostic",
    label: "Diagnostic",
    description: "CLI, A2A, route, or local readback evidence surfaced for review.",
    reachable: true,
    reason: "Cockpit may display diagnostic readback.",
  },
  {
    id: "runtime",
    label: "Runtime",
    description: "Deployed / governed runtime readback with a deployed SHA.",
    reachable: false,
    reason: "Requires deployed SHA + repeated verification. Not claimable from cockpit.",
  },
  {
    id: "claim",
    label: "Claim",
    description: "Promotion-grade proof only after every gate passes.",
    reachable: false,
    reason: "Claim promotion is owned by governed materializers, never the cockpit.",
  },
];

export type BomChainState = "ready" | "pending" | "blocked";

export type BomChainNode = {
  id: string;
  label: string;
  role: string;
  state: BomChainState;
  candidateCount: number;
  mappedCount: number;
  summary: string;
};

/** LegoFactory / BOM chain — read-only projection of the production loop. */
export const bomChain: BomChainNode[] = [
  {
    id: "workbom",
    label: "WorkBOM",
    role: "Buildable work items resolved from required capabilities.",
    state: "ready",
    candidateCount: 12,
    mappedCount: 9,
    summary: "9 of 12 candidate work items mapped to a provider capability.",
  },
  {
    id: "routecatalog",
    label: "RouteCatalog",
    role: "Governed WDC CLI routes available for handoff.",
    state: "ready",
    candidateCount: 8,
    mappedCount: 8,
    summary: "route_validate, capability_chain.resolve, approval.request resolved.",
  },
  {
    id: "projecttree",
    label: "ProjectTree",
    role: "Start / closeout framing for the activity.",
    state: "ready",
    candidateCount: 6,
    mappedCount: 5,
    summary: "Start node admitted. Closeout node pending evidence.",
  },
  {
    id: "agentteambom",
    label: "AgentTeamBOM",
    role: "Competence mapping across agents required vs provided.",
    state: "pending",
    candidateCount: 10,
    mappedCount: 6,
    summary: "6 mapped, 4 competence-debt candidates awaiting readback.",
  },
  {
    id: "environmentbom",
    label: "EnvironmentBOM",
    role: "Repo, branch, dependency, runtime, evidence inventory.",
    state: "pending",
    candidateCount: 14,
    mappedCount: 9,
    summary: "Repo + branch admitted. Runtime + evidence categories require readback.",
  },
  {
    id: "evidenceledger",
    label: "EvidenceContractLedger",
    role: "Extraction contracts binding every candidate to its source.",
    state: "pending",
    candidateCount: 22,
    mappedCount: 15,
    summary: "15 contracts have source_fit_score + extraction_contract present.",
  },
  {
    id: "proofgate",
    label: "ProofGate",
    role: "Code / deploy / verification evidence separation.",
    state: "blocked",
    candidateCount: 4,
    mappedCount: 1,
    summary: "Code-model evidence present. Deploy + runtime readback missing.",
  },
  {
    id: "closeouttree",
    label: "CloseoutTree",
    role: "Release / A2A / adoption-followup handoff.",
    state: "blocked",
    candidateCount: 5,
    mappedCount: 0,
    summary: "Blocked until ProofGate passes. No handoff issued.",
  },
];

export type WorkspaceRailItem = {
  id: string;
  label: string;
  hint: string;
  count?: number;
};

export const workspaceRail: WorkspaceRailItem[] = [
  { id: "demand", label: "Demand composer", hint: "Capture + resolve demand" },
  { id: "capabilities", label: "Capability library", hint: "Searchable inventory" },
  { id: "providers", label: "Candidate providers", hint: "Scored fit / proof / risk" },
  { id: "bom", label: "BOM / LegoFactory", hint: "WorkBOM → CloseoutTree", count: bomChain.length },
  { id: "proof", label: "Proof boundaries", hint: "Candidate → claim" },
  { id: "toolbox", label: "Provider toolbox", hint: "v0 · Lovable · Vercel · Figma" },
];

export type ToolboxProvider = {
  id: string;
  label: string;
  vendor: string;
  evidenceClass: ProofBoundaryClass;
  summary: string;
  capabilities: string[];
  writeAllowed: false;
};

/** Provider toolbox drawer — all candidate-only design/prototype surfaces. */
export const toolboxProviders: ToolboxProvider[] = [
  {
    id: "v0",
    label: "v0",
    vendor: "Vercel",
    evidenceClass: "candidate",
    summary: "Generative UI + component candidates. Output is a candidate envelope, never a claim.",
    capabilities: ["prototype-generation", "ui-porting", "evidence-boundary-rendering"],
    writeAllowed: false,
  },
  {
    id: "lovable",
    label: "Lovable",
    vendor: "Lovable",
    evidenceClass: "candidate",
    summary: "Design generation + prototype exploration. Requires candidate envelope before porting.",
    capabilities: ["prototype-generation", "ui-porting", "brand-rendering"],
    writeAllowed: false,
  },
  {
    id: "vercel",
    label: "Vercel",
    vendor: "Vercel",
    evidenceClass: "candidate",
    summary: "Deployment pattern source for evidence-boundary rendering. No cockpit deploy authority.",
    capabilities: ["prototype-generation", "evidence-boundary-rendering"],
    writeAllowed: false,
  },
  {
    id: "figma-stitch",
    label: "Figma / Stitch",
    vendor: "Figma",
    evidenceClass: "candidate",
    summary: "Design source + Stitch generation feeding brand + component candidates for review.",
    capabilities: ["brand-rendering", "prototype-generation"],
    writeAllowed: false,
  },
];

export type ResolvedDemand = {
  demand: string;
  capabilities: RequiredCapability[];
  providers: Array<{ provider: CandidateProvider; score: number }>;
  blockedUnless?: string;
  requiredProof: string[];
  ready: boolean;
};

/** Resolve a demand into candidates. Pure projection — no execution. */
export function resolveDemand(input: string): ResolvedDemand | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();
  const matched: ExampleDemand | undefined = exampleDemands.find(
    (demand) =>
      demand.demand.toLowerCase() === lowered ||
      demand.demand.toLowerCase().includes(lowered) ||
      lowered.includes(demand.demand.toLowerCase()),
  );

  const base: ExampleDemand = matched ?? exampleDemands[0];
  const capabilities = capabilitiesForDemand(base);
  const providers = providersForDemand(base)
    .map((provider) => ({ provider, score: scoreProviderById(provider.id) }))
    .sort((a, b) => b.score - a.score);

  return {
    demand: trimmed,
    capabilities,
    providers,
    blockedUnless: base.blockedUnless,
    requiredProof: base.requiredProof,
    ready: !base.blockedUnless,
  };
}

export const exampleDemandPrompts = exampleDemands.map((demand) => demand.demand);

/** All candidate providers, scored, sorted — cockpit read-only view. */
export function scoredProviders(): Array<{ provider: CandidateProvider; score: number }> {
  return candidateProviders
    .map((provider) => ({ provider, score: scoreProviderById(provider.id) }))
    .sort((a, b) => b.score - a.score);
}
