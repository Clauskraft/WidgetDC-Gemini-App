import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/AppShell/PageShell";
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
  return (
    <PageShell
      title="WDC Audit Factory Cockpit"
      subtitle="Candidate/L1 capability-first cockpit readback — WDC CLI and Agent Office remain the authority."
      previewNotice="Preview — deterministic demo data, not live platform state"
    >
      <AuditFactoryCockpit />
    </PageShell>
  );
}
