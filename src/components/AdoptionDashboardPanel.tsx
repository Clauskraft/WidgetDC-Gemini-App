/**
 * AdoptionDashboardPanel — runtime adoption surface (B19 / LIN-1915).
 *
 * Renders the live runtime adoption picture from 6 deployed sources:
 *
 *   1. Deployed SHA card           ← GET /health
 *   2. DAU / WAU / activation      ← audit.adoption_metrics
 *   3. Adoption funnel             ← audit.adoption_metrics (funnel)
 *   4. Top tools                   ← audit.adoption_metrics (topTools)
 *   5. Intent stats                ← intent.stats
 *   6. Enforcement (24h)           ← audit.enforce
 *   7. A2A bridge health           ← wonder.a2a.reconcile + wonder.status
 *
 * Auto-refreshes every 60 s. Each card surfaces its own source + last-fetched
 * timestamp. Errors render in-place (the dashboard never hides degradation).
 *
 * All numbers are LIVE — no docs, no synthetic metrics, no mocks.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  GitCommit,
  Hash,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";

type Status = "OK" | "DEGRADED" | "BLOCKED" | "UNKNOWN";

type Result<T> =
  | { ok: true; data: T; fetchedAt: string }
  | { ok: false; error: string; status?: number; fetchedAt: string };

type Snapshot = {
  deployedHealth: Result<{
    status: string;
    commitSha: string | null;
    shortCommitSha: string | null;
  }>;
  adoptionMetrics: Result<{
    dau: number;
    wau: number;
    activationRate: number;
    featureCoverage: number;
    adoptionFunnel: {
      aware: number;
      onboarded: number;
      activated: number;
      regular: number;
      power: number;
    };
    topTools: { name: string; count: number }[];
  }>;
  intentStats: Result<{
    toolCount: number;
    patternCount: number;
    edgeCount: number;
    avgConfidence: number;
  }>;
  enforcement: Result<{ enforced: boolean; violations24h: number; totalChecks: number }>;
  a2aReconcile: Result<{ status: Status; detail?: string }>;
  wonderStatus: Result<{ status: Status; a2aBridge: Status; detail?: string }>;
  generatedAt: string;
};

const REFRESH_MS = 60_000;

function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(d) || d < 0) return iso;
  if (d < 60_000) return "lige nu";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min siden`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} t siden`;
  return new Date(iso).toLocaleString("da-DK");
}

function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  // accept either 0..1 or 0..100 — auto-scale
  const v = n > 1.5 ? n : n * 100;
  return `${v.toFixed(1)}%`;
}

export function AdoptionDashboardPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [topErr, setTopErr] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    setTopErr(null);
    try {
      const res = await fetch("/api/adoption/metrics", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setTopErr(`fetch failed: HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const body = (await res.json()) as { ok: boolean; snapshot?: Snapshot; error?: string };
      if (!body.ok || !body.snapshot) {
        setTopErr(body.error ?? "malformed response");
        setLoading(false);
        return;
      }
      setSnapshot(body.snapshot);
    } catch (e) {
      setTopErr(e instanceof Error ? e.message : "network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSnapshot();
    const id = setInterval(() => void fetchSnapshot(), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchSnapshot]);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium">Runtime adoption</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            live · auto-refresh 60s
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>updated {snapshot ? relTime(snapshot.generatedAt) : "—"}</span>
          <button
            type="button"
            onClick={() => void fetchSnapshot()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh
          </button>
        </div>
      </header>

      {topErr ? (
        <div className="flex items-center gap-2 border-b border-border bg-destructive/10 px-5 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {topErr}
        </div>
      ) : null}

      <div className="grid gap-3 p-5 md:grid-cols-2 lg:grid-cols-3">
        <DeployedShaCard result={snapshot?.deployedHealth} />
        <ActivationCard result={snapshot?.adoptionMetrics} />
        <FunnelCard result={snapshot?.adoptionMetrics} />
        <TopToolsCard result={snapshot?.adoptionMetrics} />
        <IntentStatsCard result={snapshot?.intentStats} />
        <EnforcementCard result={snapshot?.enforcement} />
        <A2AHealthCard a2a={snapshot?.a2aReconcile} wonder={snapshot?.wonderStatus} />
      </div>
    </section>
  );
}

// ── Cards ──────────────────────────────────────────────────────────────────

function CardShell({
  icon: Icon,
  title,
  source,
  fetchedAt,
  children,
}: {
  icon: typeof Activity;
  title: string;
  source: string;
  fetchedAt: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4 shadow-soft">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          <span className="font-medium">{title}</span>
        </div>
        <span className="font-mono text-[10px]">{source}</span>
      </div>
      <div className="mt-3">{children}</div>
      <div className="mt-3 text-[10px] text-muted-foreground">fetched {relTime(fetchedAt)}</div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      <span className="font-mono">{message}</span>
    </div>
  );
}

function LoadingState() {
  return <div className="h-8 w-full animate-pulse rounded bg-muted" />;
}

function DeployedShaCard({ result }: { result?: Snapshot["deployedHealth"] }) {
  return (
    <CardShell
      icon={GitCommit}
      title="Deployed SHA"
      source="GET /health"
      fetchedAt={result?.fetchedAt}
    >
      {!result ? (
        <LoadingState />
      ) : !result.ok ? (
        <ErrorState message={`${result.error}${result.status ? ` (${result.status})` : ""}`} />
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
              {result.data.shortCommitSha ?? "—"}
            </code>
            <button
              type="button"
              onClick={() => {
                if (result.data.commitSha) {
                  void navigator.clipboard?.writeText(result.data.commitSha);
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
              title={result.data.commitSha ?? ""}
            >
              copy full SHA
            </button>
          </div>
          <div className="mt-2 inline-flex items-center gap-1 text-xs">
            {result.data.status === "ok" || result.data.status === "healthy" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
            )}
            <span className="text-muted-foreground">status: {result.data.status}</span>
          </div>
        </div>
      )}
    </CardShell>
  );
}

function ActivationCard({ result }: { result?: Snapshot["adoptionMetrics"] }) {
  return (
    <CardShell
      icon={Zap}
      title="Activation"
      source="audit.adoption_metrics"
      fetchedAt={result?.fetchedAt}
    >
      {!result ? (
        <LoadingState />
      ) : !result.ok ? (
        <ErrorState message={result.error} />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="DAU" value={String(result.data.dau)} />
          <Stat label="WAU" value={String(result.data.wau)} />
          <Stat label="Activation" value={pct(result.data.activationRate)} />
        </div>
      )}
    </CardShell>
  );
}

function FunnelCard({ result }: { result?: Snapshot["adoptionMetrics"] }) {
  const max = result?.ok
    ? Math.max(
        1,
        result.data.adoptionFunnel.aware,
        result.data.adoptionFunnel.onboarded,
        result.data.adoptionFunnel.activated,
        result.data.adoptionFunnel.regular,
        result.data.adoptionFunnel.power,
      )
    : 1;
  return (
    <CardShell
      icon={TrendingUp}
      title="Adoption funnel"
      source="audit.adoption_metrics"
      fetchedAt={result?.fetchedAt}
    >
      {!result ? (
        <LoadingState />
      ) : !result.ok ? (
        <ErrorState message={result.error} />
      ) : (
        <ul className="space-y-1.5">
          {(["aware", "onboarded", "activated", "regular", "power"] as const).map((stage) => {
            const v = result.data.adoptionFunnel[stage];
            const width = Math.max(4, Math.round((v / max) * 100));
            return (
              <li key={stage} className="text-xs">
                <div className="flex items-baseline justify-between">
                  <span className="capitalize text-muted-foreground">{stage}</span>
                  <span className="font-mono tabular-nums">{v}</span>
                </div>
                <div className="mt-0.5 h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CardShell>
  );
}

function TopToolsCard({ result }: { result?: Snapshot["adoptionMetrics"] }) {
  return (
    <CardShell
      icon={Wrench}
      title="Top tools"
      source="audit.adoption_metrics"
      fetchedAt={result?.fetchedAt}
    >
      {!result ? (
        <LoadingState />
      ) : !result.ok ? (
        <ErrorState message={result.error} />
      ) : result.data.topTools.length === 0 ? (
        <div className="text-xs text-muted-foreground">No tool activity yet.</div>
      ) : (
        <ol className="space-y-1 text-xs">
          {result.data.topTools.map((t, i) => (
            <li key={t.name} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 text-right text-muted-foreground tabular-nums">{i + 1}.</span>
                <span className="truncate font-mono">{t.name}</span>
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">{t.count}</span>
            </li>
          ))}
        </ol>
      )}
    </CardShell>
  );
}

function IntentStatsCard({ result }: { result?: Snapshot["intentStats"] }) {
  const conf = result?.ok ? result.data.avgConfidence : 0;
  const confColor =
    conf >= 0.8 ? "text-emerald-500" : conf >= 0.6 ? "text-yellow-500" : "text-destructive";
  return (
    <CardShell
      icon={Hash}
      title="Intent classifier"
      source="intent.stats"
      fetchedAt={result?.fetchedAt}
    >
      {!result ? (
        <LoadingState />
      ) : !result.ok ? (
        <ErrorState message={result.error} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Tools" value={String(result.data.toolCount)} />
            <Stat label="Patterns" value={String(result.data.patternCount)} />
            <Stat label="Edges" value={String(result.data.edgeCount)} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <Stat label="Avg conf" value={conf.toFixed(2)} valueClassName={confColor} />
          </div>
        </>
      )}
    </CardShell>
  );
}

function EnforcementCard({ result }: { result?: Snapshot["enforcement"] }) {
  return (
    <CardShell
      icon={ShieldCheck}
      title="Enforcement (24h)"
      source="audit.enforce"
      fetchedAt={result?.fetchedAt}
    >
      {!result ? (
        <LoadingState />
      ) : !result.ok ? (
        <ErrorState message={result.error} />
      ) : (
        <div>
          <div className="flex items-center gap-2">
            {result.data.enforced ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-sm font-medium">
              {result.data.enforced ? "enforced" : "advisory"}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Stat
              label="Violations"
              value={String(result.data.violations24h)}
              valueClassName={result.data.violations24h > 0 ? "text-destructive" : undefined}
            />
            <Stat label="Checks" value={String(result.data.totalChecks)} />
          </div>
        </div>
      )}
    </CardShell>
  );
}

function A2AHealthCard({
  a2a,
  wonder,
}: {
  a2a?: Snapshot["a2aReconcile"];
  wonder?: Snapshot["wonderStatus"];
}) {
  const fetchedAt = useMemo(() => {
    const a = a2a?.fetchedAt;
    const w = wonder?.fetchedAt;
    return a && w ? (a > w ? a : w) : (a ?? w);
  }, [a2a, wonder]);
  return (
    <CardShell
      icon={Cpu}
      title="A2A bridge"
      source="wonder.status + wonder.a2a.reconcile"
      fetchedAt={fetchedAt}
    >
      {!a2a || !wonder ? (
        <LoadingState />
      ) : (
        <div className="space-y-2">
          <RowStatus
            label="wonder.status"
            value={wonder.ok ? wonder.data.status : "ERROR"}
            error={!wonder.ok ? wonder.error : undefined}
          />
          <RowStatus
            label="a2a.reconcile"
            value={a2a.ok ? a2a.data.status : "ERROR"}
            error={!a2a.ok ? a2a.error : undefined}
          />
          <RowStatus
            label="wonder a2a bridge"
            value={wonder.ok ? wonder.data.a2aBridge : "UNKNOWN"}
          />
        </div>
      )}
    </CardShell>
  );
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={classNames("text-base font-semibold tabular-nums", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

function statusBadgeColor(status: Status | "ERROR"): string {
  switch (status) {
    case "OK":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    case "DEGRADED":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
    case "BLOCKED":
    case "ERROR":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function RowStatus({
  label,
  value,
  error,
}: {
  label: string;
  value: Status | "ERROR";
  error?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="font-mono text-muted-foreground">{label}</span>
      <span
        className={classNames(
          "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
          statusBadgeColor(value),
        )}
        title={error}
      >
        {value}
      </span>
    </div>
  );
}
