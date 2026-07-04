import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CircuitBoard,
  Crosshair,
  Cpu,
  GitFork,
  Layers,
  LayoutGrid,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  X,
} from "lucide-react";

import {
  buildCapabilityLibrary,
  filterCapabilityLibrary,
  CAPABILITY_DOMAINS,
  CAPABILITY_EVIDENCE,
  CAPABILITY_KIND_LABELS,
  CAPABILITY_READINESS,
  type CapabilityKind,
  type CapabilityLibraryEntry,
  type CapabilityLibraryFilters,
} from "@/lib/capabilityLibrary";
import {
  bomChain,
  cockpitStatusStrip,
  exampleDemandPrompts,
  proofBoundaryCards,
  resolveDemand,
  scoredProviders,
  toolboxProviders,
  workspaceRail,
  type BomChainNode,
  type CockpitStatusState,
  type ResolvedDemand,
  type ToolboxProvider,
} from "@/lib/cockpitModel";
import type { CandidateProvider } from "@/lib/capabilityOrchestration";
import {
  candidateProvidersForCapabilities,
  LANE_LABELS,
  providerRegistry,
  REGISTRY_LANES,
  routingPipeline,
  type ProviderLane,
  type RegistryProvider,
} from "@/lib/providerRegistry";

type InspectorTarget = {
  kind: string;
  title: string;
  summary: string;
  boundary: string;
  rows: Array<{ label: string; value: string }>;
  tags?: string[];
};

const STATE_DOT: Record<CockpitStatusState | "pending", string> = {
  boot: "bg-sky-400",
  ready: "bg-emerald-400",
  attention: "bg-amber-300",
  blocked: "bg-red-400",
  pending: "bg-amber-300",
};

const STATE_TEXT: Record<CockpitStatusState | "pending", string> = {
  boot: "text-sky-300",
  ready: "text-emerald-300",
  attention: "text-amber-200",
  blocked: "text-red-300",
  pending: "text-amber-200",
};

const blueprintGrid: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
};

function entryToInspector(entry: CapabilityLibraryEntry): InspectorTarget {
  return {
    kind: entry.kind,
    title: entry.label,
    summary: entry.description,
    boundary: "candidate_only · projection_only · no graph writes",
    tags: entry.provided_competences.slice(0, 4),
    rows: [
      { label: "domain", value: entry.domain },
      { label: "readiness", value: entry.readiness.replace(/_/g, " ") },
      { label: "evidence", value: entry.evidence.replace(/_/g, " ") },
      { label: "source", value: `${entry.source_repo} · ${entry.source_ref}` },
      { label: "source_fit_score", value: entry.source_fit_score.toFixed(2) },
      { label: "requires", value: entry.required_competences.join(", ") || "—" },
    ],
  };
}

function providerToInspector(provider: CandidateProvider, score: number): InspectorTarget {
  return {
    kind: "provider",
    title: provider.label,
    summary: `Provides ${provider.providedCapabilities.length} capabilities. Scored ${score}/100 on fit, proof, cost, latency, risk, compliance.`,
    boundary: `runtime status: ${provider.runtimeStatus.replace(/_/g, " ")} · admission: ${provider.admissionState.replace(/_/g, " ")}`,
    tags: provider.providedCapabilities.map((cap) => cap.replace("capability:", "")).slice(0, 5),
    rows: [
      { label: "score", value: `${score}/100` },
      { label: "cost", value: provider.costClass },
      { label: "latency", value: provider.latencyClass },
      { label: "risk", value: provider.riskClass.replace(/_/g, " ") },
      { label: "admission", value: provider.admissionState.replace(/_/g, " ") },
      { label: "proof history", value: provider.proofHistory.join(", ") },
    ],
  };
}

function bomToInspector(node: BomChainNode): InspectorTarget {
  return {
    kind: "bom-node",
    title: node.label,
    summary: node.role,
    boundary: `state: ${node.state} · candidateCount ${node.candidateCount} kept separate from mappedCount ${node.mappedCount}`,
    rows: [
      { label: "candidate count", value: String(node.candidateCount) },
      { label: "mapped count", value: String(node.mappedCount) },
      { label: "state", value: node.state },
      { label: "summary", value: node.summary },
    ],
  };
}

