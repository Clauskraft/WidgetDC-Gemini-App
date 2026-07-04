export type DemandSurface =
  | "wdc_cli"
  | "wdc_cli_chat"
  | "gemini_app"
  | "orbit"
  | "slash_alias"
  | "mention_alias"
  | "a2a_handoff"
  | "api_mcp_route"
  | "desksmith"
  | "pagesmith"
  | "lovable_candidate";

export type EvidenceClass = "candidate" | "diagnostic" | "runtime" | "claim";

export type RiskClass = "read_only" | "draft" | "staged_write" | "production_write";

export type RuntimeStatus =
  | "candidate"
  | "runtime_read_only"
  | "runtime_apply_gated"
  | "runtime_proven"
  | "claim_proven"
  | "blocked"
  | "deprecated";

export type ProviderId =
  | "provider:wdc-cli"
  | "provider:wdc-cli-chat"
  | "provider:gemini-app"
  | "provider:orbit"
  | "provider:v0"
  | "provider:lovable"
  | "provider:claude-design"
  | "provider:figma-stitch"
  | "provider:claude-review"
  | "provider:vercel"
  | "provider:github"
  | "provider:linear"
  | "provider:graph-rag"
  | "provider:browser-playwright"
  | "provider:desksmith"
  | "provider:patternfactory"
  | "provider:harvestline"
  | "provider:legofactory"
  | "provider:governed-materializer";

export type CapabilityId =
  | "capability:text-generation"
  | "capability:document-formatting"
  | "capability:tone-control"
  | "capability:user-review"
  | "capability:repo-read"
  | "capability:source-classification"
  | "capability:pattern-extraction"
  | "capability:harvestline-admission"
  | "capability:patternfactory-generation"
  | "capability:repo-admission"
  | "capability:session-claim-coordination"
  | "capability:subagent-dispatch"
  | "capability:a2a-readback"
  | "capability:project-tree"
  | "capability:candidate-validation"
  | "capability:preview"
  | "capability:exact-approval"
  | "capability:materializer-apply"
  | "capability:eventspine-replay"
  | "capability:graph-readback"
  | "capability:prototype-generation"
  | "capability:ui-porting"
  | "capability:brand-rendering"
  | "capability:evidence-boundary-rendering";

export type DemandIngressEntry = {
  surface: DemandSurface;
  label: string;
  role: string;
  privileged: false;
  firstGate: "CapabilityResolver";
  evidenceClass: EvidenceClass;
  writeAllowed: boolean;
};

export type RequiredCapability = {
  id: CapabilityId;
  description: string;
  requiredInputs: string[];
  providedOutputs: string[];
  proofRequired: string[];
  claimCeiling: "L1" | "L2" | "L3";
  runtimeStatus: RuntimeStatus;
};

export type CandidateProvider = {
  id: ProviderId;
  label: string;
  providedCapabilities: CapabilityId[];
  costClass: "free" | "low" | "medium" | "high";
  latencyClass: "interactive" | "batch" | "async";
  riskClass: RiskClass;
  proofHistory: string[];
  runtimeStatus: RuntimeStatus;
  admissionState: "admitted" | "blocked" | "requires_preservation" | "not_applicable";
};

export type PrototypeBuilderLane =
  | "prototype_builder"
  | "design_review"
  | "preview_deploy"
  | "source_control"
  | "governance_readback";

export type PrototypeBuilderProvider = {
  providerId: ProviderId;
  label: string;
  lane: PrototypeBuilderLane;
  role: string;
  capabilityFocus: CapabilityId[];
  toolboxUse: string;
  authState: "ready" | "login_required" | "token_required" | "wdc_session_required";
  allowedActions: string[];
  blockedActions: string[];
  evidenceRequirements: string[];
  handoffToWdc: string;
  preferredWhen: string;
  fallbackTo: ProviderId[];
  boundary: EvidenceClass;
};

export type ProviderScoreInput = {
  capabilityFit: number;
  proofHistory: number;
  cost: number;
  latency: number;
  risk: number;
  compliance: number;
};

export type ExampleDemand = {
  demand: string;
  requiredCapabilities: CapabilityId[];
  candidateProviders: ProviderId[];
  requiredProof: string[];
  blockedUnless?: string;
};

export const capabilityResolutionFlow = [
  "DemandIngress",
  "CapabilityResolver",
  "RequiredCapabilities",
  "CandidateProviders",
  "ProviderScoring",
  "AdaptiveBOM/WorkBOM/TaskBOM",
  "Route/ProjectTree",
  "ExecutionSurface",
  "ProofReceipt/EventSpine/GraphReadback",
  "CapabilityRegistryUpdate",
] as const;

export const providerScoreWeights = {
  capabilityFit: 0.32,
  proofHistory: 0.22,
  compliance: 0.18,
  risk: 0.14,
  latency: 0.08,
  cost: 0.06,
} as const;

