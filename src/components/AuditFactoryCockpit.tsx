import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  ShieldCheck,
} from "lucide-react";

type ProofBoundary = "candidate" | "diagnostic" | "runtime" | "claim";

type PanelStatus = "verified" | "candidate" | "blocked" | "mismatch" | "pending";

type CockpitPanel = {
  title: string;
  status: PanelStatus;
  evidenceSource: string;
  proofBoundary: ProofBoundary;
  lastReadback: string;
  blockedReason: string;
  nextSafeAction: string;
  owner: string;
  items: string[];
};

type AuditLoopCockpitViewModel = {
  taskBOM: string;
  phantomBOMRun: string;
  loop: {
    current: number;
    max: number;
    status: "running" | "converged" | "blocked";
  };
  bomItems: Array<{
    label: string;
    status: PanelStatus;
    evidence: string;
    next: string;
  }>;
  evidenceGates: string[];
  stopConditions: string[];
  providerHealth: string;
  canaryState: string;
  claimMaturity: string;
  routeEnvelope: string;
  criticalQuestions: Array<{
    question: string;
    trigger: string;
  }>;
};

const proofClasses: Array<{ label: ProofBoundary; description: string }> = [
  {
    label: "candidate",
    description: "Projection, fixture, plan, or UI candidate. Never graph truth.",
  },
  {
    label: "diagnostic",
    description: "Local or CLI readback that helps an operator decide safely.",
  },
  {
    label: "runtime",
    description: "Deployed WDC service readback with explicit source and timestamp.",
  },
  {
    label: "claim",
    description: "Promotion-grade proof. This cockpit does not create it.",
  },
];

const auditLoopCockpitViewModel: AuditLoopCockpitViewModel = {
  taskBOM: "taskbom:adaptive:5ab30cbca68c",
  phantomBOMRun: "phantombomrun:adaptive:5ab30cbca68c",
  loop: {
    current: 2,
    max: 100,
    status: "running",
  },
  bomItems: [
    {
      label: "PatternFinder",
      status: "verified",
      evidence: "WDC status, route-validate, adaptive_bom.compose, SRAG/KG RAG",
      next: "Keep Runtime Truth Verification and Evidence-Gated Claim Control visible.",
    },
    {
      label: "LintFixer",
      status: "verified",
      evidence: "WDC frontend lint-fix plus capability-cockpit, lint, build, and unit gates",
      next: "Re-run gates after every cockpit UI mutation.",
    },
    {
      label: "CriticalQuestioner",
      status: "candidate",
      evidence: "Five product/system questions from read-only WDC anchors",
      next: "Convert weak answers into specific candidate UI changes.",
    },
    {
      label: "SentinelQA",
      status: "pending",
      evidence: "Open A2A review request remains non-blocking until restored as gate",
      next: "Ask for review after local candidate evidence is durable.",
    },
  ],
  evidenceGates: [
    "capability-cockpit PASS",
    "lint PASS",
    "build PASS with dependency warnings",
    "unit PASS: 50 files / 300 tests",
    "graph_writes=0, railway_mutations=0, claim_mutations=0",
  ],
  stopConditions: [
    "route validation invalid",
    "Adaptive BOM not staging-only",
    "reason quality below 0.75",
    "graph write or claim mutation required",
    "no deterministic next safe action",
  ],
  providerHealth: "WDC backend GREEN; EventSpine durable; provider degradation must stay visible.",
  canaryState: "A6 v2 PhantomBOM lineage canary green is a monitored gate, not broad success.",
  claimMaturity: "L1 candidate ceiling; no runtime/adoption/claim language is allowed here.",
  routeEnvelope: "RLM/MCP candidate route, source-grounded, projection-only.",
  criticalQuestions: [
    {
      question: "Can a first-time user understand the cockpit's job in 10 seconds?",
      trigger: "If no, simplify the hero promise and expose one primary path.",
    },
    {
      question: "Does every visible action map to a governed WDC evidence path?",
      trigger: "If no, disable or label orphan actions as not yet governed.",
    },
    {
      question: "Is intent-to-evidence physically short: input, route, evidence?",
      trigger: "If no, collapse ceremony into a guided candidate flow.",
    },
    {
      question: "Are diagnostic, runtime, and claim boundaries impossible to confuse?",
      trigger: "If no, downgrade ambiguous copy and add proof-level badges.",
    },
    {
      question: "Can the surface absorb hundreds of tools without redesign?",
      trigger: "If no, add a capability browser backed by metadata and safe defaults.",
    },
  ],
};