function toolboxToInspector(tool: ToolboxProvider): InspectorTarget {
  return {
    kind: "toolbox",
    title: tool.label,
    summary: tool.summary,
    boundary: `evidence class: ${tool.evidenceClass} · write allowed: no`,
    tags: tool.capabilities,
    rows: [
      { label: "vendor", value: tool.vendor },
      { label: "evidence class", value: tool.evidenceClass },
      { label: "capabilities", value: tool.capabilities.join(", ") },
      { label: "write authority", value: "none (candidate only)" },
    ],
  };
}

const REG_READINESS_STYLE: Record<RegistryProvider["readiness"], string> = {
  ready: "bg-emerald-400/15 text-emerald-300",
  dry_run_only: "bg-sky-400/15 text-sky-300",
  approval_required: "bg-amber-300/15 text-amber-200",
  blocked: "bg-red-400/15 text-red-300",
};

const SCORE_STYLE: Record<RegistryProvider["cost"], string> = {
  low: "text-emerald-300",
  medium: "text-amber-200",
  high: "text-red-300",
};

function registryToInspector(provider: RegistryProvider): InspectorTarget {
  return {
    kind: "registry-provider",
    title: provider.label,
    summary: `${LANE_LABELS[provider.lane]} · ${provider.vendor}. Adapter ${provider.adapter.protocol} — write authority none. Max proof reachable: ${provider.maxProof}.`,
    boundary: `auth: ${provider.auth.replace(/_/g, " ")} · readiness: ${provider.readiness.replace(/_/g, " ")} · write authority: none`,
    tags: provider.providesCapabilities.map((cap) => cap.replace("capability:", "")),
    rows: [
      { label: "lane", value: LANE_LABELS[provider.lane] },
      { label: "fit score", value: `${provider.fitScore}/100` },
      { label: "cost · latency · risk", value: `${provider.cost} · ${provider.latency} · ${provider.risk}` },
      { label: "allowed actions", value: provider.allowedActions.join(", ") },
      { label: "blocked actions", value: provider.blockedActions.join(", ") },
      { label: "evidence requirements", value: provider.evidenceRequirements.join(", ") },
      { label: "quorum / review", value: `${provider.quorum.replace(/_/g, " ")} — ${provider.reviewMode}` },
      {
        label: "fallback routes",
        value: provider.fallbacks.length ? provider.fallbacks.join(" → ") : "none (terminal)",
      },
      {
        label: "adapter contract",
        value: `${provider.adapter.protocol}: ${provider.adapter.inputEnvelope} → ${provider.adapter.outputEnvelope}`,
      },
      { label: "max proof", value: provider.maxProof },
    ],
  };
}