export const demandIngressMatrix: DemandIngressEntry[] = [
  {
    surface: "wdc_cli",
    label: "WDC CLI",
    role: "Authoritative command and route execution surface.",
    privileged: false,
    firstGate: "CapabilityResolver",
    evidenceClass: "diagnostic",
    writeAllowed: true,
  },
  {
    surface: "wdc_cli_chat",
    label: "WDC CLI Chat",
    role: "Interactive demand capture and human review surface.",
    privileged: false,
    firstGate: "CapabilityResolver",
    evidenceClass: "candidate",
    writeAllowed: false,
  },
  {
    surface: "gemini_app",
    label: "Gemini App",
    role: "UX surface for demand entry, capability visibility, and proof readback.",
    privileged: false,
    firstGate: "CapabilityResolver",
    evidenceClass: "candidate",
    writeAllowed: false,
  },
  {
    surface: "slash_alias",
    label: "Prototype builder toolbox",
    role: "User-visible access point for v0, Lovable, Vercel, Claude Design, Figma/Stitch, and source-control handoff.",
    privileged: false,
    firstGate: "CapabilityResolver",
    evidenceClass: "candidate",
    writeAllowed: false,
  },
  {
    surface: "orbit",
    label: "Orbit",
    role: "Runtime surface when WDC readback proves route, governance, and alias gates.",
    privileged: false,
    firstGate: "CapabilityResolver",
    evidenceClass: "runtime",
    writeAllowed: false,
  },
  {
    surface: "lovable_candidate",
    label: "Lovable",
    role: "Candidate-only design generation and prototype exploration.",
    privileged: false,
    firstGate: "CapabilityResolver",
    evidenceClass: "candidate",
    writeAllowed: false,
  },
  {
    surface: "a2a_handoff",
    label: "A2A handoff",
    role: "Typed coordination, review, blockers, and cross-agent handoff.",
    privileged: false,
    firstGate: "CapabilityResolver",
    evidenceClass: "diagnostic",
    writeAllowed: false,
  },
];

