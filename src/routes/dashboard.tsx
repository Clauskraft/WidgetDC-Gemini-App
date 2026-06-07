import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Activity,
  MessageSquare,
  Sparkles,
  Clock,
  Gem as GemIcon,
  ArrowUpRight,
  Inbox,
  Cpu,
  Layers,
  StickyNote,
} from "lucide-react";
import { useThreads, type Thread } from "@/hooks/useThreads";
import { GEMS, getGem, gemThreadId } from "@/lib/gems";
import { ModelPicker } from "@/components/ModelPicker";
import { getModelMeta, useModelPreference } from "@/lib/modelPreference";


export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · WidgeTDC Aurora" },
      { name: "description", content: "Mission control — live overblik over samtaler, gems og aktivitet." },
    ],
  }),
  component: Dashboard,
});

const DAY = 24 * 60 * 60 * 1000;

function relTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return "lige nu";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min siden`;
  if (d < DAY) return `${Math.floor(d / 3_600_000)} t siden`;
  if (d < 7 * DAY) return `${Math.floor(d / DAY)} d siden`;
  return new Date(ts).toLocaleDateString("da-DK");
}

function detectGemId(threadId: string): string | null {
  // `gem-<id>` konventionen fra gemThreadId().
  const m = threadId.match(/^gem-(.+)$/);
  return m ? m[1] : null;
}

function Dashboard() {
  const { threads, hydrated } = useThreads();
  const [model] = useModelPreference();
  const modelMeta = getModelMeta(model);

  const stats = useMemo(() => {
    const now = Date.now();
    let totalMessages = 0;
    let userMsgs = 0;
    let assistantMsgs = 0;
    const fenceCounts = { mermaid: 0, flow: 0, graph: 0, kg: 0 };
    let canvasNotes = 0;
    for (const t of threads as Thread[]) {
      for (const m of t.messages ?? []) {
        totalMessages++;
        if (m.role === "user") userMsgs++;
        else if (m.role === "assistant") assistantMsgs++;
        const text = (m.parts ?? [])
          .map((p) => (p as { type: string; text?: string }).type === "text" ? (p as { text: string }).text : "")
          .join("\n");
        if (!text) continue;
        // tæl figure-fences pr. type
        const re = /```(mermaid|flow|graph|knowledge-graph|kg)\b/g;
        let mm: RegExpExecArray | null;
        while ((mm = re.exec(text))) {
          const k = mm[1] === "knowledge-graph" ? "kg" : (mm[1] as keyof typeof fenceCounts);
          fenceCounts[k] = (fenceCounts[k] ?? 0) + 1;
        }
        if (/^\s*canvas notes:/im.test(text)) canvasNotes++;
      }
    }
    const active24h = threads.filter((t) => now - t.updatedAt < DAY).length;
    const active7d = threads.filter((t) => now - t.updatedAt < 7 * DAY).length;
    const gemCounts = new Map<string, number>();
    for (const t of threads) {
      const gid = detectGemId(t.id);
      if (gid) gemCounts.set(gid, (gemCounts.get(gid) ?? 0) + 1);
    }
    const topGems = [...gemCounts.entries()]
      .map(([id, count]) => ({ gem: getGem(id), count }))
      .filter((x) => x.gem)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return { totalMessages, userMsgs, assistantMsgs, active24h, active7d, topGems, fenceCounts, canvasNotes };
  }, [threads]);

  const recent = useMemo(() => threads.slice(0, 6), [threads]);
  const totalFigures = stats.fenceCounts.mermaid + stats.fenceCounts.flow + stats.fenceCounts.graph + stats.fenceCounts.kg;

  return (

    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="bg-gradient-aurora bg-clip-text text-3xl font-semibold text-transparent">
              Mission Control
            </h1>
            <p className="mt-2 text-muted-foreground">
              Live overblik over dine samtaler, gems og platform-aktivitet.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ModelPicker variant="full" />
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-soft hover:bg-accent"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ny samtale
            </Link>
          </div>
        </header>

        {/* Live metrics */}
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric
            icon={Cpu}
            label="Aktiv model"
            value={modelMeta?.label ?? model}
            hint={`${modelMeta?.vendor ?? "—"} · ${modelMeta?.tier ?? ""}`}
          />
          <Metric
            icon={MessageSquare}
            label="Samtaler"
            value={hydrated ? String(threads.length) : "—"}
            hint={hydrated ? `${stats.userMsgs} bruger · ${stats.assistantMsgs} svar` : "indlæser…"}
          />
          <Metric
            icon={Activity}
            label="Aktive (24t)"
            value={hydrated ? String(stats.active24h) : "—"}
            hint={hydrated ? `${stats.active7d} sidste 7 dage` : "indlæser…"}
          />
          <Metric
            icon={Clock}
            label="Seneste aktivitet"
            value={hydrated && threads[0] ? relTime(threads[0].updatedAt) : "—"}
            hint={hydrated && threads[0] ? threads[0].title.slice(0, 28) : "ingen samtaler"}
          />
        </div>

        {/* Platform-mix */}
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric icon={Layers} label="Mermaid" value={hydrated ? String(stats.fenceCounts.mermaid) : "—"} hint="diagrammer" />
          <Metric icon={Layers} label="Flow" value={hydrated ? String(stats.fenceCounts.flow) : "—"} hint="CFDS-blokke" />
          <Metric icon={Layers} label="Graph / KG" value={hydrated ? String(stats.fenceCounts.graph + stats.fenceCounts.kg) : "—"} hint={`${totalFigures} figurer i alt`} />
          <Metric icon={StickyNote} label="Canvas-noter" value={hydrated ? String(stats.canvasNotes) : "—"} hint="pinbare indsigter" />
        </div>


        <div className="mt-10 grid gap-6 lg:grid-cols-5">
          {/* Recent threads */}
          <section className="lg:col-span-3 rounded-2xl border border-border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-medium">Seneste samtaler</h2>
              <span className="text-xs text-muted-foreground">
                {hydrated ? `${threads.length} i alt` : ""}
              </span>
            </div>
            {!hydrated ? (
              <ul className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="px-5 py-3">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-muted/60" />
                  </li>
                ))}
              </ul>
            ) : recent.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Ingen samtaler endnu"
                hint="Start en samtale fra forsiden eller via en Gem."
                cta={{ to: "/", label: "Gå til chat" }}
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((t) => {
                  const gid = detectGemId(t.id);
                  const gem = gid ? getGem(gid) : null;
                  return (
                    <li key={t.id}>
                      <Link
                        to="/c/$threadId"
                        params={{ threadId: t.id }}
                        className="group flex items-center justify-between gap-3 px-5 py-3 hover:bg-accent/40"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {gem ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                                {gem.name}
                              </span>
                            ) : null}
                            <span className="truncate text-sm font-medium text-card-foreground">
                              {t.title || "Untitled"}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {t.messages?.length ?? 0} beskeder · {relTime(t.updatedAt)}
                          </div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Gem leaderboard */}
          <section className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-soft">
            <div className="border-b border-border px-5 py-3 text-sm font-medium">
              Mest brugte gems
            </div>
            {!hydrated ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : stats.topGems.length === 0 ? (
              <EmptyState
                icon={GemIcon}
                title="Ingen gem-aktivitet"
                hint={`${GEMS.length} gems venter på at blive prøvet.`}
                cta={{ to: "/gems", label: "Udforsk gems" }}
              />
            ) : (
              <ul className="divide-y divide-border">
                {stats.topGems.map(({ gem, count }) => {
                  if (!gem) return null;
                  const Icon = gem.icon;
                  const max = stats.topGems[0]?.count ?? 1;
                  const pct = Math.max(8, Math.round((count / max) * 100));
                  return (
                    <li key={gem.id}>
                      <Link
                        to="/c/$threadId"
                        params={{ threadId: gemThreadId(gem.id) }}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-accent/40"
                      >
                        <span className={`rounded-md bg-gradient-to-br p-1.5 text-white ${gem.accent}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium">{gem.name}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                          </div>
                          <div className="mt-1 h-1 rounded-full bg-muted">
                            <div
                              className="h-1 rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 truncate text-lg font-semibold">{value}</div>
      <div className="truncate text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  cta,
}: {
  icon: typeof Activity;
  title: string;
  hint: string;
  cta: { to: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
      <Link
        to={cta.to}
        className="mt-2 inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-accent"
      >
        {cta.label}
      </Link>
    </div>
  );
}
