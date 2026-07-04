import { createFileRoute } from "@tanstack/react-router";
import { CapabilityCockpit } from "@/components/CapabilityCockpit";

export const Route = createFileRoute("/capabilities")({
  head: () => ({
    meta: [
      { title: "WDC Capability Cockpit" },
      {
        name: "description",
        content:
          "Capability-first Gemini cockpit for DemandIngress, provider scoring, BOM/LegoFactory chain, and proof boundaries. Cockpit-only, no orchestrator authority.",
      },
    ],
  }),
  component: CapabilitiesRoute,
});

function CapabilitiesRoute() {
  return <CapabilityCockpit />;
}