export const requiredCapabilities: RequiredCapability[] = [
  {
    id: "capability:text-generation",
    description: "Generate clear business or advisory text from a user demand.",
    requiredInputs: ["demand", "tone", "audience"],
    providedOutputs: ["draft_text"],
    proofRequired: ["user_review"],
    claimCeiling: "L1",
    runtimeStatus: "candidate",
  },
  {
    id: "capability:document-formatting",
    description: "Structure text into a document or letter format.",
    requiredInputs: ["draft_text", "format_requirements"],
    providedOutputs: ["formatted_document"],
    proofRequired: ["format_review"],
    claimCeiling: "L1",
    runtimeStatus: "candidate",
  },
  {
    id: "capability:tone-control",
    description: "Match output tone to the user's audience and intent.",
    requiredInputs: ["audience", "tone_policy"],
    providedOutputs: ["tone_checked_text"],
    proofRequired: ["user_review"],
    claimCeiling: "L1",
    runtimeStatus: "candidate",
  },
  {
    id: "capability:user-review",
    description: "Keep the user in the loop before output adoption.",
    requiredInputs: ["draft_or_candidate"],
    providedOutputs: ["accepted_or_rejected_candidate"],
    proofRequired: ["explicit_user_acceptance_when_needed"],
    claimCeiling: "L1",
    runtimeStatus: "candidate",
  },
  {
    id: "capability:repo-read",
    description: "Read repository metadata and source content without mutation.",
    requiredInputs: ["repo_path", "admission_state"],
    providedOutputs: ["repo_context"],
    proofRequired: ["ProjectRootAdmissionGate"],
    claimCeiling: "L1",
    runtimeStatus: "runtime_read_only",
  },
  {
    id: "capability:source-classification",
    description: "Classify source material before harvest or pattern extraction.",
    requiredInputs: ["repo_context", "source_policy"],
    providedOutputs: ["source_classification"],
    proofRequired: ["classification_readback"],
    claimCeiling: "L2",
    runtimeStatus: "runtime_read_only",
  },
  {
    id: "capability:harvestline-admission",
    description: "Admit harvest candidates through the governed HarvestLine path.",
    requiredInputs: ["source_classification", "harvest_policy"],
    providedOutputs: ["harvest_candidates"],
    proofRequired: ["HarvestLine_state"],
    claimCeiling: "L2",
    runtimeStatus: "runtime_apply_gated",
  },
  {
    id: "capability:patternfactory-generation",
    description: "Generate pattern candidates after source and runtime gates pass.",
    requiredInputs: ["pattern_source", "runtime_gate"],
    providedOutputs: ["pattern_candidates"],
    proofRequired: ["PatternFactoryRuntimeGate"],
    claimCeiling: "L2",
    runtimeStatus: "runtime_read_only",
  },
  {
    id: "capability:session-claim-coordination",
    description: "Coordinate active work with WDC Agent Office session and claims.",
    requiredInputs: ["session_id", "claim_scope"],
    providedOutputs: ["claim_state"],
    proofRequired: ["WDC_Agent_Office_readback"],
    claimCeiling: "L1",
    runtimeStatus: "runtime_read_only",
  },
  {
    id: "capability:subagent-dispatch",
    description: "Dispatch or coordinate subagents only after admission gates pass.",
    requiredInputs: ["admitted_roots", "claim_scope", "a2a_policy"],
    providedOutputs: ["subagent_plan"],
    proofRequired: ["A2A_readback"],
    claimCeiling: "L2",
    runtimeStatus: "runtime_apply_gated",
  },
  {
    id: "capability:a2a-readback",
    description: "Read typed cross-agent messages and blockers.",
    requiredInputs: ["session_id"],
    providedOutputs: ["a2a_inbox_state"],
    proofRequired: ["A2A_inbox"],
    claimCeiling: "L1",
    runtimeStatus: "runtime_read_only",
  },
  {
    id: "capability:project-tree",
    description: "Show BOM, route, and dependency tree structure.",
    requiredInputs: ["task_bom", "route_operations"],
    providedOutputs: ["project_tree_view"],
    proofRequired: ["ProjectTree_readback"],
    claimCeiling: "L1",
    runtimeStatus: "runtime_read_only",
  },
  {
    id: "capability:candidate-validation",
    description: "Validate a candidate before preview or apply.",
    requiredInputs: ["candidate", "validation_policy"],
    providedOutputs: ["validation_result"],
    proofRequired: ["validation_readback"],
    claimCeiling: "L2",
    runtimeStatus: "runtime_read_only",
  },
  {
    id: "capability:preview",
    description: "Produce a non-mutating preview before governed apply.",
    requiredInputs: ["candidate", "plan_context"],
    providedOutputs: ["preview_result"],
    proofRequired: ["preview_result"],
    claimCeiling: "L2",
    runtimeStatus: "runtime_read_only",
  },
  {
    id: "capability:exact-approval",
    description: "Capture exact approval text and lineage before apply.",
    requiredInputs: ["preview_result", "plan_id", "workflow_id", "approver_id"],
    providedOutputs: ["approval_ref"],
    proofRequired: ["approval_readback"],
    claimCeiling: "L2",
    runtimeStatus: "runtime_apply_gated",
  },
  {
    id: "capability:eventspine-replay",
    description: "Replay EventSpine evidence for scoped runtime actions.",
    requiredInputs: ["correlation_id"],
    providedOutputs: ["event_replay"],
    proofRequired: ["replay_count", "event_ids"],
    claimCeiling: "L3",
    runtimeStatus: "runtime_read_only",
  },
  {
    id: "capability:graph-readback",
    description: "Read typed graph state after governed apply.",
    requiredInputs: ["read_query", "claim_boundary"],
    providedOutputs: ["graph_state"],
    proofRequired: ["graph_readback"],
    claimCeiling: "L3",
    runtimeStatus: "runtime_read_only",
  },
  {
    id: "capability:prototype-generation",
    description: "Generate candidate frontend examples and interaction patterns.",
    requiredInputs: ["demand", "brand_asset", "candidate_boundary"],
    providedOutputs: ["component_map", "state_model", "porting_notes"],
    proofRequired: ["candidate_envelope", "source_authority"],
    claimCeiling: "L1",
    runtimeStatus: "candidate",
  },
  {
    id: "capability:ui-porting",
    description: "Move selected candidate patterns into governed Gemini App code.",
    requiredInputs: ["component_map", "state_model", "acceptance_checks"],
    providedOutputs: ["typed_components", "frontend_contracts"],
    proofRequired: ["review", "local_validation_when_requested"],
    claimCeiling: "L1",
    runtimeStatus: "candidate",
  },
  {
    id: "capability:evidence-boundary-rendering",
    description: "Show candidate, diagnostic, runtime, and claim evidence separately.",
    requiredInputs: ["proof_receipt", "route_readback", "claim_boundary"],
    providedOutputs: ["proof_badges", "proof_ledger"],
    proofRequired: ["deployed_sha_for_runtime", "graph_readback_for_graph_truth"],
    claimCeiling: "L2",
    runtimeStatus: "runtime_read_only",
  },
  {
    id: "capability:repo-admission",
    description: "Determine whether a repo or provider may be used by an execution flow.",
    requiredInputs: ["root", "repo_status", "admission_policy"],
    providedOutputs: ["admitted_roots", "blocked_roots"],
    proofRequired: ["ProjectRootAdmissionGate_readback"],
    claimCeiling: "L2",
    runtimeStatus: "runtime_read_only",
  },
  {
    id: "capability:pattern-extraction",
    description: "Extract reusable implementation or UX patterns from source material.",
    requiredInputs: ["source", "classification", "pattern_gate"],
    providedOutputs: ["pattern_candidates", "risk_notes"],
    proofRequired: ["PatternFactoryRuntimeGate_readback"],
    claimCeiling: "L2",
    runtimeStatus: "runtime_read_only",
  },
  {
    id: "capability:materializer-apply",
    description: "Apply approved candidates through governed materializers.",
    requiredInputs: ["preview", "approval", "plan_id", "workflow_id"],
    providedOutputs: ["graph_truth", "eventspine_events"],
    proofRequired: ["exact_approval", "EventSpine_replay", "graph_readback"],
    claimCeiling: "L3",
    runtimeStatus: "runtime_apply_gated",
  },
  {
    id: "capability:brand-rendering",
    description: "Render canonical WDC brand assets consistently in frontend surfaces.",
    requiredInputs: ["brand_contract", "asset_hash"],
    providedOutputs: ["logo_component", "brand_constants"],
    proofRequired: ["asset_sha256", "frontend_review"],
    claimCeiling: "L1",
    runtimeStatus: "candidate",
  },
];

