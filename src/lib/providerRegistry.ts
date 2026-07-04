import type { ProofBoundaryClass } from "@/lib/cockpitModel";

/**
 * Central Provider Registry + Toolbox Matrix (cockpit-only projection).
 *
 * Data-integrity boundary: every entry here is a candidate/read-only capability
 * declaration. The Gemini App cockpit never executes, deploys, mutates a graph,
 * promotes a claim, or issues a governed write. `writeAuthority` is always
 * `false`. Scoring, fallbacks, quorum and adapter contracts are advisory
 * projections consumed by governed materializers downstream — not by the cockpit.
 *
 * Routing invariant: provider selection MUST NOT happen before capability
 * resolution. `candidateProvidersForCapabilities` returns nothing unless it is
 * handed resolved capability ids. The pipeline stages encode the same order.
 */

export type ProviderLane =
  | "cli"
  | "model"
  | "design"
  | "codegen"
  | "deploy"
  | "scm"
  | "planning"
  | "knowledge"
  | "browser";

export const LANE_LABELS: Record<ProviderLane, string> = {
  cli: "Governance / CLI",
  model: "Reasoning model",
  design: "Design / prototype",
  codegen: "Code generation",
  deploy: "Deploy lane",
  scm: "Source control",
  planning: "Planning / tracking",
  knowledge: "Graph / RAG",
  browser: "Browser / verify",
};

export type AuthState =
  | "session_scoped"
  | "authenticated"
  | "oauth_required"
  | "key_required"
  | "not_configured";

export type RegistryReadiness = "ready" | "dry_run_only" | "approval_required" | "blocked";

export type ScoreClass = "low" | "medium" | "high";

export type QuorumMode = "single" | "dual_review" | "quorum_2of3" | "human_gate";

export type AdapterContract = {
  protocol: string;
  inputEnvelope: string;
  outputEnvelope: string;
  writeAuthority: false;
};

export type RegistryProvider = {
  id: string;
  label: string;
  vendor: string;
  lane: ProviderLane;
  auth: AuthState;
  readiness: RegistryReadiness;
  /** Highest proof class this provider's output can reach on its own. */
  maxProof: ProofBoundaryClass;
  allowedActions: string[];
  blockedActions: string[];
  evidenceRequirements: string[];
  /** Advisory scoring (0-100 fit) plus qualitative cost/latency/risk. */
  fitScore: number;
  cost: ScoreClass;
  latency: ScoreClass;
  risk: ScoreClass;
  /** Ordered fallback provider ids if this provider is unavailable / blocked. */
  fallbacks: string[];
  quorum: QuorumMode;
  reviewMode: string;
  adapter: AdapterContract;
  /** Capability ids this provider can serve (matches capabilityOrchestration). */
  providesCapabilities: string[];
};

const NO_WRITE = false as const;

