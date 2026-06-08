/**
 * /adoption — Runtime adoption dashboard (B19 / LIN-1915).
 *
 * Dedicated route that surfaces the live adoption picture from 6 deployed
 * MCP sources. Separate from /dashboard (which focuses on approval queues
 * and conversation activity) so each surface stays focused.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowLeft } from "lucide-react";
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
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="bg-gradient-aurora bg-clip-text text-3xl font-semibold text-transparent">
              Runtime adoption
            </h1>
            <p className="mt-2 text-muted-foreground">
              Live MCP-sourced metrics — every number is a fresh tool call. No docs, no synthetic
              numbers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-soft hover:bg-accent"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-soft hover:bg-accent"
            >
              <Activity className="h-3.5 w-3.5" />
              Chat
            </Link>
          </div>
        </header>

        <div className="mt-8">
          <AdoptionDashboardPanel />
        </div>
      </div>
    </div>
  );
}