export const candidateProviders: CandidateProvider[] = [
  {
    id: "provider:wdc-cli",
    label: "WDC CLI",
    providedCapabilities: [
      "capability:repo-admission",
      "capability:session-claim-coordination",
      "capability:a2a-readback",
      "capability:project-tree",
      "capability:eventspine-replay",
      "capability:graph-readback",
    ],
    costClass: "low",
    latencyClass: "interactive",
    riskClass: "read_only",
    proofHistory: ["boot_session", "route_validate", "adaptive_bom.compose"],
    runtimeStatus: "runtime_read_only",
    admissionState: "admitted",
  },
  {
    id: "provider:wdc-cli-chat",
    label: "WDC CLI Chat",
    providedCapabilities: [
      "capability:text-generation",
      "capability:tone-control",
      "capability:user-review",
    ],
    costClass: "low",
    latencyClass: "interactive",
    riskClass: "draft",
    proofHistory: ["user_review_required"],
    runtimeStatus: "candidate",
    admissionState: "admitted",
  },
  {
    id: "provider:gemini-app",
    label: "Gemini App",
    providedCapabilities: [
      "capability:prototype-generation",
      "capability:ui-porting",
      "capability:brand-rendering",
      "capability:evidence-boundary-rendering",
    ],
    costClass: "low",
    latencyClass: "interactive",
    riskClass: "draft",
    proofHistory: ["frontend_contract", "candidate_components"],
    runtimeStatus: "candidate",
    admissionState: "admitted",
  },
  {
    id: "provider:v0",
    label: "v0 by Vercel",
    providedCapabilities: [
      "capability:prototype-generation",
      "capability:ui-porting",
      "capability:brand-rendering",
      "capability:evidence-boundary-rendering",
    ],
    costClass: "medium",
    latencyClass: "interactive",
    riskClass: "draft",
    proofHistory: ["candidate_preview", "github_branch_or_export_required", "wdc_import_required"],
    runtimeStatus: "candidate",
    admissionState: "not_applicable",
  },
  {
    id: "provider:claude-review",
    label: "Claude review",
    providedCapabilities: ["capability:user-review", "capability:ui-porting"],
    costClass: "medium",
    latencyClass: "async",
    riskClass: "draft",
    proofHistory: ["review_evidence_only"],
    runtimeStatus: "candidate",
    admissionState: "not_applicable",
  },
  {
    id: "provider:claude-design",
    label: "Claude Design",
    providedCapabilities: [
      "capability:prototype-generation",
      "capability:brand-rendering",
      "capability:evidence-boundary-rendering",
      "capability:user-review",
    ],
    costClass: "medium",
    latencyClass: "async",
    riskClass: "draft",
    proofHistory: ["design_review_evidence_only", "wdc_import_required"],
    runtimeStatus: "candidate",
    admissionState: "not_applicable",
  },
  {
    id: "provider:figma-stitch",
    label: "Figma / Stitch",
    providedCapabilities: [
      "capability:prototype-generation",
      "capability:brand-rendering",
      "capability:evidence-boundary-rendering",
      "capability:user-review",
    ],
    costClass: "medium",
    latencyClass: "async",
    riskClass: "draft",
    proofHistory: ["design_artifact_required", "code_connect_or_export_required"],
    runtimeStatus: "candidate",
    admissionState: "not_applicable",
  },
  {
    id: "provider:vercel",
    label: "Vercel",
    providedCapabilities: [
      "capability:prototype-generation",
      "capability:evidence-boundary-rendering",
    ],
    costClass: "medium",
    latencyClass: "interactive",
    riskClass: "draft",
    proofHistory: ["deployment_pattern_source"],
    runtimeStatus: "candidate",
    admissionState: "not_applicable",
  },
  {
    id: "provider:github",
    label: "GitHub",
    providedCapabilities: [
      "capability:repo-read",
      "capability:repo-admission",
      "capability:session-claim-coordination",
      "capability:ui-porting",
    ],
    costClass: "low",
    latencyClass: "interactive",
    riskClass: "staged_write",
    proofHistory: ["branch", "pull_request", "checks"],
    runtimeStatus: "runtime_read_only",
    admissionState: "admitted",
  },
  {
    id: "provider:linear",
    label: "Linear",
    providedCapabilities: [
      "capability:user-review",
      "capability:project-tree",
      "capability:session-claim-coordination",
    ],
    costClass: "low",
    latencyClass: "interactive",
    riskClass: "draft",
    proofHistory: ["issue_scope", "status_readback"],
    runtimeStatus: "runtime_read_only",
    admissionState: "admitted",
  },
  {
    id: "provider:graph-rag",
    label: "Graph/RAG",
    providedCapabilities: [
      "capability:repo-read",
      "capability:source-classification",
      "capability:pattern-extraction",
      "capability:evidence-boundary-rendering",
    ],
    costClass: "low",
    latencyClass: "interactive",
    riskClass: "read_only",
    proofHistory: ["srag.query", "kg_rag.query", "reason_deeply"],
    runtimeStatus: "runtime_read_only",
    admissionState: "admitted",
  },
  {
    id: "provider:browser-playwright",
    label: "Browser / Playwright",
    providedCapabilities: [
      "capability:preview",
      "capability:candidate-validation",
      "capability:evidence-boundary-rendering",
    ],
    costClass: "low",
    latencyClass: "interactive",
    riskClass: "read_only",
    proofHistory: ["visual_diagnostic", "dom_snapshot", "screenshot_evidence"],
    runtimeStatus: "candidate",
    admissionState: "admitted",
  },
  {
    id: "provider:desksmith",
    label: "DeskSmith",
    providedCapabilities: [
      "capability:document-formatting",
      "capability:tone-control",
      "capability:user-review",
    ],
    costClass: "medium",
    latencyClass: "interactive",
    riskClass: "draft",
    proofHistory: ["future_surface_requires_admission"],
    runtimeStatus: "candidate",
    admissionState: "requires_preservation",
  },
  {
    id: "provider:orbit",
    label: "Orbit",
    providedCapabilities: [
      "capability:repo-admission",
      "capability:project-tree",
      "capability:a2a-readback",
    ],
    costClass: "low",
    latencyClass: "interactive",
    riskClass: "read_only",
    proofHistory: ["orbit.runtime read_only_activation"],
    runtimeStatus: "runtime_read_only",
    admissionState: "admitted",
  },
  {
    id: "provider:lovable",
    label: "Lovable",
    providedCapabilities: [
      "capability:prototype-generation",
      "capability:ui-porting",
      "capability:brand-rendering",
    ],
    costClass: "medium",
    latencyClass: "interactive",
    riskClass: "draft",
    proofHistory: ["candidate_envelope_required"],
    runtimeStatus: "candidate",
    admissionState: "not_applicable",
  },
  {
    id: "provider:patternfactory",
    label: "PatternFactory",
    providedCapabilities: ["capability:pattern-extraction", "capability:patternfactory-generation"],
    costClass: "low",
    latencyClass: "batch",
    riskClass: "read_only",
    proofHistory: ["runtime_gate_required"],
    runtimeStatus: "runtime_read_only",
    admissionState: "requires_preservation",
  },
  {
    id: "provider:harvestline",
    label: "HarvestLine",
    providedCapabilities: [
      "capability:source-classification",
      "capability:harvestline-admission",
      "capability:candidate-validation",
      "capability:preview",
    ],
    costClass: "low",
    latencyClass: "batch",
    riskClass: "staged_write",
    proofHistory: ["materializer_preview_required"],
    runtimeStatus: "runtime_apply_gated",
    admissionState: "requires_preservation",
  },
  {
    id: "provider:legofactory",
    label: "LegoFactory",
    providedCapabilities: [
      "capability:subagent-dispatch",
      "capability:project-tree",
      "capability:patternfactory-generation",
    ],
    costClass: "low",
    latencyClass: "batch",
    riskClass: "read_only",
    proofHistory: ["coverage_gate"],
    runtimeStatus: "runtime_read_only",
    admissionState: "admitted",
  },
  {
    id: "provider:governed-materializer",
    label: "Governed materializer",
    providedCapabilities: [
      "capability:preview",
      "capability:exact-approval",
      "capability:materializer-apply",
      "capability:eventspine-replay",
      "capability:graph-readback",
    ],
    costClass: "medium",
    latencyClass: "async",
    riskClass: "production_write",
    proofHistory: ["preview", "exact_approval", "EventSpine", "IronDome_MERGE"],
    runtimeStatus: "runtime_apply_gated",
    admissionState: "requires_preservation",
  },
];

