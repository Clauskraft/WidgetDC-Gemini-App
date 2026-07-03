import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Search,
  RefreshCw,
  Loader2,
  Code2,
  ChevronRight,
  Link2,
  CheckCircle2,
  X,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import type { PatternRow, PatternsResponse } from "./api/patterns";

type EngagementHit = { id: string; name: string; client?: string };
type LinkState = "idle" | "searching" | "linking" | "success" | "error";

export const Route = createFileRoute("/patterns")({
  head: () => ({
    meta: [
      { title: "Pattern Library — WidgeTDC Aurora" },
      {
        name: "description",
        content: "Browse 2.800+ konsulent-patterns fra WidgeTDC knowledge graph.",
      },
    ],
  }),
  component: PatternsRoute,
});

const LIMIT = 24;

function PatternsRoute() {
  const navigate = useNavigate();
  const [patterns, setPatterns] = useState<PatternRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState("");
  const [selected, setSelected] = useState<PatternRow | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPatterns = useCallback(
    async (search: string, domainFilter: string, offset: number, replace: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          skip: String(offset),
          limit: String(LIMIT),
          ...(search ? { q: search } : {}),
          ...(domainFilter ? { domain: domainFilter } : {}),
        });
        const res = await fetch(`/api/patterns?${params}`);
        const body = (await res.json()) as PatternsResponse;
        if (!res.ok) {
          setError(body.error ?? `Fejl (${res.status})`);
        } else {
          setPatterns((prev) => (replace ? body.patterns : [...prev, ...body.patterns]));
          setHasMore(body.hasMore);
          setSkip(offset + body.patterns.length);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Netværksfejl");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchPatterns("", "", 0, true);
  }, [fetchPatterns]);

  const triggerSearch = useCallback(
    (search: string, domainFilter: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSkip(0);
        setPatterns([]);
        setSelected(null);
        void fetchPatterns(search, domainFilter, 0, true);
      }, 320);
    },
    [fetchPatterns],
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel: search + grid */}
      <div
        className={cn(
          "flex flex-col overflow-hidden transition-all",
          selected ? "w-1/2" : "flex-1",
        )}
      >
        {/* Header */}
        <PageHeader
          icon={<BookOpen className="h-4 w-4 text-white" />}
          title="Pattern Library"
          subtitle={patterns.length > 0 ? "patterns" : "WidgeTDC knowledge graph"}
          count={patterns.length > 0 ? `${patterns.length}${hasMore ? "+" : ""}` : undefined}
          onRefresh={() => void fetchPatterns(q, domain, 0, true)}
          refreshing={loading}
        />

        {/* Search bar */}
        <div className="flex shrink-0 gap-2 border-b border-border px-4 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Søg patterns…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                triggerSearch(e.target.value, domain);
              }}
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <input
            type="text"
            placeholder="Domain…"
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              triggerSearch(q, e.target.value);
            }}
            className="w-36 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 shrink-0 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {patterns.length === 0 && !loading && !error && (
            <EmptyState
              icon={<BookOpen className="h-7 w-7" />}
              title="Ingen patterns fundet"
              description="Prøv en anden søgning, eller reset filtre for at se alle 2.800+ patterns."
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {patterns.map((p) => (
              <PatternCard
                key={p.id}
                pattern={p}
                active={selected?.id === p.id}
                onClick={() => setSelected((prev) => (prev?.id === p.id ? null : p))}
              />
            ))}
          </div>

          {/* Load more */}
          {hasMore && !loading && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => void fetchPatterns(q, domain, skip, false)}
                className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent"
              >
                Indlæs flere
              </button>
            </div>
          )}
          {loading && (
            <div className="mt-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Right panel: detail */}
      {selected && (
        <div className="flex w-1/2 flex-col overflow-hidden border-l border-border bg-card">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <h2 className="truncate text-base font-semibold">{selected.name}</h2>
            <div className="ml-2 flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  const threadId = `thread-${Date.now()}`;
                  void navigate({
                    to: "/c/$threadId",
                    params: { threadId },
                    search: { prompt: `Brug pattern: ${selected.name}` },
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
                title="Pre-udfyld chat med dette pattern"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Brug i chat
              </button>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                aria-label="Luk"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* Meta pills */}
            <div className="flex flex-wrap gap-2">
              {selected.domain && (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                  {selected.domain}
                </span>
              )}
              {selected.canonical_ref && (
                <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
                  {selected.canonical_ref}
                </span>
              )}
              <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <Code2 className="h-3 w-3" />
                {selected.resonates_count} kode-impl.
              </span>
            </div>

            {/* Description */}
            {selected.description ? (
              <div>
                <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Beskrivelse
                </h3>
                <p className="text-sm leading-relaxed text-foreground">{selected.description}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Ingen beskrivelse tilgængelig.</p>
            )}

            {/* RESONATES_WITH explanation */}
            {selected.resonates_count > 0 && (
              <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm">
                <p className="font-medium">Kode-resonans</p>
                <p className="mt-1 text-muted-foreground">
                  Dette pattern resonerer semantisk med <strong>{selected.resonates_count}</strong>{" "}
                  kode-implementeringer i graph'en (via{" "}
                  <span className="font-mono text-xs">RESONATES_WITH</span>-kanten).
                </p>
              </div>
            )}

            {!selected.canonical_ref && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
                GAP-1: Ingen <span className="font-mono">canonical_ref</span> — backfill planlagt
                post-EP-2 drain.
              </div>
            )}

            <LinkToEngagement pattern={selected} />
          </div>
        </div>
      )}
    </div>
  );
}

