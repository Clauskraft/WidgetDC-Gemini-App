export type ProofState = "candidate" | "diagnostic" | "runtime" | "claim";

export type CockpitStatus = "pass" | "watch" | "blocked" | "candidate";

export type CockpitPanelId =
  | "audit-factory-dashboard"
  | "capability-resolver"
  | "project-root-admission"
  | "graph-hygiene"
  | "pattern-harvest"
  | "agent-inventory"
  | "local-tool-capability"
  | "a2a-context-fold-timeline"
  | "proof-ledger"
  | "next-safe-action"
  | "sentinelqa-verdict";

export type CockpitPanel = {
  id: CockpitPanelId;
  title: string;
  status: CockpitStatus;
  proofState: ProofState;
  evidenceSource: string;
  proofBoundary: string;
  lastReadback: string;
  blockedReason: string | null;
  nextSafeAction: string;
  owner: string;
  metrics: Array<{ label: string; value: string; tone?: CockpitStatus | ProofState }>;
};

export type FlowNode = {
  id: string;
  label: string;
  proofState: ProofState;
  owner: string;
  evidenceSource: string;
};

export type FlowEdge = {
  from: string;
  to: string;
  guard: string;
};

export type FrontendGapBlock = {
  id: string;
  label: string;
  severity: "P0" | "P1" | "P2";
  status: "open" | "covered-by-existing-surface" | "implemented-in-this-slice";
  evidence: string;
  nextSafeAction: string;
};

export type UXProofBlock = {
  id: string;
  label: string;
  proofState: ProofState;
  boundary: string;
  forbiddenConfusion: string;
};

export type CockpitReadbackCandidate = {
  id: string;
  label: string;
  observed: string;
  evidenceLevel: ProofState;
  source: string;
  caveat: string;
};

export type AuditFactoryCockpitModel = {
  title: string;
  subtitle: string;
  claimBoundary: string;
  forbiddenLanguage: string[];
  batchAnchors: {
    auditForemanHandoff: string;
    sentinelQaReviewRequest: string;
    contextFoldTopic: string;
  };
  latestRuntimeReadback: {
    wdcBackend: "GREEN";
    backendSha: string;
    govMode: "enforce";
    eventSpine: "durable";
    capabilitiesActive: number;
    capabilitiesUnstable: number;
    capabilitiesOffline: number;
    capabilityReadbackNote: string;
  };
  routeTree: {
    nodes: FlowNode[];
    edges: FlowEdge[];
  };
  panels: CockpitPanel[];
  frontendGapBlocks: FrontendGapBlock[];
  cockpitReadbackCandidates: CockpitReadbackCandidate[];
  uxProofBlocks: UXProofBlock[];
  componentPlan: Array<{ component: string; purpose: string; status: string }>;
  dataContractPlan: Array<{ contract: string; requiredFields: string[]; boundary: string }>;
  qaPlan: Array<{ gate: string; test: string; evidence: string }>;
};

const lastReadback = "2026-07-04T11:23:50Z via WDC CLI status/readback";

const requiredPanels: CockpitPanelId[] = [
  "audit-factory-dashboard",
  "capability-resolver",
  "project-root-admission",
  "graph-hygiene",
  "pattern-harvest",
  "agent-inventory",
  "local-tool-capability",
  "a2a-context-fold-timeline",
  "proof-ledger",
  "next-safe-action",
  "sentinelqa-verdict",
];

