import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Newspaper, RefreshCw, ExternalLink, TrendingUp, AlertCircle, Globe, Database, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NewsItem, NewsResponse } from "@/routes/api/news";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Nyheder · WidgeTDC Aurora" },
      { name: "description", content: "Intelligence feed kurateret af dine mest brugte platform-noder." },
    ],
  }),
  component: NewsPage,
});

const SOURCE_META: Record<NewsItem["source"], { label: string; color: string; icon: typeof Globe }> = {
  ekstern: { label: "Ekstern", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Globe },
  marked:  { label: "Marked",  color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: BarChart2 },
  intern:  { label: "Intern",  color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: Database },
};

function relTime(ts: string | null): string {
  if (!ts) return "";
  const d = Date.now() - new Date(ts).getTime();
  if (d < 0) return "";
  if (d < 60_000) return "lige nu";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} t`;
  return `${Math.floor(d / 86_400_000)} d`;
};

function SourceBadge({ source }: { source: NewsItem["source"] }) {
  const m = SOURCE_META[source];
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", m.color)}>
      <Icon className="h-2.5 w-2.5" />
      {m.label}
    </span>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="group flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-4 shadow-soft transition hover:border-border hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <SourceBadge source={item.source} />
          {item.domain && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.domain}
            </span>
          )}
          {item.pattern_name && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {item.pattern_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.harvested_at && (
            <span className="text-[10px] text-muted-foreground/50">{relTime(item.harvested_at)}</span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-primary"
              aria-label="Åbn kilde"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold leading-snug text-card-foreground">{item.title}</h3>
        {item.summary && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-3 leading-relaxed">{item.summary}</p>
        )}
      </div>

      {item.score > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-1 rounded-full bg-primary/60 transition-all"
              style={{ width: `${Math.min(100, Math.round(item.score * 100))}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground/50">
            {Math.round(item.score * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-card p-16 text-center shadow-soft">
      <Newspaper className="h-10 w-10 text-muted-foreground/30" />
      <div>
        <p className="text-sm font-medium">Ingen intelligence endnu</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Start en høst for at indsamle ekstern intel baseret på dine mest brugte patterns.
        </p>
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        {refreshing ? "Henter…" : "Start høst"}
      </button>
    </div>
  );
}

function NewsPage() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as NewsResponse;
      setData(json);
    } catch (e) {
      setError("Kunne ikke hente nyheder.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/news/refresh", { method: "POST" });
      // Wait a moment for fast searches to land, then reload
      await new Promise((r) => setTimeout(r, 3000));
      await fetchNews();
    } finally {
      setRefreshing(false);
    }
  };

  const items = data?.items ?? [];
  const domains = data?.top_domains ?? [];
  const filtered = activeDomain ? items.filter((i) => i.domain === activeDomain) : items;

  const grouped: Record<string, NewsItem[]> = {};
  for (const item of filtered) {
    if (!grouped[item.domain]) grouped[item.domain] = [];
    grouped[item.domain].push(item);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Newspaper className="h-5 w-5 text-primary" />
              Intelligence Feed
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kurateret af dine mest brugte graph-noder · {items.length} emner
              {data?.last_refreshed && (
                <span className="ml-2 text-muted-foreground/50">
                  · opdateret {relTime(data.last_refreshed)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-[13px] font-medium hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Henter…" : "Opdatér"}
          </button>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Error from API */}
        {!loading && data?.error && items.length === 0 && (
          <EmptyState onRefresh={handleRefresh} refreshing={refreshing} />
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card" />
            ))}
          </div>
        )}

        {!loading && items.length > 0 && (
          <>
            {/* Domain filter pills */}
            {domains.length > 1 && (
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveDomain(null)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    activeDomain === null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 text-muted-foreground hover:bg-accent",
                  )}
                >
                  Alle
                </button>
                {domains.map((d) => (
                  <button
                    key={d}
                    onClick={() => setActiveDomain(activeDomain === d ? null : d)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
                      activeDomain === d
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <TrendingUp className="h-3 w-3" />
                    {d}
                  </button>
                ))}
              </div>
            )}

            {/* Feed — grouped by domain when "All" selected, flat when filtered */}
            {activeDomain ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((item) => (
                  <NewsCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="mt-6 space-y-8">
                {Object.entries(grouped).map(([domain, domainItems]) => (
                  <section key={domain}>
                    <div className="mb-3 flex items-center gap-2">
                      <h2 className="text-[13px] font-semibold">{domain}</h2>
                      <span className="text-[11px] text-muted-foreground/50">{domainItems.length} emner</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {domainItems.map((item) => (
                        <NewsCard key={item.id} item={item} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
