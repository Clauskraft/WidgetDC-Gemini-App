import { createFileRoute } from "@tanstack/react-router";
import { AuditFactoryCockpit } from "@/components/AuditFactoryCockpit";

export const Route = createFileRoute("/audit-factory")({
  head: () => ({
    meta: [
      { title: "WDC Audit Factory Cockpit" },
      {
        name: "description",
        content:
          "Candidate/L1 capability-first WDC audit factory cockpit with readback, proof boundaries and next safe actions.",
      },
    ],
  }),
  component: AuditFactoryRoute,
});

function AuditFactoryRoute() {
  return <AuditFactoryCockpit />;
}