export const exampleDemands: ExampleDemand[] = [
  {
    demand: "Write a business letter",
    requiredCapabilities: [
      "capability:text-generation",
      "capability:document-formatting",
      "capability:tone-control",
      "capability:user-review",
    ],
    candidateProviders: ["provider:wdc-cli-chat", "provider:gemini-app", "provider:desksmith"],
    requiredProof: ["user_review", "candidate_or_document_contract"],
  },
  {
    demand: "Analyze a repo and suggest harvest candidates",
    requiredCapabilities: [
      "capability:repo-read",
      "capability:source-classification",
      "capability:pattern-extraction",
      "capability:harvestline-admission",
      "capability:patternfactory-generation",
    ],
    candidateProviders: [
      "provider:wdc-cli",
      "provider:orbit",
      "provider:patternfactory",
      "provider:harvestline",
    ],
    requiredProof: ["ProjectRootAdmissionGate", "PatternFactoryRuntimeGate", "HarvestLine_state"],
  },
  {
    demand: "Run multi-repo subagent orchestration",
    requiredCapabilities: [
      "capability:repo-admission",
      "capability:session-claim-coordination",
      "capability:subagent-dispatch",
      "capability:a2a-readback",
      "capability:project-tree",
    ],
    candidateProviders: ["provider:orbit", "provider:wdc-cli", "provider:legofactory"],
    requiredProof: ["ProjectRootAdmissionGate", "session_claims", "a2a_readback"],
    blockedUnless: "ProjectRootAdmissionGate passes for the requested roots.",
  },
  {
    demand: "Turn a source into graph truth",
    requiredCapabilities: [
      "capability:candidate-validation",
      "capability:preview",
      "capability:exact-approval",
      "capability:materializer-apply",
      "capability:eventspine-replay",
      "capability:graph-readback",
    ],
    candidateProviders: ["provider:harvestline", "provider:governed-materializer"],
    requiredProof: ["preview", "exact_approval", "EventSpine_replay", "graph_readback"],
    blockedUnless: "Exact approval and materializer gates pass.",
  },
  {
    demand: "Build a world-class frontend prototype with multiple builder providers",
    requiredCapabilities: [
      "capability:prototype-generation",
      "capability:ui-porting",
      "capability:brand-rendering",
      "capability:evidence-boundary-rendering",
      "capability:repo-admission",
      "capability:project-tree",
      "capability:preview",
    ],
    candidateProviders: [
      "provider:wdc-cli",
      "provider:v0",
      "provider:lovable",
      "provider:vercel",
      "provider:claude-design",
      "provider:figma-stitch",
      "provider:github",
      "provider:graph-rag",
      "provider:browser-playwright",
    ],
    requiredProof: [
      "WDC boot session",
      "route_validate",
      "adaptive_bom.compose",
      "provider export or PR",
      "frontend review",
      "deployed SHA + 3 passes before runtime language",
    ],
    blockedUnless:
      "WDC CLI resolves capability route and imports builder output through a governed branch/PR lane.",
  },
];