export const auditFactoryCockpitModel: AuditFactoryCockpitModel = {
  title: "Audit Factory Cockpit",
  subtitle:
    "A calm WDC frontend readback surface for capability discovery, orchestration, proof visibility, graph gaps and next safe actions.",
  claimBoundary:
    "Gemini App is a UX/cockpit/readback surface. WDC CLI and Agent Office remain the authority. Candidate, diagnostic, runtime and claim evidence are separate.",
  forbiddenLanguage: [
    "world-class complete",
    "runtime-proven",
    "all repos orchestratable",
    "graph gaps closed",
    "fully autonomous",
  ],
  batchAnchors: {
    auditForemanHandoff: "a2a:fbf97570bfb5",
    sentinelQaReviewRequest: "a2a:5df2194e3801",
    contextFoldTopic: "full-system-audit-factory-readonly-fold",
  },
  latestRuntimeReadback: {
    wdcBackend: "GREEN",
    backendSha: "3353db0e901c",
    govMode: "enforce",
    eventSpine: "durable",
    capabilitiesActive: 431,
    capabilitiesUnstable: 1,
    capabilitiesOffline: 0,
    capabilityReadbackNote:
      "Latest WDC readback supersedes the older batch anchor of 440 active / 0 unstable / 0 offline; graph.overflow_retention_readback is currently unstable.",
  },
  routeTree: {
    nodes: [
      {
        id: "demand",
        label: "DemandIngress",
        proofState: "diagnostic",
        owner: "operator",
        evidenceSource: "user demand + WDC route validation",
      },
      {
        id: "governance",
        label: "HyperAgent / Governance Gate",
        proofState: "claim",
        owner: "WDC Agent Office",
        evidenceSource: "WDC boot/session/claim gates",
      },
      {
        id: "inventor",
        label: "Inventor Opportunity Scan",
        proofState: "candidate",
        owner: "AuditForeman",
        evidenceSource: "batch anchor and read-only scan",
      },
      {
        id: "hydration",
        label: "Intelligence Stack Hydration",
        proofState: "diagnostic",
        owner: "WDC CLI",
        evidenceSource: "intent, RAG, memory, graph readback",
      },
      {
        id: "capability",
        label: "CapabilityResolver",
        proofState: "diagnostic",
        owner: "WDC CLI",
        evidenceSource: "capability-first route contract",
      },
      {
        id: "required",
        label: "RequiredCapabilities",
        proofState: "diagnostic",
        owner: "WDC CLI",
        evidenceSource: "required/provided competence model",
      },
      {
        id: "providers",
        label: "CandidateProviders",
        proofState: "candidate",
        owner: "cockpit",
        evidenceSource: "candidate inventory only",
      },
      {
        id: "scoring",
        label: "ProviderScoring",
        proofState: "candidate",
        owner: "cockpit",
        evidenceSource: "scoring projection only",
      },
      {
        id: "bom",
        label: "WorkBOM / AgentTeamBOM / Route",
        proofState: "diagnostic",
        owner: "WDC Agent Office",
        evidenceSource: "WorkBOM and route readback",
      },
      {
        id: "execution",
        label: "Execution Surface",
        proofState: "claim",
        owner: "WDC Agent Office",
        evidenceSource: "claim-gated execution only",
      },
      {
        id: "project",
        label: "ProjectTree",
        proofState: "diagnostic",
        owner: "cockpit",
        evidenceSource: "ProjectTree refs CFG/BOM/OP/GATE",
      },
      {
        id: "proof",
        label: "ProofReceipt",
        proofState: "runtime",
        owner: "SentinelQA",
        evidenceSource: "requires deployed SHA + 3 passes",
      },
      {
        id: "eventspine",
        label: "EventSpine / Readback",
        proofState: "runtime",
        owner: "WDC backend",
        evidenceSource: "EventSpine durable readback",
      },
      {
        id: "fold",
        label: "ContextFold",
        proofState: "diagnostic",
        owner: "WDC Agent Office",
        evidenceSource: "context fold topic anchor",
      },
      {
        id: "a2a",
        label: "A2A Handoff",
        proofState: "diagnostic",
        owner: "AuditForeman",
        evidenceSource: "A2A ids and inbox readback",
      },
      {
        id: "sentinel",
        label: "SentinelQA",
        proofState: "claim",
        owner: "SentinelQA",
        evidenceSource: "review verdict required",
      },
    ],
    edges: [
      { from: "demand", to: "governance", guard: "governance before execution" },
      { from: "governance", to: "inventor", guard: "candidate scan only" },
      { from: "inventor", to: "hydration", guard: "hydrate before planning" },
      { from: "hydration", to: "capability", guard: "capability resolver first" },
      { from: "capability", to: "required", guard: "required capabilities before providers" },
      { from: "required", to: "providers", guard: "no direct demand-to-provider route" },
      { from: "providers", to: "scoring", guard: "candidate scoring only" },
      { from: "scoring", to: "bom", guard: "BOM before route execution" },
      { from: "bom", to: "execution", guard: "claim-gated execution" },
      { from: "execution", to: "project", guard: "ProjectTree framing" },
      { from: "project", to: "proof", guard: "proof receipt required" },
      { from: "proof", to: "eventspine", guard: "runtime readback required" },
      { from: "eventspine", to: "fold", guard: "fold after evidence" },
      { from: "fold", to: "a2a", guard: "handoff after fold" },
      { from: "a2a", to: "sentinel", guard: "SentinelQA before stronger claims" },
    ],
  },
  panels: [
    {
      id: "audit-factory-dashboard",
      title: "Audit Factory Dashboard",
      status: "watch",
      proofState: "runtime",
      evidenceSource: "WDC CLI status readback",
      proofBoundary: "Runtime health is readback; cockpit display is not WDC authority.",
      lastReadback,
      blockedReason: "One capability is unstable.",
      nextSafeAction: "Keep the unstable capability visible and route remediation through WDC CLI.",
      owner: "AuditForeman",
      metrics: [
        { label: "backend", value: "GREEN", tone: "pass" },
        { label: "sha", value: "3353db0e901c", tone: "runtime" },
        { label: "gov", value: "enforce", tone: "pass" },
        { label: "EventSpine", value: "durable", tone: "pass" },
      ],
    },
    {
      id: "capability-resolver",
      title: "Capability Resolver View",
      status: "watch",
      proofState: "diagnostic",
      evidenceSource: "capability-first route contract",
      proofBoundary: "RequiredCapabilities must be visible before CandidateProviders.",
      lastReadback,
      blockedReason: "Provider candidates are projections until WDC execution approval exists.",
      nextSafeAction: "Render RequiredCapabilities, then candidate providers, then scoring.",
      owner: "WDC CLI",
      metrics: [
        { label: "active", value: "431", tone: "pass" },
        { label: "unstable", value: "1", tone: "watch" },
        { label: "offline", value: "0", tone: "pass" },
      ],
    },
    {
      id: "project-root-admission",
      title: "Project Root Admission View",
      status: "blocked",
      proofState: "candidate",
      evidenceSource: "batch anchor from objective; requires fresh WDC readback",
      proofBoundary:
        "Repo admission counts are candidate until refreshed by WDC project-root readback.",
      lastReadback: "batch anchor from pasted objective",
      blockedReason: "Cleanup allowed is false and 23 normalization blockers are reported.",
      nextSafeAction: "Refresh admission through WDC CLI before any cleanup or repo mutation.",
      owner: "AuditForeman",
      metrics: [
        { label: "repos", value: "57", tone: "candidate" },
        { label: "clean", value: "45", tone: "candidate" },
        { label: "dirty", value: "12", tone: "blocked" },
        { label: "duplicates", value: "9", tone: "blocked" },
      ],
    },
    {
      id: "graph-hygiene",
      title: "Graph Hygiene View",
      status: "blocked",
      proofState: "diagnostic",
      evidenceSource: "graph gap anchors from objective",
      proofBoundary: "Graph gaps are not closed by rendering them in the frontend.",
      lastReadback: "batch anchor from pasted objective",
      blockedReason: "Multiple graph relation gaps remain at zero coverage.",
      nextSafeAction: "Route gap closure through governed WDC graph read/write plans.",
      owner: "WDC graph lane",
      metrics: [
        { label: "BOMItem->ExecutionSurface", value: "0/315", tone: "blocked" },
        { label: "BOMItem->WorkArtifact missing", value: "308/315", tone: "blocked" },
        { label: "Capability->ConsultingFlow", value: "0/1219", tone: "blocked" },
        { label: "Tool/Provider->Competence", value: "0/2032", tone: "blocked" },
      ],
    },
    {
      id: "pattern-harvest",
      title: "Pattern Harvest View",
      status: "blocked",
      proofState: "candidate",
      evidenceSource: "batch anchor from objective",
      proofBoundary: "Pattern candidates are not graph truth until materialized and read back.",
      lastReadback: "batch anchor from pasted objective",
      blockedReason: "PatternCandidate count is 0.",
      nextSafeAction: "Show candidate harvest debt and require governed materialization.",
      owner: "AuditForeman",
      metrics: [
        { label: "PatternCandidate", value: "0", tone: "blocked" },
        { label: "ConsultingFlow->AgenticPattern", value: "0/825", tone: "blocked" },
      ],
    },
    {
      id: "agent-inventory",
      title: "Agent / Subagent Inventory View",
      status: "blocked",
      proofState: "candidate",
      evidenceSource: "batch anchor from objective",
      proofBoundary: "Agent candidates are inventory, not execution authority.",
      lastReadback: "batch anchor from pasted objective",
      blockedReason: "757/759 Agent or AgentBlock entries lack CompetenceDefinition.",
      nextSafeAction: "Render missing competence definitions before recommending subagents.",
      owner: "AuditForeman",
      metrics: [{ label: "missing competence", value: "757/759", tone: "blocked" }],
    },
    {
      id: "local-tool-capability",
      title: "Local Tool Capability View",
      status: "watch",
      proofState: "candidate",
      evidenceSource: "local projects scan scope",
      proofBoundary: "Local tools are detected only, not probed or executed.",
      lastReadback: "batch anchor from pasted objective",
      blockedReason: "No tool probe evidence is attached.",
      nextSafeAction: "Keep local tool rows candidate-only until WDC tool probe readback exists.",
      owner: "cockpit",
      metrics: [
        { label: "execution", value: "0", tone: "pass" },
        { label: "probe", value: "not run", tone: "watch" },
      ],
    },
    {
      id: "a2a-context-fold-timeline",
      title: "A2A / Context Fold Timeline",
      status: "watch",
      proofState: "diagnostic",
      evidenceSource: "objective anchors and WDC A2A handoff",
      proofBoundary: "A2A and folds are process evidence, not lifecycle closure proof.",
      lastReadback,
      blockedReason:
        "Release of session:f05e736480c0 failed with unknown session and must not be shown as closure proof.",
      nextSafeAction: "Display failed release as an unresolved lifecycle caveat.",
      owner: "AuditForeman",
      metrics: [
        { label: "AuditForeman", value: "a2a:fbf97570bfb5", tone: "diagnostic" },
        { label: "SentinelQA", value: "a2a:5df2194e3801", tone: "diagnostic" },
        { label: "fold", value: "full-system-audit-factory-readonly-fold", tone: "diagnostic" },
      ],
    },
    {
      id: "proof-ledger",
      title: "Proof Ledger",
      status: "watch",
      proofState: "runtime",
      evidenceSource: "WDC status and objective proof boundaries",
      proofBoundary:
        "No deploy during validation; deploy only in explicit remediation slices. Runtime proof requires deployed SHA match plus three consecutive passes.",
      lastReadback,
      blockedReason:
        "PR #6837 deployed SHA now matches the merge SHA, but no 3-pass runtime verification evidence is attached.",
      nextSafeAction:
        "Keep #6837 at L1/code-proven until SentinelQA records three consecutive runtime passes and WDC proof boundary readback.",
      owner: "SentinelQA",
      metrics: [
        { label: "deployed SHA", value: "3353db0e901c", tone: "runtime" },
        { label: "runtime passes", value: "0/3", tone: "watch" },
        { label: "deploy policy", value: "explicit remediation slice only", tone: "watch" },
      ],
    },
    {
      id: "next-safe-action",
      title: "Next Safe Action Panel",
      status: "watch",
      proofState: "diagnostic",
      evidenceSource: "objective and WDC process gates",
      proofBoundary: "Next actions are guidance; WDC CLI remains authority.",
      lastReadback,
      blockedReason: "Frontend repo must be implemented in isolated branch/worktree.",
      nextSafeAction:
        "Implement read-only cockpit panels, verify, PR, then request SentinelQA review.",
      owner: "wdc-frontend-cockpit-agent",
      metrics: [
        { label: "graph writes", value: "0", tone: "pass" },
        { label: "provider executions", value: "0", tone: "pass" },
        { label: "claim promotions", value: "0", tone: "pass" },
      ],
    },
    {
      id: "sentinelqa-verdict",
      title: "SentinelQA Verdict Panel",
      status: "blocked",
      proofState: "claim",
      evidenceSource: "SentinelQA review request anchor",
      proofBoundary: "SentinelQA request is not a PASS verdict.",
      lastReadback: "a2a:5df2194e3801 from objective",
      blockedReason: "No SentinelQA PASS/HOLD/BLOCKED verdict is attached.",
      nextSafeAction: "Request SentinelQA after implementation and focused proof gates.",
      owner: "SentinelQA",
      metrics: [{ label: "verdict", value: "pending", tone: "blocked" }],
    },
  ],
  frontendGapBlocks: [
    {
      id: "unified-dashboard",
      label: "Unified Audit Factory Dashboard route",
      severity: "P0",
      status: "implemented-in-this-slice",
      evidence: "AuditFactoryCockpit component and /audit-factory route",
      nextSafeAction: "Keep route read-only and source-labeled.",
    },
    {
      id: "live-wdc-binding",
      label: "Live WDC status binding",
      severity: "P1",
      status: "open",
      evidence: "Static latest readback embedded for this slice",
      nextSafeAction: "Add server readback endpoint after authority and caching contract.",
    },
    {
      id: "project-root-admission",
      label: "Project root admission contract",
      severity: "P0",
      status: "implemented-in-this-slice",
      evidence:
        "Panel renders admitted/clean/dirty/duplicate/blocker anchors with candidate boundary.",
      nextSafeAction: "Refresh through WDC CLI before any cleanup operation.",
    },
    {
      id: "graph-gap-visibility",
      label: "Graph gap visibility",
      severity: "P0",
      status: "implemented-in-this-slice",
      evidence: "Graph Hygiene panel renders zero-coverage gaps and timeout caveat.",
      nextSafeAction: "Route gap closure through governed graph plan.",
    },
    {
      id: "sentinelqa-verdict",
      label: "SentinelQA verdict surface",
      severity: "P0",
      status: "implemented-in-this-slice",
      evidence: "SentinelQA panel shows request-only and blocks PASS language.",
      nextSafeAction: "Attach PASS/HOLD/BLOCKED only from SentinelQA readback.",
    },
  ],
  cockpitReadbackCandidates: [
    {
      id: "wdc-status",
      label: "WDC backend GREEN",
      observed: "GREEN",
      evidenceLevel: "runtime",
      source: "wdc status --json",
      caveat: "Runtime health is not frontend authority.",
    },
    {
      id: "capability-count",
      label: "Capabilities",
      observed: "431 active / 1 unstable / 0 offline",
      evidenceLevel: "runtime",
      source: "wdc status --json",
      caveat: "Differs from older batch anchor 440/0/0.",
    },
    {
      id: "repo-admission",
      label: "Repo admission",
      observed: "57 total / 45 clean / 12 dirty / 9 duplicates",
      evidenceLevel: "candidate",
      source: "objective batch anchor",
      caveat: "Needs fresh WDC project-root readback before action.",
    },
    {
      id: "signal-corpus",
      label: "Signal corpus",
      observed: "23,321 dirs / 2,534 signal dirs / 4,561 signal files",
      evidenceLevel: "candidate",
      source: "objective batch anchor",
      caveat: "Discovered only; content not validated.",
    },
    {
      id: "graph-gaps",
      label: "Graph gaps",
      observed: "Multiple zero-coverage relation gaps",
      evidenceLevel: "diagnostic",
      source: "objective batch anchor",
      caveat: "Orphan totals are unverified because broad orphan query timed out.",
    },
  ],
  uxProofBlocks: [
    {
      id: "candidate-vs-runtime",
      label: "Candidate does not equal runtime",
      proofState: "candidate",
      boundary: "Candidate rows are projection/inventory only.",
      forbiddenConfusion: "Do not render candidate evidence with runtime styling.",
    },
    {
      id: "frontend-vs-authority",
      label: "Frontend does not equal authority",
      proofState: "diagnostic",
      boundary: "WDC CLI / Agent Office remains authority.",
      forbiddenConfusion: "Do not make cockpit recommendations look like WDC commands.",
    },
    {
      id: "proof-vs-claim",
      label: "Proof does not equal claim promotion",
      proofState: "claim",
      boundary: "Claim promotion requires governed WDC process.",
      forbiddenConfusion: "Do not expose claim promotion from UI.",
    },
  ],
  componentPlan: [
    {
      component: "AuditFactoryCockpit",
      purpose: "Unified cockpit route with route tree, panels, proof ledger and next safe action.",
      status: "implemented-in-this-slice",
    },
    {
      component: "AuditFactoryPanelCard",
      purpose: "Shared panel card rendering status, source, boundary and action.",
      status: "implemented-in-this-slice",
    },
    {
      component: "SentinelQAVerdictPanel",
      purpose: "Render PASS/HOLD/BLOCKED only from evidence.",
      status: "implemented as pending/request-only block",
    },
  ],
  dataContractPlan: [
    {
      contract: "AuditFactoryCockpitModel",
      requiredFields: ["routeTree", "panels", "claimBoundary", "forbiddenLanguage"],
      boundary: "Model data is cockpit readback/candidate evidence, not graph truth.",
    },
    {
      contract: "CockpitPanel",
      requiredFields: [
        "status",
        "evidenceSource",
        "proofBoundary",
        "lastReadback",
        "blockedReason",
        "nextSafeAction",
      ],
      boundary: "Every panel must expose proof boundary and next action.",
    },
    {
      contract: "CockpitReadbackCandidate",
      requiredFields: ["observed", "evidenceLevel", "source", "caveat"],
      boundary: "Candidate anchors must declare caveats.",
    },
  ],
  qaPlan: [
    {
      gate: "panel coverage",
      test: "All required panels are present.",
      evidence: "auditFactoryCockpit.test.ts",
    },
    {
      gate: "capability-first routing",
      test: "RequiredCapabilities appears before CandidateProviders.",
      evidence: "auditFactoryCockpit.test.ts",
    },
    {
      gate: "overclaim guard",
      test: "Forbidden claim language is listed as forbidden, not used as status.",
      evidence: "auditFactoryCockpit.test.ts",
    },
    {
      gate: "SSR visibility",
      test: "Route tree, panels, proof boundary and next action render server-side.",
      evidence: "AuditFactoryCockpit.ssr.test.tsx",
    },
  ],
};

