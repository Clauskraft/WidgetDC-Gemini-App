import { createFileRoute } from "@tanstack/react-router";
import { AuditFactoryCockpit } from "@/components/AuditFactoryCockpit";

export const Route = createFileRoute("/audit-factory")({
  head: () => ({
    meta: [
      { title: "WDC Audit Factory Cockpit" },
      {
        name: "description",
        content:
          "Candidate/L1 cockpit for WDC audit-factory readback, graph gaps, A2A handoffs, proof boundaries, and next safe actions.",
      },
    ],
  }),
  component: AuditFactoryRoute,
});

function AuditFactoryRoute() {
  return <AuditFactoryCockpit />;
}