export const geminiUxContract = {
  role: "UX surface for demand entry, capability visibility, candidate review, and proof readback.",
  notAuthorityFor: [
    "graph_truth",
    "claim_promotion",
    "railway_mutation",
    "secret_handling",
    "runtime_proof_without_readback",
  ],
  requiredViews: [
    "demand_ingress",
    "capability_resolver",
    "provider_scoring",
    "bom_route",
    "execution_surface",
    "proof_ledger",
    "claim_boundary",
  ],
  evidenceClasses: ["candidate", "diagnostic", "runtime", "claim"] as const,
  visibleStopConditions: [
    "dirty_or_unadmitted_repo",
    "missing_required_capability",
    "provider_without_proof_history",
    "materializer_without_preview",
    "approval_missing",
    "claim_ceiling_exceeded",
  ],
} as const;

export const providerScoreProfiles: Record<ProviderId, ProviderScoreInput> = {
  "provider:wdc-cli": {
    capabilityFit: 0.96,
    proofHistory: 0.94,
    cost: 0.86,
    latency: 0.82,
    risk: 0.9,
    compliance: 0.96,
  },
  "provider:wdc-cli-chat": {
    capabilityFit: 0.78,
    proofHistory: 0.58,
    cost: 0.88,
    latency: 0.9,
    risk: 0.72,
    compliance: 0.74,
  },
  "provider:gemini-app": {
    capabilityFit: 0.86,
    proofHistory: 0.62,
    cost: 0.82,
    latency: 0.9,
    risk: 0.7,
    compliance: 0.74,
  },
  "provider:v0": {
    capabilityFit: 0.9,
    proofHistory: 0.56,
    cost: 0.62,
    latency: 0.9,
    risk: 0.6,
    compliance: 0.62,
  },
  "provider:orbit": {
    capabilityFit: 0.88,
    proofHistory: 0.86,
    cost: 0.84,
    latency: 0.84,
    risk: 0.88,
    compliance: 0.92,
  },
  "provider:lovable": {
    capabilityFit: 0.82,
    proofHistory: 0.42,
    cost: 0.66,
    latency: 0.86,
    risk: 0.58,
    compliance: 0.58,
  },
  "provider:claude-design": {
    capabilityFit: 0.84,
    proofHistory: 0.5,
    cost: 0.6,
    latency: 0.68,
    risk: 0.64,
    compliance: 0.66,
  },
  "provider:claude-review": {
    capabilityFit: 0.72,
    proofHistory: 0.58,
    cost: 0.62,
    latency: 0.62,
    risk: 0.68,
    compliance: 0.7,
  },
  "provider:figma-stitch": {
    capabilityFit: 0.86,
    proofHistory: 0.52,
    cost: 0.58,
    latency: 0.62,
    risk: 0.66,
    compliance: 0.68,
  },
  "provider:vercel": {
    capabilityFit: 0.76,
    proofHistory: 0.62,
    cost: 0.64,
    latency: 0.82,
    risk: 0.64,
    compliance: 0.66,
  },
  "provider:github": {
    capabilityFit: 0.82,
    proofHistory: 0.88,
    cost: 0.82,
    latency: 0.74,
    risk: 0.78,
    compliance: 0.9,
  },
  "provider:linear": {
    capabilityFit: 0.68,
    proofHistory: 0.72,
    cost: 0.84,
    latency: 0.8,
    risk: 0.78,
    compliance: 0.82,
  },
  "provider:graph-rag": {
    capabilityFit: 0.88,
    proofHistory: 0.86,
    cost: 0.84,
    latency: 0.78,
    risk: 0.9,
    compliance: 0.92,
  },
  "provider:browser-playwright": {
    capabilityFit: 0.78,
    proofHistory: 0.62,
    cost: 0.82,
    latency: 0.76,
    risk: 0.72,
    compliance: 0.7,
  },
  "provider:desksmith": {
    capabilityFit: 0.7,
    proofHistory: 0.36,
    cost: 0.62,
    latency: 0.74,
    risk: 0.54,
    compliance: 0.5,
  },
  "provider:patternfactory": {
    capabilityFit: 0.84,
    proofHistory: 0.78,
    cost: 0.82,
    latency: 0.68,
    risk: 0.84,
    compliance: 0.88,
  },
  "provider:harvestline": {
    capabilityFit: 0.86,
    proofHistory: 0.8,
    cost: 0.78,
    latency: 0.64,
    risk: 0.72,
    compliance: 0.86,
  },
  "provider:legofactory": {
    capabilityFit: 0.82,
    proofHistory: 0.76,
    cost: 0.82,
    latency: 0.66,
    risk: 0.8,
    compliance: 0.84,
  },
  "provider:governed-materializer": {
    capabilityFit: 0.9,
    proofHistory: 0.86,
    cost: 0.68,
    latency: 0.48,
    risk: 0.52,
    compliance: 0.9,
  },
};

export const prototypeBuilderRoutingSteps = [
  "DemandIngress",
  "CapabilityResolver",
  "RequiredCapabilities",
  "CandidateProviders",
  "ProviderScoring",
  "PrototypeBuilderToolbox",
  "BOM / Route",
  "ExecutionSurface",
  "ProofBoundary",
] as const;