const routeFlow = [
  "DemandIngress",
  "HyperAgent / Governance Gate",
  "Inventor Opportunity Scan",
  "Intelligence Stack Hydration",
  "CapabilityResolver",
  "RequiredCapabilities",
  "CandidateProviders",
  "ProviderScoring",
  "WorkBOM / AgentTeamBOM / Route",
  "Execution Surface",
  "ProjectTree",
  "ProofReceipt",
  "EventSpine / Readback",
  "ContextFold",
  "A2A Handoff",
  "SentinelQA",
];

const readbackPanels: CockpitPanel[] = [
  {
    title: "Current WDC status",
    status: "mismatch",
    evidenceSource: "Canonical WDC CLI status from C:/Users/claus/Projetcs/WidgeTDC",
    proofBoundary: "runtime",
    lastReadback: "2026-07-03 canonical readback",
    blockedReason:
      "Batch anchor lists backend 6724bd4808c3 and 440 capabilities, while canonical readback shows backend a6c39c56a636 and 418 active capabilities.",
    nextSafeAction:
      "Show both values and require fresh WDC readback before repeating batch numbers.",
    owner: "WDC CLI / Agent Office",
    items: [
      "Backend: GREEN",
      "Canonical backend SHA: a6c39c56a636",
      "GOV mode: enforce",
      "EventSpine: durable",
      "Capabilities: 418 active / 0 unstable / 0 offline",
    ],
  },
  {
    title: "Active audit batch",
    status: "candidate",
    evidenceSource: "AuditForeman handoff a2a:fbf97570bfb5 and context fold topic",
    proofBoundary: "diagnostic",
    lastReadback: "Pasted audit-factory brief",
    blockedReason:
      "Batch values are operator-provided and not all refreshed through canonical readback in this UI slice.",
    nextSafeAction:
      "Hydrate batch state through WDC CLI before presenting it as current runtime status.",
    owner: "AuditForeman",
    items: [
      "Context fold: full-system-audit-factory-readonly-fold",
      "SentinelQA request: a2a:5df2194e3801",
      "Cleanup allowed: false",
      "Release session:f05e736480c0 is not lifecycle closure proof",
    ],
  },
  {
    title: "Project root admission",
    status: "blocked",
    evidenceSource: "Audit batch readback candidate",
    proofBoundary: "diagnostic",
    lastReadback: "Pasted audit-factory brief",
    blockedReason:
      "23 normalization blockers and 9 duplicate candidates prevent cleanup or broad admission claims.",
    nextSafeAction:
      "Use WDC repo admission gate before any local repo mutation or cleanup proposal.",
    owner: "Project Root Admission Gate",
    items: [
      "57 repos total",
      "45 clean / 12 dirty",
      "16 ahead / 11 behind",
      "9 duplicate candidates",
      "5 admitted",
    ],
  },
  {
    title: "Signal corpus",
    status: "candidate",
    evidenceSource: "Readonly projects scan scope",
    proofBoundary: "diagnostic",
    lastReadback: "Pasted audit-factory brief",
    blockedReason: "Signal files are discovered only; content has not been validated.",
    nextSafeAction: "Promote only directories/files with source validation and evidence handles.",
    owner: "Signal Harvest",
    items: [
      "23,321 directories seen",
      "20,000 visited cap",
      "2,534 signal dirs",
      "4,561 signal files",
    ],
  },
  {
    title: "Graph hygiene gaps",
    status: "blocked",
    evidenceSource: "Audit batch graph-gap readback",
    proofBoundary: "diagnostic",
    lastReadback: "Pasted audit-factory brief",
    blockedReason:
      "Large relation gaps remain open; orphan totals are unverified due to broad query timeout.",
    nextSafeAction:
      "Use scoped graph readback and candidate materializers; do not claim gap closure.",
    owner: "Graph Hygiene / SentinelQA",
    items: [
      "BOMItem to ExecutionSurface: 0/315",
      "BOMItem to WorkArtifact missing: 308/315",
      "Capability to ConsultingFlow: 0/1219",
      "Tool or Provider to CompetenceDefinition: 0/2032",
      "Agent or AgentBlock without CompetenceDefinition: 757/759",
    ],
  },
  {
    title: "Capability and pattern candidates",
    status: "candidate",
    evidenceSource: "Capability-first route and audit-factory prompt",
    proofBoundary: "candidate",
    lastReadback: "Current UI projection",
    blockedReason:
      "PatternCandidate count is 0; candidates must not be displayed as adopted patterns.",
    nextSafeAction: "Resolve required capabilities before showing candidate providers or agents.",
    owner: "CapabilityResolver",
    items: [
      "RequiredCapabilities before CandidateProviders",
      "ProviderScoring before route",
      "Pattern candidates need evidence source",
      "Local tools are detected only, not probed",
    ],
  },
  {
    title: "Proof receipts and A2A",
    status: "pending",
    evidenceSource: "A2A handoff ids and proof ledger candidate",
    proofBoundary: "diagnostic",
    lastReadback: "A2A ids from audit-factory brief",
    blockedReason: "Frontend can display receipts; it cannot manufacture proof or signoff.",
    nextSafeAction: "Route follow-up evidence to AuditForeman and SentinelQA through WDC A2A.",
    owner: "A2A / SentinelQA",
    items: [
      "AuditForeman: a2a:fbf97570bfb5",
      "SentinelQA: a2a:5df2194e3801",
      "ContextFold: full-system-audit-factory-readonly-fold",
      "ProofReceipt remains candidate until WDC readback is attached",
    ],
  },
];