function LinkToEngagement({ pattern }: { pattern: PatternRow }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<EngagementHit[]>([]);
  const [linkState, setLinkState] = useState<LinkState>("idle");
  const [linkedName, setLinkedName] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setHits([]);
      setLinkState("idle");
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLinkState("searching");
      try {
        const res = await fetch(`/api/engagements?q=${encodeURIComponent(value)}&limit=8`);
        const data = (await res.json()) as { engagements?: EngagementHit[]; error?: string };
        setHits(Array.isArray(data.engagements) ? data.engagements : []);
        setLinkState("idle");
      } catch {
        setHits([]);
        setLinkState("idle");
      }
    }, 280);
  }, []);

  const link = async (eng: EngagementHit) => {
    setLinkState("linking");
    setHits([]);
    setQ("");
    try {
      const res = await fetch(`/api/engagements/${encodeURIComponent(eng.id)}/patterns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pattern_id: pattern.id }),
      });
      if (res.ok) {
        setLinkedName(eng.name);
        setLinkState("success");
        setTimeout(() => {
          setLinkState("idle");
          setLinkedName(null);
        }, 3500);
      } else {
        setLinkState("error");
        setTimeout(() => setLinkState("idle"), 2500);
      }
    } catch {
      setLinkState("error");
      setTimeout(() => setLinkState("idle"), 2500);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary flex-none" />
        <span className="text-sm font-medium">Link til engagement</span>
      </div>

      {linkState === "success" && linkedName && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 flex-none" />
          <span>
            Koblet til <strong>{linkedName}</strong>
          </span>
        </div>
      )}

      {linkState === "error" && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          Koblingshandling fejlede — prøv igen.
        </div>
      )}

      {linkState !== "success" && (
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                search(e.target.value);
              }}
              placeholder="Søg engagement…"
              disabled={linkState === "linking"}
              className="w-full rounded-lg border border-input bg-card py-2 pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            {linkState === "searching" && (
              <Loader2 className="absolute right-2.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            {q && linkState !== "searching" && linkState !== "linking" && (
              <button
                onClick={() => {
                  setQ("");
                  setHits([]);
                }}
                className="absolute right-2.5 text-muted-foreground hover:text-foreground transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {linkState === "linking" && (
              <Loader2 className="absolute right-2.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>

          {hits.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              {hits.map((eng) => (
                <li key={eng.id}>
                  <button
                    onClick={() => void link(eng)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-accent"
                  >
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-primary/10">
                      <Link2 className="h-3 w-3 text-primary" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{eng.name}</div>
                      {eng.client && (
                        <div className="truncate text-[11px] text-muted-foreground">
                          {eng.client}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function PatternCard({
  pattern,
  active,
  onClick,
}: {
  pattern: PatternRow;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex flex-col gap-2 rounded-2xl border p-4 text-left transition hover:border-primary/40 hover:bg-accent/40",
        active ? "border-primary bg-accent/60 ring-1 ring-primary/20" : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {pattern.name || "Unavngivet pattern"}
        </span>
        {pattern.resonates_count > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <Code2 className="h-2.5 w-2.5" />
            {pattern.resonates_count}
          </span>
        )}
      </div>

      {pattern.domain && (
        <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {pattern.domain}
        </span>
      )}

      {pattern.description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {pattern.description}
        </p>
      )}

      {!pattern.canonical_ref && (
        <span className="mt-auto text-[10px] text-amber-600 dark:text-amber-400">
          canonical_ref mangler
        </span>
      )}
    </button>
  );
}
