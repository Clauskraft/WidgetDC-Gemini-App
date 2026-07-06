import {
  capabilityAcceptanceGates,
  capabilityResolutionFlow,
  candidateProviders,
  demandIngressMatrix,
  exampleDemands,
  geminiUxContract,
  providersForDemand,
  prototypeBuilderProviders,
  prototypeBuilderRoutingSteps,
  scoreProviderById,
} from "../lib/capabilityOrchestration";
import { WdcLogo } from "./WdcLogo";

const missionSignals = [
  {
    label: "Runtime proof",
    value: "pending",
    tone: "text-emerald-200",
    note: "Needs deployed SHA + 3 passes",
  },
  {
    label: "EventSpine",
    value: "pending",
    tone: "text-sky-200",
    note: "Attach scoped replay after deploy",
  },
  {
    label: "Claim ceiling",
    value: "L1 candidate",
    tone: "text-amber-200",
    note: "No promotion without runtime evidence",
  },
  { label: "Provider mode", value: "toolbox", tone: "text-stone-100", note: "Capability-first" },
];

const proofLedger = [
  {
    stage: "candidate",
    status: "builder output",
    evidence: "v0, Lovable, Claude Design and Figma/Stitch ideas stay candidate until imported.",
  },
  {
    stage: "diagnostic",
    status: "WDC route + PR",
    evidence: "Builds, checks, previews and visual diagnostics support code review only.",
  },
  {
    stage: "runtime",
    status: "deployed flow",
    evidence: "Requires deployed SHA readback plus three governed browser passes.",
  },
  {
    stage: "claim",
    status: "blocked here",
    evidence: "Frontend never promotes graph truth, adoption proof or platform claims.",
  },
] as const;

const bomDrawer = [
  {
    title: "WorkBOM",
    body: "Demand, capability gaps, provider lane, proof boundary and stop conditions.",
    count: "5 blocks",
  },
  {
    title: "Lego slots",
    body: "Command shell, route rail, provider toolbox, proof ledger and next-action card.",
    count: "5 reusable slots",
  },
  {
    title: "EvidenceBOM",
    body: "PR, deployment SHA, browser artifact, EventSpine replay and forbidden claim language.",
    count: "runtime scoped",
  },
] as const;

const nextSafeActions = [
  "Open builder package only after capability resolution.",
  "Import selected patterns through WDC branch and PR.",
  "Run governed frontend readback before runtime language.",
] as const;