const surfaces = [
  "Audit Factory Dashboard",
  "Capability Resolver View",
  "Project Root Admission View",
  "Graph Hygiene View",
  "Pattern Harvest View",
  "Agent / Subagent Inventory View",
  "Local Tool Capability View",
  "A2A / Context Fold Timeline",
  "Proof Ledger",
  "Next Safe Action Panel",
  "SentinelQA Verdict Panel",
];

const dataContract = [
  "status",
  "evidence_source",
  "proof_boundary",
  "last_readback",
  "blocked_reason",
  "next_safe_action",
  "owner_agent",
  "readback_mismatch",
];

const statusTone: Record<PanelStatus, string> = {
  verified: "border-emerald-200 bg-emerald-50 text-emerald-900",
  candidate: "border-sky-200 bg-sky-50 text-sky-950",
  blocked: "border-rose-200 bg-rose-50 text-rose-950",
  mismatch: "border-amber-200 bg-amber-50 text-amber-950",
  pending: "border-stone-200 bg-stone-50 text-stone-900",
};

const boundaryTone: Record<ProofBoundary, string> = {
  candidate: "bg-sky-100 text-sky-800 ring-sky-200",
  diagnostic: "bg-stone-100 text-stone-800 ring-stone-200",
  runtime: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  claim: "bg-amber-100 text-amber-900 ring-amber-200",
};

function StatusIcon({ status }: { status: PanelStatus }) {
  if (status === "verified") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "blocked" || status === "mismatch") return <AlertTriangle className="h-4 w-4" />;
  if (status === "pending") return <Clock3 className="h-4 w-4" />;
  return <CircleDot className="h-4 w-4" />;
}

