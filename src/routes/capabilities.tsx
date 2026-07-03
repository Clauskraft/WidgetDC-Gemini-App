import { createFileRoute } from "@tanstack/react-router";
import { CapabilityResolverPanel } from "@/components/CapabilityResolverPanel";

export const Route = createFileRoute("/capabilities")({
  head: () => ({
    meta: [
      { title: "WDC Capability Cockpit" },
      {
        name: "description",
        content:
          "Capability-first Gemini cockpit for DemandIngress, provider scoring, route handoff, and proof boundaries.",
      },
    ],
  }),
  component: CapabilitiesRoute,
});

function CapabilitiesRoute() {
  return (
    <div className="min-h-full flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.12),_transparent_34%),linear-gradient(135deg,_#0c0a09_0%,_#1c1917_52%,_#0f172a_100%)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-[2rem] border border-stone-700/60 bg-stone-950/80 p-6 text-stone-100 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
                Gemini App cockpit surface
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Capability-first resolver cockpit
              </h1>
              <p className="mt-4 text-sm leading-7 text-stone-300 sm:text-base">
                Demand resolves into capabilities before tools or routes are selected. WDC CLI, WDC
                CLI Chat, Orbit, Lovable, and Gemini are visible demand/provider surfaces with
                explicit proof boundaries.
              </p>
            </div>
            <div className="grid gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-50">
              <div className="font-semibold">Authority boundary</div>
              <div>Gemini App is cockpit/UX only.</div>
              <div>
                WDC CLI, Agent Office, Orbit, BOM, and materializers own governed execution.
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["candidate", "Prototype, fixture, or generated UI candidate."],
            ["diagnostic", "CLI, A2A, route, or local readback evidence."],
            ["runtime", "Deployed or governed runtime readback."],
            ["claim", "Promotion-grade proof only after all gates pass."],
          ].map(([label, description]) => (
            <div
              className="rounded-2xl border border-stone-700/50 bg-stone-950/70 p-4 text-stone-100"
              key={label}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
                {label}
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-400">{description}</p>
            </div>
          ))}
        </div>

        <CapabilityResolverPanel />

        <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[1.5rem] border border-stone-700/60 bg-stone-950/75 p-5 text-stone-100">
            <h2 className="text-lg font-semibold">Route/BOM handoff</h2>
            <p className="mt-3 text-sm leading-7 text-stone-300">
              The cockpit can show the handoff from provider scoring to Adaptive BOM, WorkBOM,
              TaskBOM, route, and project tree. It does not execute governed writes from the
              frontend.
            </p>
            <div className="mt-4 grid gap-2 text-sm">
              {[
                "DemandIngress",
                "CapabilityResolver",
                "RequiredCapabilities",
                "CandidateProviders",
                "ProviderScoring",
                "BOM / Route",
                "Execution Surface",
                "Proof",
              ].map((step) => (
                <div
                  className="rounded-xl border border-stone-800 bg-stone-900/70 px-3 py-2 text-stone-300"
                  key={step}
                >
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-red-400/30 bg-red-950/20 p-5 text-stone-100">
            <h2 className="text-lg font-semibold text-red-100">Blocked / next safe action</h2>
            <p className="mt-3 text-sm leading-7 text-red-100/80">
              The frontend must stop if a repo is dirty or unadmitted, required capabilities are
              missing, a provider has no proof history, materializer preview is absent, approval is
              missing, or the UI would exceed the claim ceiling.
            </p>
            <div className="mt-4 rounded-xl border border-red-300/20 bg-red-950/30 p-4 text-sm text-red-100">
              Next safe action: use WDC CLI readback to prove route/BOM/proof state, then mount live
              data in a separate governed slice.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