export function getAuditFactoryCockpitModel() {
  return auditFactoryCockpitModel;
}

export function getRequiredPanelIds() {
  return requiredPanels;
}

export function validateAuditFactoryCockpit(model: AuditFactoryCockpitModel) {
  const failures: string[] = [];
  const panelIds = new Set(model.panels.map((panel) => panel.id));
  for (const id of requiredPanels) {
    if (!panelIds.has(id)) failures.push(`missing panel ${id}`);
  }
  for (const panel of model.panels) {
    if (!panel.evidenceSource.trim()) failures.push(`${panel.id} missing evidence source`);
    if (!panel.proofBoundary.trim()) failures.push(`${panel.id} missing proof boundary`);
    if (!panel.lastReadback.trim()) failures.push(`${panel.id} missing last readback`);
    if (!panel.nextSafeAction.trim()) failures.push(`${panel.id} missing next safe action`);
  }
  const routeIds = model.routeTree.nodes.map((node) => node.id);
  const requiredIndex = routeIds.indexOf("required");
  const providerIndex = routeIds.indexOf("providers");
  if (requiredIndex < 0 || providerIndex < 0 || requiredIndex > providerIndex) {
    failures.push("RequiredCapabilities must appear before CandidateProviders");
  }
  if (model.panels.some((panel) => panel.title.toLowerCase().includes("frontend authority"))) {
    failures.push("frontend must not be represented as authority");
  }
  if (!model.claimBoundary.includes("WDC CLI and Agent Office remain the authority")) {
    failures.push("claim boundary must name WDC CLI and Agent Office as authority");
  }
  if (model.latestRuntimeReadback.capabilitiesUnstable === 0) {
    failures.push("latest readback must not hide current unstable capability");
  }
  if (
    !model.latestRuntimeReadback.capabilityReadbackNote.includes(
      "supersedes the older batch anchor",
    )
  ) {
    failures.push("stale capability anchor mismatch must stay visible");
  }
  return { ok: failures.length === 0, failures };
}
