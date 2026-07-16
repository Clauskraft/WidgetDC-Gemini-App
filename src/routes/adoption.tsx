/**
 * /adoption — Runtime adoption dashboard (B19 / LIN-1915).
 *
 * Dedicated route that surfaces the live adoption picture from 6 deployed
 * MCP sources. Separate from /dashboard (which focuses on approval queues
 * and conversation activity) so each surface stays focused.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { PageShell } from "@/components/AppShell/PageShell";
import { AdoptionDashboardPanel } from "@/components/AdoptionDashboardPanel";

export const Route = createFileRoute("/adoption")({
  head: () => ({
    meta: [
      { title: "Runtime adoption · WidgeTDC Aurora" },
      {
        name: "description",
        content:
          "Live runtime adoption metrics — never docs. DAU/WAU, funnel, intent classifier, enforcement, A2A health, deployed SHA.",
      },
    ],
  }),
  component: AdoptionRoute,
});

function AdoptionRoute() {
  return (
    <PageShell
      title="Runtime adoption"
      subtitle="Live MCP-sourced metrics — every number is a fresh tool call. No docs, no synthetic numbers."
      icon={<Activity className="h-4 w-4 text-white" />}
    >
      <AdoptionDashboardPanel />
    </PageShell>
  );
}
