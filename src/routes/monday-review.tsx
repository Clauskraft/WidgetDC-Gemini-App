/**
 * Monday Morning Review — Figma screens 3A + 3B
 *
 * 3A: Ugentlig briefing med action-inbox (prioriterede handlinger denne uge)
 * 3B: KPI-tiles + aktive engagements-grid + top patterns
 *
 * Data: /api/monday-review → graph (Engagement + WorkArtifact + Pattern)
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Briefcase,
  FileText,
  BookOpen,
  TrendingUp,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import type {
  MondayReviewResponse,
  EngagementSummary,
  ActionItem,
} from "./api/monday-review";

export const Route = createFileRoute("/monday-review")({
  head: () => ({
    meta: [
      { title: "Monday Review — WidgeTDC Aurora" },
      {
        name: "description",
        content: "Ugentlig briefing og KPI-oversigt for aktive konsulent-engagements.",
      },
    ],
  }),
  component: MondayReviewRoute,
});

// ─── Confidence-dots (workshop 16d) ───────────────────────────────────────────
function engagementScore(e: EngagementSummary): number {
  let s = 0;
  if (e.pattern_count >= 3) s += 0.35;
  else if (e.pattern_count >= 1) s += 0.15;
  if (e.client) s += 0.20;
  if (e.domain) s += 0.20;
  if (e.artifact_count >= 1) s += 0.25;
  return s;
}

type ConfidenceLevel = "velbelagt" | "indikativt" | "eksplorativt";
function scoreToLevel(score: number): ConfidenceLevel {
  if (score >= 0.8) return "velbelagt";
  if (score >= 0.6) return "indikativt";
  return "eksplorativt";
}
const DOTS: Record<ConfidenceLevel, { dots: string; color: string }> = {
  velbelagt: { dots: "●●●", color: "text-emerald-600 dark:text-emerald-400" },
  indikativt: { dots: "●●○", color: "text-amber-600 dark:text-amber-400" },
  eksplorativt: { dots: "●○○", color: "text-rose-600 dark:text-rose-400" },
};
// ──────────────────────────────────────────────────────────────────────────────

const ACTION_PRIORITY: Record<ActionItem["priority"], { icon: React.ReactNode; border: string; bg: string }> = {
  high: {
    icon: <AlertCircle className="h-4 w-4 text-rose-500" />,
    border: "border-rose-500/25",
    bg: "bg-rose-500/5",
  },
  medium: {
    icon: <Info className="h-4 w-4 text-amber-500" />,
    border: "border-amber-500/25",
    bg: "bg-amber-500/5",
  },
  low: {
    icon: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
    border: "border-border",
    bg: "bg-background",
  },
};

type View = "briefing" | "kpi";

function MondayReviewRoute() {
  const [data, setData] = useState<MondayReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("briefing");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/monday-review");
      const body = (await res.json()) as MondayReviewResponse;
      if (!res.ok || body.error) {
        setError(body.error ?? `Fejl (${res.status})`);
      } else {
        setData(body);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netværksfejl");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-aurora shadow-glow">
          <Calendar className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Monday Morning Review</h1>
          <p className="text-xs text-muted-foreground">
            {data?.week_label ?? "Ugentlig briefing — aktive engagements"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex rounded-lg border border-input overflow-hidden text-xs">
            {(["briefing", "kpi"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 font-medium transition",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {v === "briefing" ? "Briefing" : "KPI-oversigt"}
              </button>
            ))}
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Opdatér
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 shrink-0 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading placeholder */}
      {loading && !data && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Content */}
      {data && (
        <div className="flex-1 overflow-y-auto">
          {view === "briefing" ? (
            <BriefingView data={data} />
          ) : (
            <KpiView data={data} />
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && !error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Ingen data tilgængeligt endnu.</p>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Hent data
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 3A: Briefing view ─────────────────────────────────────────────────────
function BriefingView({ data }: { data: MondayReviewResponse }) {
  const highActions = data.action_items.filter((a) => a.priority === "high");
  const otherActions = data.action_items.filter((a) => a.priority !== "high");

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
      {/* Left col — action inbox */}
      <div className="lg:col-span-2 space-y-6">
        {/* B2: Live KPI spotlight — 3 primære KPI-tiles */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <LiveKpiTile
            icon={<Briefcase className="h-5 w-5" />}
            label="Aktive engagementer"
            value={data.stats.active_engagements}
            sub={`af ${data.stats.total_engagements} total`}
            colorCls="bg-primary/10 text-primary"
            live
          />
          <LiveKpiTile
            icon={<TrendingUp className="h-5 w-5" />}
            label="Gns. confidence"
            value={data.stats.avg_confidence}
            sub="engagement health score"
            colorCls={
              data.stats.avg_confidence >= 70
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : data.stats.avg_confidence >= 40
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            }
            unit="%"
            live
          />
          <LiveKpiTile
            icon={<AlertCircle className="h-5 w-5" />}
            label="Åbne action items"
            value={data.stats.open_action_items}
            sub="kræver opmærksomhed"
            colorCls={
              data.stats.open_action_items === 0
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : data.stats.open_action_items <= 3
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            }
            live
          />
        </div>

        {/* Ugentlig KPI-strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile
            icon={<Briefcase className="h-4 w-4" />}
            label="Aktive engagements"
            value={data.stats.active_engagements}
            total={data.stats.total_engagements}
            color="text-primary"
          />
          <KpiTile
            icon={<FileText className="h-4 w-4" />}
            label="Seneste deliverables"
            value={data.stats.recent_artifacts}
            color="text-emerald-600 dark:text-emerald-400"
          />
          <KpiTile
            icon={<BookOpen className="h-4 w-4" />}
            label="Pattern-anvendelser"
            value={data.stats.patterns_used}
            color="text-violet-600 dark:text-violet-400"
          />
          <KpiTile
            icon={<TrendingUp className="h-4 w-4" />}
            label="Top patterns"
            value={data.top_patterns.length}
            color="text-amber-600 dark:text-amber-400"
          />
        </div>

        {/* Action inbox */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            Handlinger denne uge
          </h2>
          {data.action_items.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-6 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Alt er up-to-date</p>
              <p className="mt-1 text-xs text-emerald-600/70 dark:text-emerald-400/70">
                Alle aktive engagements har patterns og deliverables.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {highActions.length > 0 && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Høj prioritet
                </p>
              )}
              {data.action_items.map((action, i) => {
                const cfg = ACTION_PRIORITY[action.priority];
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-4",
                      cfg.border,
                      cfg.bg,
                    )}
                  >
                    <div className="mt-0.5 shrink-0">{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {action.engagement_name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {action.message}
                      </p>
                    </div>
                    <Link
                      to="/engagements"
                      className="shrink-0 inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground border border-border hover:bg-accent transition"
                    >
                      Åbn
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Seneste deliverables */}
        {data.recent_artifacts.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Seneste deliverables
            </h2>
            <div className="space-y-2">
              {data.recent_artifacts.slice(0, 5).map((art) => (
                <div
                  key={art.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{art.title}</p>
                    <p className="text-xs text-muted-foreground">{art.engagement_name}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {art.kind}
                    </span>
                    {art.signed_status === null && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[10px] text-amber-600">
                        afventer
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {art.citations} cit.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Right col — top patterns + quick nav */}
      <div className="space-y-5">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            Mest anvendte patterns
          </h2>
          {data.top_patterns.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ingen patterns koblet endnu.</p>
          ) : (
            <div className="space-y-2">
              {data.top_patterns.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                    {p.domain && (
                      <p className="text-[10px] text-muted-foreground">{p.domain}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] font-medium text-primary">
                    {p.engagement_count}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick navigation */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Hurtig navigation
          </h2>
          <div className="space-y-1.5">
            {[
              { to: "/engagements", icon: <Briefcase className="h-4 w-4" />, label: "Engagements" },
              { to: "/patterns", icon: <BookOpen className="h-4 w-4" />, label: "Pattern Library" },
              { to: "/deliverable", icon: <FileText className="h-4 w-4" />, label: "Deliverables" },
            ].map((nav) => (
              <Link
                key={nav.to}
                to={nav.to}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                {nav.icon}
                <span className="flex-1">{nav.label}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── 3B: KPI + engagement-grid ─────────────────────────────────────────────
function KpiView({ data }: { data: MondayReviewResponse }) {
  return (
    <div className="p-6 space-y-6">
      {/* B2: Live KPI tiles — prominent 3-tile row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <LiveKpiTile
          icon={<Briefcase className="h-5 w-5" />}
          label="Aktive engagementer"
          value={data.stats.active_engagements}
          sub={`af ${data.stats.total_engagements} total`}
          colorCls="bg-primary/10 text-primary"
          live
        />
        <LiveKpiTile
          icon={<TrendingUp className="h-5 w-5" />}
          label="Gns. confidence"
          value={data.stats.avg_confidence}
          sub="engagement health score"
          colorCls={
            data.stats.avg_confidence >= 70
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : data.stats.avg_confidence >= 40
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
          }
          unit="%"
          live
        />
        <LiveKpiTile
          icon={<AlertCircle className="h-5 w-5" />}
          label="Åbne action items"
          value={data.stats.open_action_items}
          sub="kræver opmærksomhed"
          colorCls={
            data.stats.open_action_items === 0
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : data.stats.open_action_items <= 3
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
          }
          live
        />
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          icon={<Briefcase className="h-5 w-5" />}
          label="Aktive"
          value={data.stats.active_engagements}
          sub={`af ${data.stats.total_engagements} total`}
          colorCls="bg-primary/10 text-primary"
        />
        <KpiCard
          icon={<FileText className="h-5 w-5" />}
          label="Deliverables"
          value={data.stats.recent_artifacts}
          sub="producerede"
          colorCls="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Pattern-brug"
          value={data.stats.patterns_used}
          sub="engagement-kobl."
          colorCls="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Top patterns"
          value={data.top_patterns.length}
          sub="i brug"
          colorCls="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Engagement grid med health */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Alle engagements — evidensoversigt
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.engagements.map((e) => (
            <EngagementHealthCard key={e.id} engagement={e} />
          ))}
        </div>
      </section>
    </div>
  );
}

function LiveKpiTile({
  icon,
  label,
  value,
  sub,
  colorCls,
  unit,
  live,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  colorCls: string;
  unit?: string;
  live?: boolean;
}) {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-5 overflow-hidden">
      {live && (
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      )}
      <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl", colorCls)}>
        {icon}
      </div>
      <p className="text-3xl font-bold text-foreground tabular-nums">
        {value}{unit}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function KpiTile({
  icon,
  label,
  value,
  total,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total?: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={cn("mb-2 w-fit", color)}>{icon}</div>
      <p className="text-2xl font-bold text-foreground">
        {value}
        {total != null && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">/ {total}</span>
        )}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  colorCls,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  colorCls: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl", colorCls)}>
        {icon}
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function EngagementHealthCard({ engagement }: { engagement: EngagementSummary }) {
  const score = engagementScore(engagement);
  const level = scoreToLevel(score);
  const dot = DOTS[level];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="line-clamp-2 text-sm font-medium text-foreground leading-snug">
          {engagement.name}
        </span>
        <span className={cn("shrink-0 font-mono text-[10px] tracking-widest", dot.color)}>
          {dot.dots}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {engagement.domain && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {engagement.domain}
          </span>
        )}
        {engagement.client && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {engagement.client}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <BookOpen className="h-3 w-3" />
          {engagement.pattern_count} patterns
        </span>
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {engagement.artifact_count} deliverables
        </span>
      </div>

      {/* Health bar */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            level === "velbelagt"
              ? "bg-emerald-500"
              : level === "indikativt"
              ? "bg-amber-500"
              : "bg-rose-500",
          )}
          style={{ width: `${Math.round(score * 100)}%` }}
        />
      </div>
    </div>
  );
}
