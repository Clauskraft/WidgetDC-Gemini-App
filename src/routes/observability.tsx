import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Database } from "lucide-react";
import { PageShell } from "@/components/AppShell/PageShell";

export const Route = createFileRoute("/observability")({
  head: () => ({
    meta: [
      { title: "Observability — WidgeTDC Aurora" },
      {
        name: "description",
        content:
          "Live fleet-sundhed: success-rate, per-tool fejlrater og graf-størrelse fra platformen.",
      },
    ],
  }),
  component: ObservabilityRoute,
});

type ToolHealth = { name: string; calls: number; errors: number; errorRate: number; avgMs: number };
type Summary = {
  runtime: {
    totalAgents: number;
    totalRequests: number;
    successRate: number;
    tools: ToolHealth[];
    source?: "runtime_summary" | "audit.adoption_metrics" | "intent.stats" | "generic";
  } | null;
  graph: { nodes: number; relationships: number; online: boolean } | null;
};

function fmt(n: number): string {
  return n.toLocaleString("da-DK");
}

function ObservabilityRoute() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/observability/summary");
      const body = (await res.json()) as Summary & { error?: string };
      if (!res.ok) setError(body.error ?? `Fejl (${res.status})`);
      else setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netværksfejl");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tools = [...(data?.runtime?.tools ?? [])].sort((a, b) => b.errorRate - a.errorRate);
  const runtimeSource = data?.runtime?.source;
  const successLabel =
    runtimeSource === "audit.adoption_metrics"
      ? "Activation"
      : runtimeSource === "intent.stats"
        ? "Avg. confidence"
        : "Success-rate";
  const requestsLabel =
    runtimeSource === "audit.adoption_metrics"
      ? "Tool events"
      : runtimeSource === "intent.stats"
        ? "Intent edges"
        : "Requests";
  const agentsLabel =
    runtimeSource === "audit.adoption_metrics"
      ? "WAU"
      : runtimeSource === "intent.stats"
        ? "Tools"
        : "Agenter";

  return (
    <PageShell
      title="Observability"
      subtitle="Live fleet-sundhed og graf-størrelse, direkte fra platformens runtime-telemetri."
      icon={<Activity className="h-4 w-4 text-white" />}
      onRefresh={() => void load()}
      refreshing={loading}
    >
      <div>
        {error && (
          <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {data?.runtime && (
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Kpi label={successLabel} value={`${data.runtime.successRate.toFixed(1)}%`} />
            <Kpi label={requestsLabel} value={fmt(data.runtime.totalRequests)} />
            <Kpi label={agentsLabel} value={fmt(data.runtime.totalAgents)} />
          </div>
        )}

        {data?.graph && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
            <Database className="h-4 w-4 text-primary" />
            <span className="font-medium">Knowledge graph</span>
            <span className="text-muted-foreground">
              {fmt(data.graph.nodes)} noder · {fmt(data.graph.relationships)} relationer
            </span>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${
                data.graph.online
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {data.graph.online ? "online" : "offline"}
            </span>
          </div>
        )}

        {tools.length > 0 && (
          <div className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">
              Top værktøjer — fejlrate
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Værktøj</th>
                  <th className="px-4 py-2 text-right font-medium">Kald</th>
                  <th className="px-4 py-2 text-right font-medium">Fejlrate</th>
                  <th className="px-4 py-2 text-right font-medium">Snit ms</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((t) => {
                  const pct = Math.round(t.errorRate * 100);
                  const hot = t.errorRate >= 0.2;
                  return (
                    <tr key={t.name} className="border-t border-border/60">
                      <td className="px-4 py-2 font-mono text-xs">{t.name}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{fmt(t.calls)}</td>
                      <td className="px-4 py-2 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                            hot
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {hot && <AlertTriangle className="h-3 w-3" />}
                          {pct}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{fmt(t.avgMs)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && !data?.runtime && !data?.graph && (
          <p className="text-sm text-muted-foreground">Ingen observability-data tilgængelig.</p>
        )}
      </div>
    </PageShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