export const prototypeBuilderProviders: PrototypeBuilderProvider[] = [
  {
    providerId: "provider:wdc-cli",
    label: "WDC CLI",
    lane: "governance_readback",
    role: "Authoritative route, boot, WorkBOM, claim, readback, A2A, and evidence lane.",
    capabilityFocus: [
      "capability:repo-admission",
      "capability:session-claim-coordination",
      "capability:project-tree",
      "capability:evidence-boundary-rendering",
    ],
    toolboxUse: "Selects the provider route and records the proof boundary before any builder output is trusted.",
    authState: "wdc_session_required",
    allowedActions: ["boot", "route-validate", "adaptive BOM", "readback", "claim/release"],
    blockedActions: ["raw provider promotion", "frontend-only runtime claim"],
    evidenceRequirements: ["session id", "task_bom_id", "route validation", "clean target repo"],
    handoffToWdc: "Already authoritative; other providers must hand evidence back here.",
    preferredWhen: "Any task may mutate code, create PRs, deploy, or claim proof.",
    fallbackTo: ["provider:github", "provider:graph-rag"],
    boundary: "diagnostic",
  },
  {
    providerId: "provider:v0",
    label: "v0",
    lane: "prototype_builder",
    role: "Fast React/Tailwind prototype builder and code-generation surface.",
    capabilityFocus: [
      "capability:prototype-generation",
      "capability:ui-porting",
      "capability:brand-rendering",
      "capability:evidence-boundary-rendering",
    ],
    toolboxUse: "Generate candidate UI, inspect preview, then export through PR/add-to-codebase before WDC import.",
    authState: "ready",
    allowedActions: ["generate candidate", "preview", "export branch", "open PR after WDC route"],
    blockedActions: ["claim runtime proof", "direct graph truth", "provider-first selection"],
    evidenceRequirements: ["chat URL", "version or PR", "screenshot", "source diff", "preview status"],
    handoffToWdc: "WDC CLI imports the PR/export into an isolated branch and applies proof gates.",
    preferredWhen: "Need high-speed interface exploration or component variants.",
    fallbackTo: ["provider:lovable", "provider:claude-design"],
    boundary: "candidate",
  },
  {
    providerId: "provider:lovable",
    label: "Lovable",
    lane: "prototype_builder",
    role: "Full-app prototype builder for UX exploration and interaction patterns.",
    capabilityFocus: [
      "capability:prototype-generation",
      "capability:ui-porting",
      "capability:brand-rendering",
    ],
    toolboxUse: "Generate full-page variants, capture structure and routes, then treat output as candidate evidence.",
    authState: "login_required",
    allowedActions: ["create project", "iterate design", "capture screenshot", "export candidate"],
    blockedActions: ["source-of-truth claims", "runtime proof", "unreviewed direct merge"],
    evidenceRequirements: ["project id", "public or authenticated URL", "export/PR", "candidate boundary"],
    handoffToWdc: "WDC CLI classifies output, maps capability coverage, and ports only selected patterns.",
    preferredWhen: "Need end-to-end app feel, layout alternatives, or product-story variants.",
    fallbackTo: ["provider:v0", "provider:figma-stitch"],
    boundary: "candidate",
  },
  {
    providerId: "provider:claude-design",
    label: "Claude Design",
    lane: "design_review",
    role: "Design critique, alternate information architecture, and concept synthesis lane.",
    capabilityFocus: [
      "capability:prototype-generation",
      "capability:brand-rendering",
      "capability:user-review",
    ],
    toolboxUse: "Review prototype quality and propose stronger interaction/visual patterns without becoming a gate.",
    authState: "login_required",
    allowedActions: ["design critique", "variant brief", "copy and hierarchy review"],
    blockedActions: ["blocking peer signoff unless restored", "fake approval", "claim promotion"],
    evidenceRequirements: ["review artifact", "explicit non-blocking boundary", "actionable findings"],
    handoffToWdc: "Findings become candidate backlog or WDC work items, not automatic proof.",
    preferredWhen: "Need taste, narrative, layout critique, and anti-generic-SaaS pressure.",
    fallbackTo: ["provider:figma-stitch", "provider:browser-playwright"],
    boundary: "candidate",
  },
  {
    providerId: "provider:figma-stitch",
    label: "Figma / Stitch",
    lane: "design_review",
    role: "Design-system, visual asset, and editable mockup toolbox.",
    capabilityFocus: [
      "capability:prototype-generation",
      "capability:brand-rendering",
      "capability:evidence-boundary-rendering",
    ],
    toolboxUse: "Convert sketches/screens to design-system candidates and align logo, tokens, spacing, and motion.",
    authState: "login_required",
    allowedActions: ["design file", "component inventory", "design-system review", "asset handoff"],
    blockedActions: ["code proof", "runtime proof", "claim-ready language"],
    evidenceRequirements: ["design file URL", "component list", "asset hashes", "porting notes"],
    handoffToWdc: "WDC CLI maps assets/components to BOM/Lego slots before code porting.",
    preferredWhen: "Need polished visual system, editable assets, or logo/design governance.",
    fallbackTo: ["provider:claude-design", "provider:v0"],
    boundary: "candidate",
  },
  {
    providerId: "provider:vercel",
    label: "Vercel",
    lane: "preview_deploy",
    role: "Preview/deployment package lane for Vercel projects and protected preview readback.",
    capabilityFocus: [
      "capability:preview",
      "capability:prototype-generation",
      "capability:evidence-boundary-rendering",
    ],
    toolboxUse: "Create preview deployments and fetch protected URLs, but only WDC readback can lift proof language.",
    authState: "token_required",
    allowedActions: ["preview deploy", "deployment logs", "protected URL fetch"],
    blockedActions: ["runtime-proof claim without WDC SHA/readback", "secret leakage", "direct production mutation by default"],
    evidenceRequirements: ["project id", "deployment id", "commit SHA", "deployment URL", "log status"],
    handoffToWdc: "Deployment refs feed WDC runtime/readback gates and EventSpine evidence bundles.",
    preferredWhen: "Need preview package, deploy diagnostics, or production deployment after explicit slice.",
    fallbackTo: ["provider:github", "provider:browser-playwright"],
    boundary: "diagnostic",
  },
  {
    providerId: "provider:github",
    label: "GitHub",
    lane: "source_control",
    role: "Branch, PR, checks, and L1 code-proof package lane.",
    capabilityFocus: [
      "capability:repo-admission",
      "capability:ui-porting",
      "capability:session-claim-coordination",
    ],
    toolboxUse: "Receives builder output as source diffs; PR and CI are code proof only.",
    authState: "ready",
    allowedActions: ["branch", "PR", "CI readback", "merge after gates"],
    blockedActions: ["runtime proof from merge only", "unreviewed source import"],
    evidenceRequirements: ["branch", "PR URL", "checks", "merge SHA"],
    handoffToWdc: "WDC CLI validates git state, PR status, deployed SHA, and runtime verification.",
    preferredWhen: "Any builder output is ready for code review and durable integration.",
    fallbackTo: ["provider:wdc-cli"],
    boundary: "diagnostic",
  },
  {
    providerId: "provider:graph-rag",
    label: "Graph/RAG",
    lane: "governance_readback",
    role: "Knowledge retrieval and historical pattern evidence lane.",
    capabilityFocus: [
      "capability:source-classification",
      "capability:pattern-extraction",
      "capability:evidence-boundary-rendering",
    ],
    toolboxUse: "Anchors provider decisions in WDC memory/graph/RAG before build actions.",
    authState: "wdc_session_required",
    allowedActions: ["srag.query", "kg_rag.query", "reason_deeply"],
    blockedActions: ["graph write", "claim mutation", "source-free provider selection"],
    evidenceRequirements: ["source ids", "reason quality", "route envelope"],
    handoffToWdc: "RAG evidence shapes WorkBOM and provider scoring; it does not prove runtime behavior.",
    preferredWhen: "Need platform strategy, patterns, or prior evidence before selecting a builder.",
    fallbackTo: ["provider:wdc-cli"],
    boundary: "diagnostic",
  },
  {
    providerId: "provider:browser-playwright",
    label: "Browser / Playwright",
    lane: "governance_readback",
    role: "Visual/DOM diagnostic lane for prototype and preview inspection.",
    capabilityFocus: [
      "capability:preview",
      "capability:candidate-validation",
      "capability:evidence-boundary-rendering",
    ],
    toolboxUse: "Reads visible prototype state and screenshots; never converts visuals into runtime proof.",
    authState: "ready",
    allowedActions: ["DOM readback", "screenshot", "visual diagnostic", "accessibility probe"],
    blockedActions: ["external side effect without approval", "proof promotion", "secret entry without explicit scope"],
    evidenceRequirements: ["URL", "visible state", "screenshot", "blocked/actionable finding"],
    handoffToWdc: "Visual diagnostics become candidate evidence for WDC review and PR acceptance gates.",
    preferredWhen: "Need to inspect v0/Lovable/Vercel previews or UI regressions.",
    fallbackTo: ["provider:wdc-cli"],
    boundary: "diagnostic",
  },
];