export function CapabilityResolverPanel() {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-stone-700/40 bg-[radial-gradient(circle_at_10%_0%,_rgba(251,191,36,0.18),_transparent_26%),radial-gradient(circle_at_90%_8%,_rgba(56,189,248,0.12),_transparent_28%),linear-gradient(145deg,_#11100d,_#050505_62%,_#17120a)] text-stone-100 shadow-2xl shadow-black/40">
      <header className="grid gap-6 border-b border-stone-800/80 p-5 lg:grid-cols-[1.15fr_0.85fr] xl:p-7">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <WdcLogo size="sm" showWordmark />
            <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
              Capability Mission Control
            </span>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              Runtime proof pending
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
              World-leading app experience target
            </p>
            <h2 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-stone-50 md:text-5xl">
              Capability Cockpit
            </h2>
            <p className="max-w-4xl text-base leading-7 text-stone-300">
              Universal Capability Orchestration turns an open demand into a visible route: required
              capabilities, provider toolbox, BOM / Lego dependencies, execution surface and proof.
              Gemini App remains the cockpit for clarity and review, not the execution authority.
            </p>
          </div>

          <div className="rounded-[1.35rem] border border-stone-700/70 bg-stone-950/70 p-3 shadow-inner shadow-black/30">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                Demand
              </div>
              <div className="min-h-14 flex-1 rounded-2xl border border-stone-800 bg-black/40 px-4 py-3 text-sm leading-6 text-stone-300">
                Build a world-leading WDC-native cockpit that routes every provider action through
                capability, BOM, proof and next safe action.
              </div>
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                Next safe action
              </div>
            </div>
          </div>
        </div>

        <aside className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {missionSignals.map((signal) => (
            <div
              className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4"
              key={signal.label}
            >
              <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {signal.label}
              </div>
              <div className={`mt-2 text-2xl font-semibold ${signal.tone}`}>{signal.value}</div>
              <div className="mt-2 text-xs leading-5 text-stone-400">{signal.note}</div>
            </div>
          ))}
        </aside>
      </header>

      <div className="grid gap-5 p-5 xl:grid-cols-[0.82fr_1.18fr] xl:p-7">
        <section className="space-y-5">
          <div className="rounded-[1.5rem] border border-stone-800 bg-stone-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-400">
                  Route rail
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-300">
                  Demand is resolved before provider selection. This is the anti-provider-first
                  spine.
                </p>
              </div>
              <span className="rounded-full border border-amber-300/30 px-3 py-1 text-xs uppercase tracking-[0.16em] text-amber-100">
                No provider-first execution
              </span>
            </div>
            <ol className="mt-4 grid gap-2">
              {capabilityResolutionFlow.slice(0, 9).map((step, index) => (
                <li className="grid grid-cols-[2.5rem_1fr] items-center gap-3" key={step}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-stone-700 bg-stone-900 text-xs font-bold text-amber-200">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="rounded-2xl border border-stone-800 bg-stone-900/60 px-3 py-2 text-sm text-stone-200">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-[1.5rem] border border-stone-800 bg-stone-950/70 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-400">
              BOM / Lego drawer
            </h3>
            <div className="mt-4 grid gap-3">
              {bomDrawer.map((item) => (
                <article
                  className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4"
                  key={item.title}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-semibold text-stone-100">{item.title}</h4>
                    <span className="rounded-full bg-stone-800 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-stone-300">
                      {item.count}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-300">{item.body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/10 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100">
              Next safe action
            </h3>
            <ol className="mt-4 grid gap-2">
              {nextSafeActions.map((action, index) => (
                <li
                  className="flex gap-3 rounded-2xl bg-black/30 p-3 text-sm leading-6 text-stone-200"
                  key={action}
                >
                  <span className="text-emerald-200">{index + 1}.</span>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[1.5rem] border border-stone-800 bg-stone-950/70 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                Resolution flow
              </h3>
              <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                {prototypeBuilderRoutingSteps.map((step, index) => (
                  <li
                    className="rounded-2xl border border-stone-800 bg-stone-900/60 p-3"
                    key={step}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="mt-1 text-sm font-medium text-stone-200">{step}</div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-[1.5rem] border border-stone-800 bg-stone-950/70 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                Gemini UX contract
              </h3>
              <p className="mt-3 text-sm leading-6 text-stone-300">{geminiUxContract.role}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {geminiUxContract.evidenceClasses.map((evidenceClass) => (
                  <span
                    className="rounded-full border border-stone-700 px-3 py-1 text-xs uppercase tracking-[0.16em] text-stone-300"
                    key={evidenceClass}
                  >
                    {evidenceClass}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <section className="rounded-[1.5rem] border border-amber-300/25 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.14),_transparent_34%),linear-gradient(135deg,_rgba(28,25,23,0.96),_rgba(12,10,9,0.92))] p-4 shadow-2xl shadow-black/25">
            <div className="flex flex-col gap-4 border-b border-stone-800 pb-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                  Prototype builder control plane
                </div>
                <h3 className="mt-2 text-2xl font-semibold text-stone-100">
                  Multi-provider toolbox matrix
                </h3>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-300">
                  v0, Lovable, Vercel, Claude Design, Figma/Stitch and companion providers are
                  selectable only after capability resolution. WDC CLI remains the authoritative
                  governance/readback lane; builder output enters as candidate or diagnostic
                  evidence.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-50">
                <div className="font-semibold uppercase tracking-[0.16em]">Hard invariant</div>
                <p className="mt-2 leading-5">
                  No provider-first execution. No runtime language without deployed SHA readback and
                  three consecutive passes.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              {prototypeBuilderProviders.map((provider) => (
                <article
                  className="group rounded-2xl border border-stone-800 bg-stone-950/70 p-4 transition hover:border-amber-300/40 hover:bg-stone-900/80 focus-within:border-amber-300/60"
                  key={provider.providerId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                        {provider.lane.replace(/_/g, " ")}
                      </div>
                      <h4 className="mt-1 text-lg font-semibold text-stone-100">
                        {provider.label}
                      </h4>
                    </div>
                    <div className="rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-right">
                      <div className="text-lg font-semibold text-amber-200">
                        {scoreProviderById(provider.providerId)}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-stone-500">
                        score
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-stone-300">{provider.role}</p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-stone-900/80 p-3">
                      <div className="text-stone-500">Auth / readiness</div>
                      <div className="mt-1 font-medium text-stone-200">
                        {provider.authState.replace(/_/g, " ")}
                      </div>
                    </div>
                    <div className="rounded-xl bg-stone-900/80 p-3">
                      <div className="text-stone-500">Boundary</div>
                      <div className="mt-1 font-medium text-stone-200">{provider.boundary}</div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-stone-800 bg-stone-900/50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                      Toolbox use
                    </div>
                    <p className="mt-2 text-xs leading-5 text-stone-300">{provider.toolboxUse}</p>
                  </div>

                  <details className="mt-3 rounded-xl border border-stone-800 bg-stone-900/40 p-3 text-xs text-stone-300">
                    <summary className="cursor-pointer font-semibold text-stone-100">
                      Actions, evidence, fallback
                    </summary>
                    <div className="mt-3 grid gap-3">
                      <div>
                        <div className="font-semibold text-emerald-200">Allowed</div>
                        <p className="mt-1 leading-5">{provider.allowedActions.join(", ")}</p>
                      </div>
                      <div>
                        <div className="font-semibold text-red-200">Blocked</div>
                        <p className="mt-1 leading-5">{provider.blockedActions.join(", ")}</p>
                      </div>
                      <div>
                        <div className="font-semibold text-amber-200">Evidence contract</div>
                        <p className="mt-1 leading-5">{provider.evidenceRequirements.join(", ")}</p>
                      </div>
                      <div>
                        <div className="font-semibold text-sky-200">WDC handoff</div>
                        <p className="mt-1 leading-5">{provider.handoffToWdc}</p>
                      </div>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>

      <section className="grid gap-4 border-t border-stone-800/80 p-5 xl:grid-cols-[1fr_1fr] xl:p-7">
        <div className="rounded-[1.5rem] border border-stone-800 bg-stone-950/70 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-400">
            Proof ledger
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {proofLedger.map((item) => (
              <article
                className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4"
                key={item.stage}
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold capitalize text-stone-100">{item.stage}</h4>
                  <span className="rounded-full border border-stone-700 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-stone-300">
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-300">{item.evidence}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-stone-800 bg-stone-950/70 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-400">
            Demand examples and acceptance gates
          </h3>
          <div className="mt-4 grid gap-3">
            {exampleDemands.slice(-2).map((demand) => (
              <article
                className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4"
                key={demand.demand}
              >
                <h4 className="font-semibold text-stone-100">{demand.demand}</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {providersForDemand(demand)
                    .slice(0, 5)
                    .map((provider) => (
                      <span
                        className="rounded-full bg-stone-800 px-2 py-1 text-xs text-stone-300"
                        key={provider.id}
                      >
                        {provider.label}: {scoreProviderById(provider.id)}
                      </span>
                    ))}
                </div>
              </article>
            ))}
            <div className="grid gap-2 md:grid-cols-5">
              {capabilityAcceptanceGates.map((gate) => (
                <div className="rounded-xl bg-stone-900/70 p-3" key={gate.gate}>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                    {gate.gate}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-stone-400">{gate.passCondition}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-stone-800/80 bg-black/30 px-5 py-4 text-xs leading-5 text-stone-500 xl:px-7">
        <span className="font-semibold text-stone-300">Claim language:</span> this surface may say
        the capability cockpit flow is candidate/L1 proof-tested when local build, route and ratchet
        evidence are attached. It must avoid completion-grade, adoption-proof, global-governance and
        claim-readiness language until the required deployed SHA, browser artifact and EventSpine
        replay gates exist.
      </div>

      <aside className="sr-only">
        Demand ingress surfaces: {demandIngressMatrix.map((entry) => entry.label).join(", ")}.
        Providers available: {candidateProviders.map((provider) => provider.label).join(", ")}.
      </aside>
    </section>
  );
}

export default CapabilityResolverPanel;