export function CapabilityCockpit() {
  const library = useMemo(() => buildCapabilityLibrary(), []);

  const [railOpen, setRailOpen] = useState(true);
  const [activeSection, setActiveSection] = useState("demand");
  const [toolboxOpen, setToolboxOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CapabilityKind>("agent");
  const [domain, setDomain] = useState<CapabilityLibraryFilters["domain"]>("all");
  const [readiness, setReadiness] = useState<CapabilityLibraryFilters["readiness"]>("all");
  const [evidence, setEvidence] = useState<CapabilityLibraryFilters["evidence"]>("all");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspector, setInspector] = useState<InspectorTarget | null>(null);

  const [demandInput, setDemandInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ResolvedDemand | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [lane, setLane] = useState<ProviderLane | "all">("all");

  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (resolveTimer.current) clearTimeout(resolveTimer.current);
    };
  }, []);

  const filtered = useMemo(
    () => filterCapabilityLibrary(library, { kind, domain, readiness, evidence, query }),
    [library, kind, domain, readiness, evidence, query],
  );

  const providers = useMemo(() => scoredProviders(), []);

  // Routing invariant: eligible registry providers only exist AFTER capability
  // resolution. Before resolution this set is empty — selection cannot precede it.
  const eligibleRegistryIds = useMemo(() => {
    if (!resolved) return new Set<string>();
    const capIds = resolved.capabilities.map((cap) => cap.id);
    return new Set(candidateProvidersForCapabilities(capIds).map((p) => p.id));
  }, [resolved]);

  const registryRows = useMemo(
    () => providerRegistry.filter((provider) => lane === "all" || provider.lane === lane),
    [lane],
  );

  const candidateTotal = useMemo(
    () => library.filter((entry) => entry.kind === kind).length,
    [library, kind],
  );

  function select(id: string, target: InspectorTarget) {
    setSelectedId(id);
    setInspector(target);
  }

  function runResolve(value: string) {
    const trimmed = value.trim();
    setResolveError(null);
    if (!trimmed) {
      setResolveError("Enter a demand to resolve into capabilities.");
      setResolved(null);
      return;
    }
    setResolving(true);
    setResolved(null);
    if (resolveTimer.current) clearTimeout(resolveTimer.current);
    resolveTimer.current = setTimeout(() => {
      const result = resolveDemand(trimmed);
      setResolved(result);
      setResolving(false);
    }, 480);
  }

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-stone-950 text-stone-100"
      style={blueprintGrid}
    >
      {/* Top status strip */}
      <header className="z-20 border-b border-stone-800/80 bg-stone-950/90 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => setRailOpen((open) => !open)}
            className="hidden shrink-0 rounded-lg border border-stone-700/70 p-1.5 text-stone-300 transition hover:bg-stone-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 lg:inline-flex"
            aria-label={railOpen ? "Collapse workspace rail" : "Expand workspace rail"}
          >
            {railOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-300 text-stone-950">
              <Crosshair className="h-4 w-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold tracking-tight">
                WDC Gemini Agent Office
              </div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-amber-200/80">
                Capability cockpit
              </div>
            </div>
          </div>

          <div
            className="flex flex-1 flex-wrap items-center justify-end gap-1.5"
            role="status"
            aria-label="Cockpit runtime status"
          >
            {cockpitStatusStrip.map((chip) => (
              <div
                key={chip.id}
                title={chip.detail}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-stone-700/70 bg-stone-900/80 px-2.5 py-1"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[chip.state]}`} />
                <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  {chip.label}
                </span>
                <span className={`text-[11px] font-semibold ${STATE_TEXT[chip.state]}`}>
                  {chip.value}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setToolboxOpen(true)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Provider toolbox</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left workspace rail */}
        {railOpen ? (
          <nav
            aria-label="Workspace rail"
            className="hidden w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-stone-800/80 bg-stone-950/80 p-3 lg:flex"
          >
            <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500">
              Workspace
            </div>
            {workspaceRail.map((item) => {
              const active = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#section-${item.id}`}
                  onClick={() => setActiveSection(item.id)}
                  className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
                    active
                      ? "bg-amber-300/15 text-amber-100"
                      : "text-stone-300 hover:bg-stone-800/70 hover:text-stone-100"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${active ? "bg-amber-300" : "bg-stone-600 group-hover:bg-stone-400"}`}
                  />
                  <span className="flex-1 truncate">
                    <span className="block font-medium leading-tight">{item.label}</span>
                    <span className="block text-[10px] leading-tight text-stone-500">
                      {item.hint}
                    </span>
                  </span>
                  {typeof item.count === "number" ? (
                    <span className="rounded-full bg-stone-800 px-1.5 py-0.5 text-[10px] text-stone-400">
                      {item.count}
                    </span>
                  ) : null}
                </a>
              );
            })}

            <div className="mt-auto rounded-xl border border-stone-800 bg-stone-900/70 p-3 text-[11px] leading-5 text-stone-400">
              <div className="flex items-center gap-1.5 font-semibold text-stone-200">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
                Authority boundary
              </div>
              <p className="mt-1.5">
                Cockpit only. No orchestrator authority, graph writes, Railway mutation, claim
                promotion, or runtime-proof claims.
              </p>
            </div>
          </nav>
        ) : null}

        {/* Main scroll area */}
        <main className="min-w-0 flex-1 overflow-y-auto scroll-smooth">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
            {/* Demand composer */}
            <section id="section-demand" className="scroll-mt-4">
              <SectionHeading
                icon={<Terminal className="h-4 w-4" />}
                title="Demand composer"
                subtitle="Demand resolves into capabilities before any tool or route is selected."
              />
              <div className="rounded-2xl border border-stone-700/60 bg-stone-900/60 p-4 sm:p-5">
                <label htmlFor="demand-input" className="sr-only">
                  Describe the demand to resolve
                </label>
                <textarea
                  id="demand-input"
                  value={demandInput}
                  onChange={(event) => setDemandInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      (event.metaKey || event.ctrlKey) &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      runResolve(demandInput);
                    }
                  }}
                  rows={3}
                  placeholder="e.g. Write a business letter — or — Analyze a repo and suggest harvest candidates"
                  className="w-full resize-none rounded-xl border border-stone-700 bg-stone-950/70 px-3.5 py-3 text-sm text-stone-100 placeholder:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => runResolve(demandInput)}
                    disabled={resolving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-300 px-3.5 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {resolving ? "Resolving…" : "Resolve capabilities"}
                  </button>
                  <span className="text-[11px] text-stone-500">⌘/Ctrl + Enter</span>
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {exampleDemandPrompts.slice(0, 3).map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          setDemandInput(prompt);
                          runResolve(prompt);
                        }}
                        className="rounded-full border border-stone-700 px-2.5 py-1 text-[11px] text-stone-400 transition hover:border-amber-300/50 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                {resolveError ? (
                  <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-950/30 px-3 py-2 text-xs text-red-200">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {resolveError}
                  </p>
                ) : null}

                <div className="mt-4">
                  {resolving ? (
                    <ResolveSkeleton />
                  ) : resolved ? (
                    <ResolvedView resolved={resolved} onSelectProvider={select} />
                  ) : (
                    <EmptyHint text="Resolve a demand to see required capabilities and scored candidate providers. Nothing is executed — this is a read-only projection." />
                  )}
                </div>
              </div>
            </section>

            {/* Routing pipeline */}
            <section id="section-pipeline" className="scroll-mt-4">
              <SectionHeading
                icon={<Route className="h-4 w-4" />}
                title="Routing pipeline"
                subtitle="Demand → CapabilityResolver → RequiredCapabilities → CandidateProviders → ProviderScoring → BOM/Route → ExecutionSurface → Proof. Provider selection cannot precede capability resolution."
              />
              <div className="rounded-2xl border border-stone-700/60 bg-stone-900/60 p-4 sm:p-5">
                <ol className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-stretch">
                  {routingPipeline.map((stage, index) => {
                    const gated = stage.id === "candidates" || stage.id === "scoring";
                    const unlocked = gated ? Boolean(resolved) : true;
                    const isExecution = stage.id === "execution" || stage.id === "proof";
                    return (
                      <li
                        key={stage.id}
                        className="flex items-stretch gap-2 lg:flex-1 lg:min-w-[7.5rem]"
                      >
                        <div
                          className={`flex w-full flex-col gap-1 rounded-xl border p-2.5 transition ${
                            isExecution
                              ? "border-stone-800 bg-stone-950/40"
                              : unlocked
                                ? "border-amber-300/40 bg-amber-300/5"
                                : "border-stone-800 bg-stone-950/40 opacity-70"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[10px] text-stone-500">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            {gated && !unlocked ? (
                              <Lock className="h-3 w-3 text-stone-500" aria-label="Locked until resolved" />
                            ) : null}
                            {isExecution ? (
                              <span className="rounded-full bg-stone-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-stone-500">
                                off-cockpit
                              </span>
                            ) : null}
                          </div>
                          <span className="text-xs font-semibold leading-tight text-stone-100">
                            {stage.label}
                          </span>
                          <span className="text-[10px] leading-4 text-stone-400">{stage.role}</span>
                          <span className="mt-auto text-[9px] leading-3 text-stone-600">
                            {stage.gate}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-stone-500">
                  <Lock className="h-3 w-3" />
                  {resolved
                    ? "Demand resolved — CandidateProviders and ProviderScoring unlocked below."
                    : "CandidateProviders + ProviderScoring stay locked until a demand is resolved."}
                </p>
              </div>
            </section>

            {/* Capability library */}
            <section id="section-capabilities" className="scroll-mt-4">
              <SectionHeading
                icon={<Layers className="h-4 w-4" />}
                title="Capability library"
                subtitle="Searchable, read-only capability inventory. Candidate count is separate from mapped count."
              />
              <div className="rounded-2xl border border-stone-700/60 bg-stone-900/60 p-4 sm:p-5">
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                    <label htmlFor="capability-search" className="sr-only">
                      Search capabilities
                    </label>
                    <input
                      id="capability-search"
                      ref={searchRef}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search capabilities, competences, sources…"
                      className="w-full rounded-xl border border-stone-700 bg-stone-950/70 py-2.5 pl-9 pr-3 text-sm text-stone-100 placeholder:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Capability kind">
                    {CAPABILITY_KIND_LABELS.map((item) => (
                      <button
                        key={item.kind}
                        type="button"
                        role="tab"
                        aria-selected={kind === item.kind}
                        onClick={() => setKind(item.kind)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
                          kind === item.kind
                            ? "bg-amber-300 text-stone-950"
                            : "border border-stone-700 text-stone-300 hover:border-amber-300/40 hover:text-amber-100"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <FilterSelect
                      label="Domain"
                      value={domain}
                      onChange={(value) =>
                        setDomain(value as CapabilityLibraryFilters["domain"])
                      }
                      options={["all", ...CAPABILITY_DOMAINS]}
                    />
                    <FilterSelect
                      label="Readiness"
                      value={readiness}
                      onChange={(value) =>
                        setReadiness(value as CapabilityLibraryFilters["readiness"])
                      }
                      options={["all", ...CAPABILITY_READINESS]}
                    />
                    <FilterSelect
                      label="Evidence"
                      value={evidence}
                      onChange={(value) =>
                        setEvidence(value as CapabilityLibraryFilters["evidence"])
                      }
                      options={["all", ...CAPABILITY_EVIDENCE]}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span>
                      <span className="font-semibold text-amber-200">{filtered.length}</span> of{" "}
                      {candidateTotal} candidate {kind.replace(/_/g, " ")} entries
                    </span>
                    <span className="uppercase tracking-wider">candidate_only</span>
                  </div>

                  {filtered.length === 0 ? (
                    <EmptyHint text="No capabilities match these filters. Clear the search or widen the domain / readiness / evidence filters." />
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {filtered.map((entry) => {
                        const active = selectedId === entry.id;
                        return (
                          <li key={entry.id}>
                            <button
                              type="button"
                              onClick={() => select(entry.id, entryToInspector(entry))}
                              className={`flex w-full flex-col gap-1.5 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
                                active
                                  ? "border-amber-300/70 bg-amber-300/10"
                                  : "border-stone-800 bg-stone-950/50 hover:border-stone-600"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-semibold text-stone-100">
                                  {entry.label}
                                </span>
                                <span className="shrink-0 rounded-full bg-stone-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-stone-400">
                                  {entry.domain}
                                </span>
                              </div>
                              <p className="line-clamp-2 text-xs leading-5 text-stone-400">
                                {entry.description}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <ReadinessBadge readiness={entry.readiness} />
                                <span className="text-[10px] text-stone-500">
                                  fit {entry.source_fit_score.toFixed(2)}
                                </span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            {/* Candidate providers */}
            <section id="section-providers" className="scroll-mt-4">
              <SectionHeading
                icon={<Cpu className="h-4 w-4" />}
                title="Candidate providers · tools · agents"
                subtitle="Scored on fit, proof history, cost, latency, risk, compliance. Scoring is advisory only."
              />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {providers.map(({ provider, score }) => {
                  const active = selectedId === provider.id;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => select(provider.id, providerToInspector(provider, score))}
                      className={`flex flex-col gap-2 rounded-xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
                        active
                          ? "border-amber-300/70 bg-amber-300/10"
                          : "border-stone-800 bg-stone-900/50 hover:border-stone-600"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{provider.label}</span>
                        <span className="text-lg font-bold text-amber-200">{score}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <MiniTag>{provider.riskClass.replace(/_/g, " ")}</MiniTag>
                        <MiniTag>{provider.costClass}</MiniTag>
                        <MiniTag>{provider.admissionState.replace(/_/g, " ")}</MiniTag>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-stone-800">
                        <div
                          className="h-full rounded-full bg-amber-300"
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Provider registry + toolbox matrix */}
            <section id="section-registry" className="scroll-mt-4">
              <SectionHeading
                icon={<LayoutGrid className="h-4 w-4" />}
                title="Provider registry · toolbox matrix"
                subtitle="Auth, readiness, allowed/blocked actions, evidence, cost/latency/risk, fallbacks, quorum and adapter contracts. Every adapter has write authority: none."
              />
              <div className="rounded-2xl border border-stone-700/60 bg-stone-900/60 p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Provider lane">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={lane === "all"}
                    onClick={() => setLane("all")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
                      lane === "all"
                        ? "bg-amber-300 text-stone-950"
                        : "border border-stone-700 text-stone-300 hover:border-amber-300/40 hover:text-amber-100"
                    }`}
                  >
                    All lanes
                  </button>
                  {REGISTRY_LANES.map((laneId) => (
                    <button
                      key={laneId}
                      type="button"
                      role="tab"
                      aria-selected={lane === laneId}
                      onClick={() => setLane(laneId)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
                        lane === laneId
                          ? "bg-amber-300 text-stone-950"
                          : "border border-stone-700 text-stone-300 hover:border-amber-300/40 hover:text-amber-100"
                      }`}
                    >
                      {LANE_LABELS[laneId]}
                    </button>
                  ))}
                </div>

                <div className="mb-3 flex items-center justify-between text-[11px] text-stone-500">
                  <span>
                    <span className="font-semibold text-amber-200">{registryRows.length}</span> of{" "}
                    {providerRegistry.length} registry providers
                  </span>
                  <span className="uppercase tracking-wider">
                    {resolved
                      ? `${eligibleRegistryIds.size} eligible for resolved demand`
                      : "resolve a demand to mark eligibility"}
                  </span>
                </div>

                {/* Matrix: scrollable table on desktop, cards on mobile */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-800 text-[10px] uppercase tracking-wider text-stone-500">
                        <th className="px-2 py-2 font-medium">Provider</th>
                        <th className="px-2 py-2 font-medium">Auth</th>
                        <th className="px-2 py-2 font-medium">Readiness</th>
                        <th className="px-2 py-2 font-medium">Fit</th>
                        <th className="px-2 py-2 font-medium">Cost/Lat/Risk</th>
                        <th className="px-2 py-2 font-medium">Max proof</th>
                        <th className="px-2 py-2 font-medium">Quorum</th>
                        <th className="px-2 py-2 font-medium">Fallbacks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registryRows.map((provider) => {
                        const active = selectedId === provider.id;
                        const eligible = eligibleRegistryIds.has(provider.id);
                        return (
                          <tr
                            key={provider.id}
                            tabIndex={0}
                            role="button"
                            aria-pressed={active}
                            onClick={() => select(provider.id, registryToInspector(provider))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                select(provider.id, registryToInspector(provider));
                              }
                            }}
                            className={`cursor-pointer border-b border-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
                              active ? "bg-amber-300/10" : "hover:bg-stone-800/40"
                            }`}
                          >
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-stone-100">{provider.label}</span>
                                {eligible ? (
                                  <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                                    eligible
                                  </span>
                                ) : null}
                              </div>
                              <span className="text-[10px] text-stone-500">
                                {LANE_LABELS[provider.lane]}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-stone-400">
                              {provider.auth.replace(/_/g, " ")}
                            </td>
                            <td className="px-2 py-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${REG_READINESS_STYLE[provider.readiness]}`}
                              >
                                {provider.readiness.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-2 py-2 font-semibold text-amber-200">
                              {provider.fitScore}
                            </td>
                            <td className="px-2 py-2 text-[11px]">
                              <span className={SCORE_STYLE[provider.cost]}>{provider.cost}</span>
                              <span className="text-stone-600"> · </span>
                              <span className={SCORE_STYLE[provider.latency]}>{provider.latency}</span>
                              <span className="text-stone-600"> · </span>
                              <span className={SCORE_STYLE[provider.risk]}>{provider.risk}</span>
                            </td>
                            <td className="px-2 py-2">
                              <span className="rounded-full border border-stone-700 px-2 py-0.5 text-[10px] text-stone-400">
                                {provider.maxProof}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-[10px] text-stone-400">
                              {provider.quorum.replace(/_/g, " ")}
                            </td>
                            <td className="px-2 py-2 text-[10px] text-stone-500">
                              {provider.fallbacks.length ? (
                                <span className="inline-flex items-center gap-1">
                                  <GitFork className="h-3 w-3" />
                                  {provider.fallbacks.join(" → ")}
                                </span>
                              ) : (
                                "terminal"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <ul className="grid gap-2 md:hidden">
                  {registryRows.map((provider) => {
                    const active = selectedId === provider.id;
                    const eligible = eligibleRegistryIds.has(provider.id);
                    return (
                      <li key={provider.id}>
                        <button
                          type="button"
                          onClick={() => select(provider.id, registryToInspector(provider))}
                          className={`flex w-full flex-col gap-1.5 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
                            active
                              ? "border-amber-300/70 bg-amber-300/10"
                              : "border-stone-800 bg-stone-950/50 hover:border-stone-600"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-stone-100">
                              {provider.label}
                            </span>
                            <span className="text-base font-bold text-amber-200">
                              {provider.fitScore}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${REG_READINESS_STYLE[provider.readiness]}`}
                            >
                              {provider.readiness.replace(/_/g, " ")}
                            </span>
                            <MiniTag>{LANE_LABELS[provider.lane]}</MiniTag>
                            <MiniTag>proof: {provider.maxProof}</MiniTag>
                            {eligible ? (
                              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                eligible
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            {/* BOM / LegoFactory chain */}
            <section id="section-bom" className="scroll-mt-4">
              <SectionHeading
                icon={<Boxes className="h-4 w-4" />}
                title="BOM / LegoFactory chain"
                subtitle="WorkBOM → RouteCatalog → ProjectTree → AgentTeamBOM → EnvironmentBOM → EvidenceContractLedger → ProofGate → CloseoutTree"
              />
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {bomChain.map((node, index) => {
                  const active = selectedId === node.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => select(node.id, bomToInspector(node))}
                      className={`relative flex flex-col gap-2 rounded-xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
                        active
                          ? "border-amber-300/70 bg-amber-300/10"
                          : "border-stone-800 bg-stone-900/50 hover:border-stone-600"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-stone-500">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${STATE_TEXT[node.state]}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[node.state]}`} />
                          {node.state}
                        </span>
                      </div>
                      <span className="text-sm font-semibold">{node.label}</span>
                      <p className="text-[11px] leading-4 text-stone-400">{node.role}</p>
                      <div className="mt-auto flex items-center gap-3 text-[11px]">
                        <span className="text-stone-500">
                          candidate{" "}
                          <span className="font-semibold text-stone-300">
                            {node.candidateCount}
                          </span>
                        </span>
                        <span className="text-stone-500">
                          mapped{" "}
                          <span className="font-semibold text-amber-200">{node.mappedCount}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Proof boundaries */}
            <section id="section-proof" className="scroll-mt-4">
              <SectionHeading
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Proof boundaries"
                subtitle="Candidate and diagnostic evidence are separated from runtime and claim. The cockpit cannot reach runtime or claim."
              />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {proofBoundaryCards.map((card) => (
                  <div
                    key={card.id}
                    className={`flex flex-col gap-2 rounded-xl border p-3.5 ${
                      card.reachable
                        ? "border-emerald-400/30 bg-emerald-950/20"
                        : "border-red-400/30 bg-red-950/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{card.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          card.reachable
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-red-400/15 text-red-300"
                        }`}
                      >
                        {card.reachable ? "reachable" : "blocked"}
                      </span>
                    </div>
                    <p className="text-[11px] leading-5 text-stone-400">{card.description}</p>
                    <p className="mt-auto text-[10px] leading-4 text-stone-500">{card.reason}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>

        {/* Right inspector */}
        <aside
          aria-label="Object inspector"
          className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-stone-800/80 bg-stone-950/85 p-4 xl:flex"
        >
          <div className="flex items-center gap-2 pb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500">
            <CircuitBoard className="h-3.5 w-3.5 text-amber-300" />
            Object inspector
          </div>
          {inspector ? (
            <InspectorPanel inspector={inspector} />
          ) : (
            <div className="rounded-xl border border-dashed border-stone-800 bg-stone-900/40 p-4 text-xs leading-5 text-stone-500">
              Select a capability, provider, BOM node, or toolbox surface to inspect its candidate
              metadata and proof boundary.
            </div>
          )}
        </aside>
      </div>

      {/* Mobile inspector (below fold) */}
      {inspector ? (
        <div className="border-t border-stone-800 bg-stone-950/95 p-4 xl:hidden">
          <div className="mx-auto max-w-6xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                Object inspector
              </span>
              <button
                type="button"
                onClick={() => {
                  setInspector(null);
                  setSelectedId(null);
                }}
                className="rounded-md p-1 text-stone-500 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                aria-label="Close inspector"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <InspectorPanel inspector={inspector} />
          </div>
        </div>
      ) : null}

      {/* Provider toolbox drawer */}
      {toolboxOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Provider toolbox">
          <button
            type="button"
            aria-label="Close toolbox"
            onClick={() => setToolboxOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-stone-800 bg-stone-950 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-300" />
                <h2 className="text-sm font-semibold">Provider toolbox</h2>
              </div>
              <button
                type="button"
                onClick={() => setToolboxOpen(false)}
                className="rounded-md p-1 text-stone-400 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                aria-label="Close toolbox"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="pb-4 text-xs leading-5 text-stone-400">
              Design + prototype surfaces. Every output is a candidate envelope with no write
              authority — the cockpit never promotes these to runtime or claim.
            </p>
            <div className="flex flex-col gap-2">
              {toolboxProviders.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => select(tool.id, toolboxToInspector(tool))}
                  className="flex flex-col gap-2 rounded-xl border border-stone-800 bg-stone-900/50 p-3.5 text-left transition hover:border-amber-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{tool.label}</span>
                    <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                      {tool.evidenceClass}
                    </span>
                  </div>
                  <p className="text-[11px] leading-5 text-stone-400">{tool.summary}</p>
                  <div className="flex flex-wrap gap-1">
                    {tool.capabilities.map((cap) => (
                      <MiniTag key={cap}>{cap}</MiniTag>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-700/70 bg-stone-900 text-amber-300">
        {icon}
      </span>
      <div>
        <h2 className="text-base font-semibold tracking-tight text-stone-100">{title}</h2>
        <p className="text-xs leading-5 text-stone-500 text-pretty">{subtitle}</p>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-stone-700 bg-stone-950/70 px-3 py-2 text-xs text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-stone-900">
            {label}: {option.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

function ReadinessBadge({ readiness }: { readiness: CapabilityLibraryEntry["readiness"] }) {
  const map: Record<CapabilityLibraryEntry["readiness"], string> = {
    preview_ready: "bg-emerald-400/15 text-emerald-300",
    dry_run_only: "bg-sky-400/15 text-sky-300",
    approval_required: "bg-amber-300/15 text-amber-200",
    missing_dependency: "bg-red-400/15 text-red-300",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${map[readiness]}`}
    >
      {readiness.replace(/_/g, " ")}
    </span>
  );
}

function MiniTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-stone-700 px-2 py-0.5 text-[10px] text-stone-400">
      {children}
    </span>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-800 bg-stone-950/40 p-4 text-xs leading-5 text-stone-500">
      {text}
    </div>
  );
}

function ResolveSkeleton() {
  return (
    <div className="grid animate-pulse gap-2 sm:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-16 rounded-xl border border-stone-800 bg-stone-950/60" />
      ))}
    </div>
  );
}

function ResolvedView({
  resolved,
  onSelectProvider,
}: {
  resolved: ResolvedDemand;
  onSelectProvider: (id: string, target: InspectorTarget) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
          resolved.ready
            ? "border-emerald-400/30 bg-emerald-950/20 text-emerald-200"
            : "border-red-400/30 bg-red-950/20 text-red-200"
        }`}
      >
        {resolved.ready ? (
          <ShieldCheck className="h-3.5 w-3.5" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5" />
        )}
        {resolved.ready
          ? "Ready — required capabilities have candidate providers."
          : `Blocked unless: ${resolved.blockedUnless}`}
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
          Required capabilities ({resolved.capabilities.length})
        </div>
        <div className="flex flex-wrap gap-1.5">
          {resolved.capabilities.map((cap) => (
            <span
              key={cap.id}
              title={cap.description}
              className="rounded-full border border-stone-700 bg-stone-950/60 px-2.5 py-1 text-[11px] text-stone-300"
            >
              {cap.id.replace("capability:", "")}
              <span className="ml-1 text-stone-600">{cap.claimCeiling}</span>
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
          Candidate providers ({resolved.providers.length})
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {resolved.providers.map(({ provider, score }) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => onSelectProvider(provider.id, providerToInspector(provider, score))}
              className="flex items-center justify-between gap-2 rounded-lg border border-stone-800 bg-stone-950/50 px-3 py-2 text-left transition hover:border-amber-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{provider.label}</div>
                <div className="text-[10px] text-stone-500">
                  {provider.riskClass.replace(/_/g, " ")} · {provider.runtimeStatus.replace(/_/g, " ")}
                </div>
              </div>
              <span className="text-base font-bold text-amber-200">{score}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-stone-800 bg-stone-950/50 px-3 py-2 text-[11px] text-stone-500">
        Required proof: {resolved.requiredProof.join(" · ")}
      </div>
    </div>
  );
}

function InspectorPanel({ inspector }: { inspector: InspectorTarget }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-200">
          {inspector.kind.replace(/_/g, " ")}
        </div>
        <div className="mt-0.5 text-base font-semibold leading-tight text-stone-100">
          {inspector.title}
        </div>
        <p className="mt-1.5 text-xs leading-5 text-stone-400">{inspector.summary}</p>
      </div>

      <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-[11px] leading-5 text-amber-100/90">
        {inspector.boundary}
      </div>

      {inspector.tags && inspector.tags.length ? (
        <div className="flex flex-wrap gap-1">
          {inspector.tags.map((tag) => (
            <MiniTag key={tag}>{tag}</MiniTag>
          ))}
        </div>
      ) : null}

      <dl className="flex flex-col divide-y divide-stone-800 rounded-lg border border-stone-800 bg-stone-900/40">
        {inspector.rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5 px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wider text-stone-500">{row.label}</dt>
            <dd className="break-words text-xs text-stone-300">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default CapabilityCockpit;