function BoundaryBadge({ boundary }: { boundary: ProofBoundary }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1 ${boundaryTone[boundary]}`}
    >
      {boundary}
    </span>
  );
}

function PanelCard({ panel }: { panel: CockpitPanel }) {
  return (
    <article className="rounded-[1.4rem] border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusTone[panel.status]}`}
          >
            <StatusIcon status={panel.status} />
            {panel.status}
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-stone-950">
            {panel.title}
          </h3>
        </div>
        <BoundaryBadge boundary={panel.proofBoundary} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm text-stone-700">
        <div>
          <dt className="font-semibold text-stone-950">Evidence source</dt>
          <dd>{panel.evidenceSource}</dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-950">Last readback</dt>
          <dd>{panel.lastReadback}</dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-950">Blocked reason</dt>
          <dd>{panel.blockedReason}</dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-950">Next safe action</dt>
          <dd>{panel.nextSafeAction}</dd>
        </div>
      </dl>
      <div className="mt-4 rounded-2xl bg-stone-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
          Owner: {panel.owner}
        </div>
        <ul className="mt-3 space-y-2 text-sm text-stone-700">
          {panel.items.map((item) => (
            <li className="flex gap-2" key={item}>
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function AuditFactoryCockpit() {
  return (
    <div className="min-h-full flex-1 overflow-y-auto bg-[#f7f4ed] text-stone-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm shadow-stone-200/80">
          <div className="grid gap-0 lg:grid-cols-[1fr_0.72fr]">
            <div className="p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                WDC audit factory cockpit
              </p>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-5xl">
                Make the factory understandable without making the frontend authoritative.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-stone-600">
                Gemini App is the calm readback surface for WDC capability discovery, audit
                progress, proof visibility, graph gaps, A2A handoffs, and next safe actions. WDC CLI
                and Agent Office remain the authority.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {proofClasses.map((item) => (
                  <BoundaryBadge boundary={item.label} key={item.label} />
                ))}
              </div>
            </div>
            <aside className="border-t border-stone-200 bg-stone-950 p-6 text-stone-100 lg:border-l lg:border-t-0 sm:p-8">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                <div>
                  <div className="text-sm font-semibold">Claim boundary</div>
                  <div className="text-xs text-stone-400">candidate/L1 cockpit readback</div>
                </div>
              </div>
              <div className="mt-6 space-y-3 text-sm leading-6 text-stone-300">
                <p>
                  No graph writes. No Railway mutation. No claim promotion. No provider execution.
                </p>
                <p>
                  Candidate, diagnostic, runtime, and claim states stay visually separate in every
                  panel.
                </p>
              </div>
            </aside>
          </div>
        </header>

        <section className="rounded-[1.5rem] border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/70">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Capability-first route tree</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Demand never jumps directly to a tool, provider, or agent. Required capabilities are
                shown before candidate providers.
              </p>
            </div>
            <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
              ProjectTree refs: CFG-010 / BOM-020 / OP-030 / GATE-040
            </div>
          </div>
          <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
            {routeFlow.map((step, index) => (
              <div className="flex shrink-0 items-center gap-3" key={step}>
                <div className="w-48 rounded-2xl border border-stone-200 bg-stone-50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-stone-800">{step}</div>
                </div>
                {index < routeFlow.length - 1 && <ArrowRight className="h-4 w-4 text-stone-300" />}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/70">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                AuditLoopCockpitViewModel
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                BOM and Lego state for the current loop
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                This read-only model makes the loop inspectable: TaskBOM, PhantomBOMRun, BOMItems,
                EvidenceGates, StopConditions, ProviderHealth, CanaryState, ClaimMaturity, and the
                CriticalQuestioner queue are visible before any stronger claim is allowed.
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-950">
              Loop {auditLoopCockpitViewModel.loop.current} / {auditLoopCockpitViewModel.loop.max}:
              {` ${auditLoopCockpitViewModel.loop.status}`}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["TaskBOM", auditLoopCockpitViewModel.taskBOM],
              ["PhantomBOMRun", auditLoopCockpitViewModel.phantomBOMRun],
              ["ClaimMaturity", auditLoopCockpitViewModel.claimMaturity],
              ["RouteEnvelope", auditLoopCockpitViewModel.routeEnvelope],
            ].map(([label, value]) => (
              <div className="rounded-2xl bg-stone-50 p-4" key={label}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                  {label}
                </div>
                <div className="mt-2 text-sm font-semibold leading-6 text-stone-800">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-stone-200 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                BOMItems
              </h3>
              <div className="mt-3 grid gap-3">
                {auditLoopCockpitViewModel.bomItems.map((item) => (
                  <div className="rounded-2xl bg-stone-50 p-4" key={item.label}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-stone-900">{item.label}</div>
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone[item.status]}`}
                      >
                        <StatusIcon status={item.status} />
                        <span className="ml-2">{item.status}</span>
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{item.evidence}</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-stone-800">
                      Next: {item.next}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">
                  EvidenceGates
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-emerald-950">
                  {auditLoopCockpitViewModel.evidenceGates.map((gate) => (
                    <li className="flex gap-2" key={gate}>
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{gate}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-900">
                  StopConditions
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-amber-950">
                  {auditLoopCockpitViewModel.stopConditions.map((condition) => (
                    <li className="flex gap-2" key={condition}>
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{condition}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-700">
                <div>
                  <span className="font-semibold text-stone-950">ProviderHealth:</span>{" "}
                  {auditLoopCockpitViewModel.providerHealth}
                </div>
                <div className="mt-2">
                  <span className="font-semibold text-stone-950">CanaryState:</span>{" "}
                  {auditLoopCockpitViewModel.canaryState}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
              CriticalQuestioner queue
            </h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {auditLoopCockpitViewModel.criticalQuestions.map((item, index) => (
                <div className="rounded-2xl bg-white p-4 text-sm shadow-sm" key={item.question}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                    Question {index + 1}
                  </div>
                  <div className="mt-2 font-semibold leading-6 text-stone-900">{item.question}</div>
                  <div className="mt-2 leading-6 text-stone-600">{item.trigger}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {readbackPanels.map((panel) => (
            <PanelCard key={panel.title} panel={panel} />
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.5rem] border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/70">
            <h2 className="text-lg font-semibold tracking-tight">Required frontend surfaces</h2>
            <div className="mt-4 grid gap-2">
              {surfaces.map((surface) => (
                <div
                  className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm"
                  key={surface}
                >
                  <span className="font-medium text-stone-800">{surface}</span>
                  <BoundaryBadge boundary="candidate" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/70">
            <h2 className="text-lg font-semibold tracking-tight">Panel data contract</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Every panel must show enough evidence for a human operator to know what is safe,
              blocked, stale, or merely projected.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {dataContract.map((field) => (
                <div
                  className="rounded-2xl bg-stone-50 px-4 py-3 text-sm font-mono text-stone-700"
                  key={field}
                >
                  {field}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950">
              Next safe action: refresh WDC readback for batch anchors, then wire live read models
              in a separate governed slice. This route is a candidate cockpit projection until then.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