export function scoreProvider(input: ProviderScoreInput) {
  const weighted =
    input.capabilityFit * providerScoreWeights.capabilityFit +
    input.proofHistory * providerScoreWeights.proofHistory +
    input.compliance * providerScoreWeights.compliance +
    input.risk * providerScoreWeights.risk +
    input.latency * providerScoreWeights.latency +
    input.cost * providerScoreWeights.cost;

  return Math.round(weighted * 100);
}

export function scoreProviderById(providerId: ProviderId) {
  return scoreProvider(providerScoreProfiles[providerId]);
}

export function providerSupportsCapability(
  provider: CandidateProvider,
  capabilityId: CapabilityId,
) {
  return provider.providedCapabilities.includes(capabilityId);
}

export function capabilitiesForDemand(demand: ExampleDemand) {
  return requiredCapabilities.filter((capability) =>
    demand.requiredCapabilities.includes(capability.id),
  );
}

export function providersForDemand(demand: ExampleDemand) {
  return candidateProviders.filter((provider) => demand.candidateProviders.includes(provider.id));
}

export const capabilityAcceptanceGates = [
  {
    gate: "capability_first",
    passCondition: "Demand resolves to explicit RequiredCapabilities before route/tool selection.",
  },
  {
    gate: "provider_scoring",
    passCondition:
      "CandidateProviders are scored on fit, proof, cost, latency, risk, and compliance.",
  },
  {
    gate: "bom_route",
    passCondition: "Adaptive BOM / WorkBOM / TaskBOM closes dependencies before execution.",
  },
  {
    gate: "proof_boundary",
    passCondition: "Gemini UI separates candidate, diagnostic, runtime, and claim evidence.",
  },
  {
    gate: "no_frontend_promotion",
    passCondition: "Gemini App never promotes claims or performs graph writes.",
  },
] as const;