export const providerRegistry: RegistryProvider[] = [
  {
    id: "wdc-cli",
    label: "WDC CLI",
    vendor: "WidgetDC",
    lane: "cli",
    auth: "session_scoped",
    readiness: "ready",
    maxProof: "claim",
    allowedActions: ["route_validate", "capability_chain.resolve", "session.open", "approval.request"],
    blockedActions: ["cockpit-initiated write", "unclaimed mutation"],
    evidenceRequirements: ["wdc_session", "route_readback", "claim_owner"],
    fitScore: 96,
    cost: "low",
    latency: "low",
    risk: "low",
    fallbacks: [],
    quorum: "human_gate",
    reviewMode: "Claim owner + governed materializer",
    adapter: {
      protocol: "wdc.route/1",
      inputEnvelope: "RouteRequest",
      outputEnvelope: "RouteReadback",
      writeAuthority: NO_WRITE,
    },
    providesCapabilities: ["capability:route.validate", "capability:capability.resolve"],
  },
  {
    id: "claude",
    label: "Claude",
    vendor: "Anthropic",
    lane: "model",
    auth: "key_required",
    readiness: "ready",
    maxProof: "diagnostic",
    allowedActions: ["reasoning", "code-review", "extraction", "planning-draft"],
    blockedActions: ["autonomous deploy", "graph write", "claim promotion"],
    evidenceRequirements: ["prompt_contract", "output_envelope", "citation_set"],
    fitScore: 93,
    cost: "medium",
    latency: "medium",
    risk: "medium",
    fallbacks: ["openai", "gemini"],
    quorum: "dual_review",
    reviewMode: "Cross-model review before diagnostic promotion",
    adapter: {
      protocol: "a2a.model/1",
      inputEnvelope: "PromptContract",
      outputEnvelope: "CandidateEnvelope",
      writeAuthority: NO_WRITE,
    },
    providesCapabilities: ["capability:reasoning.plan", "capability:code.review"],
  },
  {
    id: "gemini",
    label: "Gemini",
    vendor: "Google",
    lane: "model",
    auth: "key_required",
    readiness: "ready",
    maxProof: "diagnostic",
    allowedActions: ["reasoning", "multimodal-extraction", "planning-draft"],
    blockedActions: ["autonomous deploy", "graph write", "claim promotion"],
    evidenceRequirements: ["prompt_contract", "output_envelope"],
    fitScore: 88,
    cost: "low",
    latency: "medium",
    risk: "medium",
    fallbacks: ["claude", "openai"],
    quorum: "dual_review",
    reviewMode: "Cross-model review before diagnostic promotion",
    adapter: {
      protocol: "a2a.model/1",
      inputEnvelope: "PromptContract",
      outputEnvelope: "CandidateEnvelope",
      writeAuthority: NO_WRITE,
    },
    providesCapabilities: ["capability:reasoning.plan", "capability:extraction.multimodal"],
  },
  {
    id: "openai",
    label: "OpenAI",
    vendor: "OpenAI",
    lane: "model",
    auth: "key_required",
    readiness: "ready",
    maxProof: "diagnostic",
    allowedActions: ["reasoning", "code-generation", "embedding"],
    blockedActions: ["autonomous deploy", "graph write", "claim promotion"],
    evidenceRequirements: ["prompt_contract", "output_envelope"],
    fitScore: 90,
    cost: "medium",
    latency: "medium",
    risk: "medium",
    fallbacks: ["claude", "gemini"],
    quorum: "dual_review",
    reviewMode: "Cross-model review before diagnostic promotion",
    adapter: {
      protocol: "a2a.model/1",
      inputEnvelope: "PromptContract",
      outputEnvelope: "CandidateEnvelope",
      writeAuthority: NO_WRITE,
    },
    providesCapabilities: ["capability:reasoning.plan", "capability:embedding.index"],
  },
  {
    id: "v0",
    label: "v0",
    vendor: "Vercel",
    lane: "design",
    auth: "authenticated",
    readiness: "ready",
    maxProof: "candidate",
    allowedActions: ["prototype-generation", "ui-porting", "evidence-boundary-rendering"],
    blockedActions: ["deploy", "graph write", "runtime claim"],
    evidenceRequirements: ["candidate_envelope", "source_fit_score"],
    fitScore: 85,
    cost: "low",
    latency: "low",
    risk: "low",
    fallbacks: ["lovable", "figma-stitch"],
    quorum: "single",
    reviewMode: "Human review before porting candidate",
    adapter: {
      protocol: "candidate.ui/1",
      inputEnvelope: "DesignBrief",
      outputEnvelope: "CandidateEnvelope",
      writeAuthority: NO_WRITE,
    },
    providesCapabilities: ["capability:prototype.generate", "capability:ui.port"],
  },
  {
    id: "lovable",
    label: "Lovable",
    vendor: "Lovable",
    lane: "design",
    auth: "authenticated",
    readiness: "dry_run_only",
    maxProof: "candidate",
    allowedActions: ["prototype-generation", "ui-porting", "brand-rendering"],
    blockedActions: ["deploy", "graph write", "runtime claim"],
    evidenceRequirements: ["candidate_envelope"],
    fitScore: 78,
    cost: "low",
    latency: "medium",
    risk: "low",
    fallbacks: ["v0", "figma-stitch"],
    quorum: "single",
    reviewMode: "Human review before porting candidate",
    adapter: {
      protocol: "candidate.ui/1",
      inputEnvelope: "DesignBrief",
      outputEnvelope: "CandidateEnvelope",
      writeAuthority: NO_WRITE,
    },
    providesCapabilities: ["capability:prototype.generate", "capability:brand.render"],
  },
  {
    id: "figma-stitch",
    label: "Figma / Stitch",
    vendor: "Figma",
    lane: "design",
    auth: "oauth_required",
    readiness: "approval_required",
    maxProof: "candidate",
    allowedActions: ["design-source", "brand-rendering", "stitch-generation"],
    blockedActions: ["deploy", "graph write", "runtime claim"],
    evidenceRequirements: ["candidate_envelope", "design_source_ref"],
    fitScore: 74,
    cost: "medium",
    latency: "medium",
    risk: "low",
    fallbacks: ["v0", "lovable"],
    quorum: "single",
    reviewMode: "Human review before porting candidate",
    adapter: {
      protocol: "candidate.design/1",
      inputEnvelope: "DesignRef",
      outputEnvelope: "CandidateEnvelope",
      writeAuthority: NO_WRITE,
    },
    providesCapabilities: ["capability:brand.render", "capability:prototype.generate"],
  },
  {
    id: "vercel",
    label: "Vercel",
    vendor: "Vercel",
    lane: "deploy",
    auth: "oauth_required",
    readiness: "approval_required",
    maxProof: "runtime",
    allowedActions: ["deploy-pattern-source", "preview-inspection"],
    blockedActions: ["cockpit-initiated deploy", "claim promotion"],
    evidenceRequirements: ["deployed_sha", "runtime_readback", "approval_ticket"],
    fitScore: 82,
    cost: "medium",
    latency: "medium",
    risk: "high",
    fallbacks: ["railway-lane"],
    quorum: "human_gate",
    reviewMode: "Governed deploy gate — cockpit is read-only",
    adapter: {
      protocol: "deploy.lane/1",
      inputEnvelope: "DeployRequest",
      outputEnvelope: "RuntimeReadback",
      writeAuthority: NO_WRITE,
    },
    providesCapabilities: ["capability:deploy.preview", "capability:runtime.readback"],
  },
  {
    id: "railway-lane",
    label: "Railway lane",
    vendor: "Railway",
    lane: "deploy",
    auth: "not_configured",
    readiness: "blocked",
    maxProof: "runtime",
    allowedActions: ["runtime-readback-source"],
    blockedActions: ["cockpit-initiated mutation", "claim promotion", "railway mutation"],
    evidenceRequirements: ["deployed_sha", "runtime_readback", "approval_ticket"],
    fitScore: 70,
    cost: "medium",
    latency: "high",
    risk: "high",
    fallbacks: ["vercel"],
    quorum: "human_gate",
    reviewMode: "Governed deploy gate — no Railway mutation from cockpit",
    adapter: {
      protocol: "deploy.lane/1",
      inputEnvelope: "DeployRequest",
      outputEnvelope: "RuntimeReadback",
      writeAuthority: NO_WRITE,
    },
    providesCapabilities: ["capability:runtime.readback"],
  },
  {
    id: "github",
    label: "GitHub",
    vendor: "GitHub",
    lane: "scm",
    auth: "oauth_required",
    readiness: "approval_required",
    maxProof: "diagnostic",
    allowedActions: ["repo-read", "pr-inspection", "diff-readback"],
    blockedActions: ["cockpit-initiated commit", "branch mutation", "claim promotion"],
    evidenceRequirements: ["repo_ref", "commit_sha", "session_scope"],
    fitScore: 87,
    cost: "low",
    latency: "low",
    risk: "medium",
    fallbacks: [],
    quorum: "human_gate",
    reviewMode: "PR review + claim owner before merge",
    adapter: {
      protocol: "scm.read/1",
      inputEnvelope: "RepoQuery",
      outputEnvelope: "DiagnosticReadback",
      writeAuthority: NO_WRITE,
    },
    providesCapabilities: ["capability:repo.inspect", "capability:diff.readback"],
  },
  {
    id: "linear",
    label: "Linear",
    vendor: "Linear",
    lane: "planning",
    auth: "oauth_required",
    readiness: "dry_run_only",
    maxProof: "diagnostic",
    allowedActions: ["issue-read", "plan-draft", "status-readback"],
    blockedActions: ["cockpit-initiated issue write", "state mutation"],
    evidenceRequirements: ["workspace_scope", "issue_ref"],
    fitScore: 76,
    cost: "low",
    latency: "low",
    risk: "low",
    fallbacks: ["github"],
    quorum: "single",
    reviewMode: "Human review before issue mutation",
    adapter: {
      protocol: "planning.read/1",
      inputEnvelope: "PlanQuery",
      outputEnvelope: "DiagnosticReadback",
      writeAuthority: NO_WRITE,
    },
    providesCapabilities: ["capability:plan.draft", "capability:issue.readback"],
  },
  {
    id: "graph-rag",
    label: "Graph / RAG",
    vendor: "WidgetDC",
    lane: "knowledge",
    auth: "session_scoped",
    readiness: "ready",
    maxProof: "diagnostic",
    allowedActions: ["graph-read", "retrieval", "citation-assembly"],
    blockedActions: ["graph write", "index mutation from cockpit"],
    evidenceRequirements: ["source_fit_score", "extraction_contract", "citation_set"],
    fitScore: 84,
    cost: "low",
    latency: "medium",
    risk: "medium",
    fallbacks: ["openai"],
    quorum: "dual_review",
    reviewMode: "Extraction contract review before diagnostic promotion",
    adapter: {
      protocol: "knowledge.read/1",
      inputEnvelope: "RetrievalQuery",
      outputEnvelope: "CitationSet",
      writeAuthority: NO_WRITE,
    },
    providesCapabilities: ["capability:graph.read", "capability:retrieval.rag"],
  },
  {
    id: "browser-playwright",
    label: "Browser / Playwright",
    vendor: "Microsoft",
    lane: "browser",
    auth: "authenticated",
    readiness: "dry_run_only",
    maxProof: "diagnostic",
    allowedActions: ["snapshot", "screenshot", "vitals", "flow-readback"],
    blockedActions: ["destructive automation", "claim promotion"],
    evidenceRequirements: ["target_url", "snapshot_artifact", "run_log"],
    fitScore: 80,
    cost: "low",
    latency: "medium",
    risk: "medium",
    fallbacks: [],
    quorum: "single",
    reviewMode: "Diagnostic readback only — not runtime proof",
    adapter: {
      protocol: "verify.browser/1",
      inputEnvelope: "VerifyRequest",
      outputEnvelope: "DiagnosticReadback",
      writeAuthority: NO_WRITE,
    },
    providesCapabilities: ["capability:verify.browser", "capability:vitals.readback"],
  },
];

