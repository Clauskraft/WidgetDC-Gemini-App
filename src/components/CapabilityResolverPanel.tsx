import {
  capabilityAcceptanceGates,
  capabilityResolutionFlow,
  candidateProviders,
  demandIngressMatrix,
  exampleDemands,
  geminiUxContract,
  providersForDemand,
  scoreProviderById,
} from "../lib/capabilityOrchestration";
import { WdcLogo } from "./WdcLogo";

export function CapabilityResolverPanel() {
  return (
    <section className="rounded-3xl border border-stone-700/40 bg-stone-950 p-5 text-stone-100 shadow-2xl">
      <header className="flex flex-col gap-4 border-b border-stone-800 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <WdcLogo size="sm" showWordmark />
            <span className="rounded-full border border-amber-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
              Capability-first
            </span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Universal Capability Orchestration
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-stone-300">
            Demand is resolved into capabilities before routing. Providers are scored by fit, proof
            history, cost, latency, risk, and compliance. Gemini App remains a UX surface for
            visibility and review, not a privileged orchestrator.
          </p>
        </div>
        <div className="rounded-2xl border border-stone-700 bg-stone-900/80 p-4 text-sm">
          <div className="text-stone-400">Claim ceiling</div>
          <div className="mt-1 text-lg font-semibold text-amber-200">L1</div>
          <div className="mt-2 text-xs text-stone-500">No graph writes. No claim promotion.</div>
        </div>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
            Resolution flow
          </h3>
          <ol className="mt-4 grid gap-2">
            {capabilityResolutionFlow.map((step, index) => (
              <li
                className="flex items-center gap-3 rounded-xl bg-stone-950/70 px-3 py-2"
                key={step}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-300 text-xs font-bold text-stone-950">
                  {index + 1}
                </span>
                <span className="text-sm text-stone-200">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
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

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {demandIngressMatrix.map((entry) => (
          <article
            className="rounded-2xl border border-stone-800 bg-stone-900/50 p-4"
            key={entry.surface}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{entry.label}</h3>
              <span className="rounded-full bg-stone-800 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-stone-300">
                {entry.evidenceClass}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-300">{entry.role}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-stone-950/70 p-2">
                <dt className="text-stone-500">First gate</dt>
                <dd className="mt-1 font-medium text-stone-200">{entry.firstGate}</dd>
              </div>
              <div className="rounded-xl bg-stone-950/70 p-2">
                <dt className="text-stone-500">Write allowed</dt>
                <dd className="mt-1 font-medium text-stone-200">
                  {entry.writeAllowed ? "gated" : "no"}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {exampleDemands.map((demand) => (
          <article
            className="rounded-2xl border border-stone-800 bg-stone-900/50 p-4"
            key={demand.demand}
          >
            <h3 className="font-semibold text-stone-100">{demand.demand}</h3>
            {demand.blockedUnless ? (
              <p className="mt-2 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">
                Blocked unless: {demand.blockedUnless}
              </p>
            ) : null}
            <div className="mt-4 space-y-2">
              {providersForDemand(demand).map((provider) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-xl bg-stone-950/70 px-3 py-2"
                  key={provider.id}
                >
                  <div>
                    <div className="text-sm font-medium">{provider.label}</div>
                    <div className="text-xs text-stone-500">
                      {provider.riskClass} / {provider.runtimeStatus}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-amber-200">
                      {scoreProviderById(provider.id)}
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500">
                      score
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <footer className="mt-5 grid gap-3 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 md:grid-cols-5">
        {capabilityAcceptanceGates.map((gate) => (
          <div className="rounded-xl bg-stone-950/70 p-3" key={gate.gate}>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
              {gate.gate}
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-400">{gate.passCondition}</p>
          </div>
        ))}
      </footer>

      <aside className="sr-only">
        Providers available: {candidateProviders.map((provider) => provider.label).join(", ")}
      </aside>
    </section>
  );
}

export default CapabilityResolverPanel;