export const REGISTRY_LANES: ProviderLane[] = [
  "cli",
  "model",
  "design",
  "codegen",
  "deploy",
  "scm",
  "planning",
  "knowledge",
  "browser",
];

/** Registry lookup. */
export function providerById(id: string): RegistryProvider | undefined {
  return providerRegistry.find((provider) => provider.id === id);
}

/**
 * Routing pipeline stages. The order encodes the invariant that provider
 * selection cannot precede capability resolution.
 */
export type PipelineStage = {
  id: string;
  label: string;
  role: string;
  gate: string;
};

export const routingPipeline: PipelineStage[] = [
  { id: "demand", label: "Demand", role: "Captured demand", gate: "Free text — no provider bound yet" },
  {
    id: "resolver",
    label: "CapabilityResolver",
    role: "Resolve demand → capabilities",
    gate: "Must run before any provider is considered",
  },
  {
    id: "required",
    label: "RequiredCapabilities",
    role: "Capability set + claim ceilings",
    gate: "Defines what providers are eligible",
  },
  {
    id: "candidates",
    label: "CandidateProviders",
    role: "Eligible providers only",
    gate: "Filtered by resolved capabilities",
  },
  {
    id: "scoring",
    label: "ProviderScoring",
    role: "Fit / cost / latency / risk",
    gate: "Advisory ranking — no selection authority",
  },
  {
    id: "bom",
    label: "BOM / Route",
    role: "Map to WorkBOM + RouteCatalog",
    gate: "Governed route handoff",
  },
  {
    id: "execution",
    label: "ExecutionSurface",
    role: "Governed materializer executes",
    gate: "Outside cockpit authority",
  },
  { id: "proof", label: "Proof", role: "Candidate → runtime → claim", gate: "Claim owned by materializer" },
];

/**
 * Return registry providers eligible for a resolved capability set.
 *
 * ENFORCES the routing invariant: if no resolved capabilities are supplied,
 * the function returns an empty list. Provider selection cannot happen before
 * capability resolution.
 */
export function candidateProvidersForCapabilities(
  resolvedCapabilityIds: string[] | null | undefined,
): RegistryProvider[] {
  if (!resolvedCapabilityIds || resolvedCapabilityIds.length === 0) {
    return [];
  }
  const wanted = new Set(resolvedCapabilityIds.map((id) => id.toLowerCase()));
  return providerRegistry
    .filter((provider) =>
      provider.providesCapabilities.some((cap) => {
        const bare = cap.toLowerCase();
        const short = bare.replace("capability:", "");
        // match against resolved capability ids in either bare or short form
        return [...wanted].some(
          (want) =>
            want === bare ||
            want === short ||
            want.includes(short.split(".")[0]) ||
            short.includes(want.replace("capability:", "").split(".")[0]),
        );
      }),
    )
    .sort((a, b) => b.fitScore - a.fitScore);
}

export const SCORE_ORDER: Record<ScoreClass, number> = { low: 0, medium: 1, high: 2 };
