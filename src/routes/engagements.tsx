import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Briefcase,
  Search,
  RefreshCw,
  Loader2,
  Plus,
  ChevronRight,
  BookOpen,
  X,
  Link2,
  Check,
  FileText,
  Sparkles,
  Info,
  Pin,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { MessageContent } from "@/components/MessageContent";
import type { EngagementRow, EngagementsResponse, CreateEngagementBody } from "./api/engagements";
import { useActiveEngagement } from "@/lib/engagement-context";
import type { PatternRef, EngagementPatternsResponse } from "./api/engagements.$id.patterns";
import type {
  PinnedSource,
  EngagementSourcesResponse,
  PinSourceBody,
  PinSourceResponse,
} from "./api/engagements.$id.sources";
import type {
  DeliverableKind,
  WorkArtifactRow,
  EngagementDeliverablesResponse,
  GenerateDeliverableBody,
  GenerateDeliverableResponse,
} from "./api/engagements.$id.deliverable";

// ─── Confidence-dots system (workshop beslutning 16d) ─────────────────────────
// 3 niveauer: Velbelagt (score ≥ 0.8) / Indikativt (≥ 0.6) / Eksplorativt (<0.6)
// Vis ●●● / ●●○ / ●○○ med forklaring via tooltip

type ConfidenceLevel = "velbelagt" | "indikativt" | "eksplorativt";

function scoreToLevel(score: number): ConfidenceLevel {
  if (score >= 0.8) return "velbelagt";
  if (score >= 0.6) return "indikativt";
  return "eksplorativt";
}

const CONFIDENCE_META: Record<
  ConfidenceLevel,
  { dots: string; label: string; color: string; tooltip: string }
> = {
  velbelagt: {
    dots: "●●●",
    label: "Velbelagt",
    color: "text-emerald-600 dark:text-emerald-400",
    tooltip: "Høj evidenstæthed — konklusioner understøttet af multiple datakilder og patterns.",
  },
  indikativt: {
    dots: "●●○",
    label: "Indikativt",
    color: "text-amber-600 dark:text-amber-400",
    tooltip: "Moderat evidens — retning er klar, men supplerende dataindsamling anbefales.",
  },
  eksplorativt: {
    dots: "●○○",
    label: "Eksplorativt",
    color: "text-rose-600 dark:text-rose-400",
    tooltip:
      "Hypotese-niveau — brug som udgangspunkt for videre analyse, ikke som endegyldigt grundlag.",
  },
};

function ConfidenceDots({ score, className }: { score: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const level = scoreToLevel(score);
  const meta = CONFIDENCE_META[level];

  return (
    <span className={cn("relative inline-flex items-center gap-1", className)}>
      <span
        className={cn("font-mono text-[11px] tracking-widest select-none", meta.color)}
        title={meta.tooltip}
      >
        {meta.dots}
      </span>
      <span className={cn("text-[10px] font-medium", meta.color)}>{meta.label}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-accent"
        aria-label="Forklaring af evidensniveau"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg"
          onClick={() => setOpen(false)}
        >
          <p className="mb-2 font-semibold">Evidensniveauer (16d)</p>
          {(["velbelagt", "indikativt", "eksplorativt"] as ConfidenceLevel[]).map((lvl) => {
            const m = CONFIDENCE_META[lvl];
            return (
              <div key={lvl} className={cn("mb-1.5 flex gap-2", lvl === level && "font-medium")}>
                <span className={cn("shrink-0 font-mono tracking-widest", m.color)}>{m.dots}</span>
                <span>
                  <span className={m.color}>{m.label}</span>
                  {lvl === level && " ←"}
                  <span className="block text-muted-foreground">{m.tooltip}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/engagements")({
  head: () => ({
    meta: [
      { title: "Engagements — WidgeTDC Aurora" },
      {
        name: "description",
        content: "Browse og opret konsulent-engagements i WidgeTDC knowledge graph.",
      },
    ],
  }),
  component: EngagementsRoute,
});

const LIMIT = 24;

function EngagementsRoute() {
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState("");
  const [selected, setSelected] = useState<EngagementRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchEngagements = useCallback(
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
        const res = await fetch(`/api/engagements?${params}`);
        const body = (await res.json()) as EngagementsResponse;
        if (!res.ok) {
          setError(body.error ?? `Fejl (${res.status})`);
        } else {
          setEngagements((prev) => (replace ? body.engagements : [...prev, ...body.engagements]));
          setHasMore(body.hasMore);
          setSkip(offset + body.engagements.length);
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
    void fetchEngagements("", "", 0, true);
  }, [fetchEngagements]);

  const triggerSearch = useCallback(
    (search: string, domainFilter: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSkip(0);
        setEngagements([]);
        setSelected(null);
        void fetchEngagements(search, domainFilter, 0, true);
      }, 320);
    },
    [fetchEngagements],
  );

  const onCreated = useCallback(() => {
    setShowCreate(false);
    setSkip(0);
    setEngagements([]);
    setSelected(null);
    void fetchEngagements(q, domain, 0, true);
  }, [fetchEngagements, q, domain]);

  const onPatternLinked = useCallback((engId: string) => {
    setEngagements((prev) =>
      prev.map((e) => (e.id === engId ? { ...e, pattern_count: e.pattern_count + 1 } : e)),
    );
    setSelected((prev) =>
      prev?.id === engId ? { ...prev, pattern_count: prev.pattern_count + 1 } : prev,
    );
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel */}
      <div
        className={cn(
          "flex flex-col overflow-hidden transition-all",
          selected || showCreate ? "w-1/2" : "flex-1",
        )}
      >
        {/* Header */}
        <PageHeader
          icon={<Briefcase className="h-4 w-4 text-white" />}
          title="Engagements"
          subtitle={engagements.length > 0 ? "engagements" : "WidgeTDC knowledge graph"}
          count={engagements.length > 0 ? `${engagements.length}${hasMore ? "+" : ""}` : undefined}
          onRefresh={() => void fetchEngagements(q, domain, 0, true)}
          refreshing={loading}
          action={
            <button
              onClick={() => {
                setShowCreate(true);
                setSelected(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Nyt engagement
            </button>
          }
        />

        {/* Search bar */}
        <div className="flex shrink-0 gap-2 border-b border-border px-4 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Søg engagements…"
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
          {engagements.length === 0 && !loading && !error && (
            <EmptyState
              icon={<Briefcase className="h-7 w-7" />}
              title="Ingen engagements fundet"
              description="Opret dit første engagement for at komme i gang med pattern-kobling og deliverable-generering."
              action={
                <button
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nyt engagement
                </button>
              }
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {engagements.map((eng) => (
              <EngagementCard
                key={eng.id}
                engagement={eng}
                active={selected?.id === eng.id}
                onClick={() => {
                  setShowCreate(false);
                  setSelected((prev) => (prev?.id === eng.id ? null : eng));
                }}
              />
            ))}
          </div>

          {hasMore && !loading && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => void fetchEngagements(q, domain, skip, false)}
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
      {selected && !showCreate && (
        <div className="flex w-1/2 flex-col overflow-hidden border-l border-border bg-card">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <h2 className="truncate text-base font-semibold">{selected.name}</h2>
            <button
              onClick={() => setSelected(null)}
              className="ml-2 rounded-md p-1 text-muted-foreground hover:bg-accent"
              aria-label="Luk"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* Meta pills */}
            <div className="flex flex-wrap gap-2">
              {selected.domain && (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                  {selected.domain}
                </span>
              )}
              {selected.status && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    selected.status === "active"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {selected.status}
                </span>
              )}
              {selected.client && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {selected.client}
                </span>
              )}
              <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <BookOpen className="h-3 w-3" />
                {selected.pattern_count} patterns
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

            {/* Created */}
            {selected.created_at && (
              <p className="text-xs text-muted-foreground">
                Oprettet: {new Date(selected.created_at).toLocaleDateString("da-DK")}
              </p>
            )}

            {/* Engagement confidence indicator */}
            <EngagementConfidence engagement={selected} />

            {/* Pattern kobling section */}
            <PatternLinkPanel
              engagementId={selected.id}
              onLinked={() => onPatternLinked(selected.id)}
            />

            {/* Deliverable draft + WorkArtifact provenance */}
            <DeliverablePanel engagementId={selected.id} />
          </div>
        </div>
      )}

      {/* Right panel: create form */}
      {showCreate && (
        <div className="flex w-1/2 flex-col overflow-hidden border-l border-border bg-card">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Nyt engagement</h2>
            <button
              onClick={() => setShowCreate(false)}
              className="ml-2 rounded-md p-1 text-muted-foreground hover:bg-accent"
              aria-label="Luk"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <CreateForm onCreated={onCreated} onCancel={() => setShowCreate(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function PatternLinkPanel({
  engagementId,
  onLinked,
}: {
  engagementId: string;
  onLinked: () => void;
}) {
  const [linked, setLinked] = useState<PatternRef[]>([]);
  const [suggestions, setSuggestions] = useState<PatternRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [justLinked, setJustLinked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/patterns`);
      const body = (await res.json()) as EngagementPatternsResponse;
      if (!res.ok) {
        setError(body.error ?? `Fejl (${res.status})`);
      } else {
        setLinked(body.linked);
        setSuggestions(body.suggestions);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netværksfejl");
    } finally {
      setLoading(false);
    }
  }, [engagementId]);

  useEffect(() => {
    void load();
  }, [load]);

  const linkPattern = useCallback(
    async (patternId: string) => {
      setLinking(patternId);
      try {
        const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/patterns`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pattern_id: patternId }),
        });
        if (res.ok) {
          setJustLinked((prev) => new Set([...prev, patternId]));
          const pat = suggestions.find((s) => s.id === patternId);
          if (pat) {
            setLinked((prev) => [pat, ...prev]);
            setSuggestions((prev) => prev.filter((s) => s.id !== patternId));
          }
          onLinked();
        }
      } finally {
        setLinking(null);
      }
    },
    [engagementId, suggestions, onLinked],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Pattern-kobling (UTILIZED_PATTERN)
        </h3>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Linked patterns */}
      {linked.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Koblet ({linked.length})</p>
          <div className="space-y-1">
            {linked.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
              >
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span className="flex-1 truncate text-xs text-foreground">{p.name}</span>
                {p.domain && (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {p.domain}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Foreslåede patterns (top resonans)
          </p>
          <div className="space-y-1">
            {suggestions.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-xs text-foreground">{p.name}</span>
                {p.domain && (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {p.domain}
                  </span>
                )}
                <button
                  onClick={() => void linkPattern(p.id)}
                  disabled={linking === p.id || justLinked.has(p.id)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary transition hover:bg-primary/20 disabled:opacity-50"
                >
                  {linking === p.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : justLinked.has(p.id) ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Link2 className="h-3 w-3" />
                  )}
                  Kobl
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && linked.length === 0 && suggestions.length === 0 && !error && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
          GAP-4: Ingen UTILIZED_PATTERN-kanter — koblingsflywheel ikke aktiv for dette engagement.
        </p>
      )}

      {loading && linked.length === 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function EngagementConfidence({ engagement }: { engagement: EngagementRow }) {
  // Beregn evidensscore baseret på tilgængelige metadata:
  // - pattern_count ≥ 3  → 0.35 point
  // - client udfyldt     → 0.20 point
  // - domain udfyldt     → 0.20 point
  // - description ≥ 50t  → 0.25 point
  let score = 0;
  if (engagement.pattern_count >= 3) score += 0.35;
  else if (engagement.pattern_count >= 1) score += 0.15;
  if (engagement.client) score += 0.2;
  if (engagement.domain) score += 0.2;
  if ((engagement.description?.length ?? 0) >= 50) score += 0.25;
  else if ((engagement.description?.length ?? 0) >= 10) score += 0.1;

  const level = scoreToLevel(score);

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
      <div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          AI-analyse evidens
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {level === "velbelagt"
            ? "Engagementet har tilstrækkelig kontekst til at generere velbegrundede analyser."
            : level === "indikativt"
              ? "Tilføj patterns, klient eller beskrivelse for at øge evidensstyrken."
              : "Mangler kontekst — tilføj domain, klient og minimum 1 pattern."}
        </p>
      </div>
      <ConfidenceDots score={score} className="ml-4 shrink-0" />
    </div>
  );
}

// ─── CitationsPanel BOM-item ────────────────────────────────────────────────
// Reusable atom: viser engagement's linked patterns som citations (belæg-links).
// Hentes lazy når brugeren åbner preview-footer. Kan genbruges i Monday Review,
// chat-window og enhver kontekst med engagement_id + citations_count.

function CitationsPanel({ engagementId, count }: { engagementId: string; count: number }) {
  const [expanded, setExpanded] = useState(false);
  const [patterns, setPatterns] = useState<PatternRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const load = useCallback(async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/patterns`);
      const body = (await res.json()) as EngagementPatternsResponse;
      if (res.ok) setPatterns(body.linked.slice(0, 12));
      setFetched(true);
    } finally {
      setLoading(false);
    }
  }, [engagementId, fetched]);

  const toggle = () => {
    if (!expanded && !fetched) void load();
    setExpanded((v) => !v);
  };

  return (
    <div>
      <button
        onClick={toggle}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition"
      >
        <BookOpen className="h-3 w-3" />
        <span>
          {count} {count === 1 ? "citation" : "citationer"}
        </span>
        <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
      </button>

      {expanded && (
        <div className="mt-1.5 space-y-1">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {!loading && patterns.length === 0 && fetched && (
            <p className="text-[10px] text-muted-foreground">Ingen linkede patterns endnu</p>
          )}
          {patterns.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1">
              <span className="text-[10px] font-medium text-foreground truncate flex-1">
                {p.name}
              </span>
              {p.domain && (
                <span className="shrink-0 text-[9px] text-muted-foreground bg-muted rounded px-1">
                  {p.domain}
                </span>
              )}
              {p.canonical_ref && (
                <span
                  className="shrink-0 text-[9px] text-primary font-mono truncate max-w-[80px]"
                  title={p.canonical_ref}
                >
                  {p.canonical_ref.split("/").pop()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SourcesPanel BOM-item ───────────────────────────────────────────────────
// Reusable atom: viser + lader brugeren pinne AssemblyBlock-sources (HAS_SOURCE).
// Komplement til CitationsPanel (som viser HAS_PATTERN). Samme lazy-load mønster.
// BOM-spine: GROUNDED_BY edge — engagement er grounded_by disse kildeblokke.

function SourcesPanel({ engagementId }: { engagementId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [sources, setSources] = useState<PinnedSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [pinText, setPinText] = useState("");
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/sources`);
      const body = (await res.json()) as EngagementSourcesResponse;
      if (res.ok) setSources(body.sources.slice(0, 12));
      setFetched(true);
    } finally {
      setLoading(false);
    }
  }, [engagementId, fetched]);

  const toggle = () => {
    if (!expanded && !fetched) void load();
    setExpanded((v) => !v);
  };

  const pinSource = async () => {
    if (!pinText.trim()) return;
    setPinning(true);
    setPinError(null);
    try {
      const body: PinSourceBody = { text: pinText.trim() };
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/sources`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as PinSourceResponse;
      if (!res.ok || !data.pinned) {
        setPinError(data.error ?? `Fejl (${res.status})`);
      } else {
        const newSource: PinnedSource = {
          id: data.block_id,
          title: pinText.slice(0, 80),
          content_preview: pinText.slice(0, 200),
          domain: null,
          quality_score: 0.7,
          pinned_at: new Date().toISOString(),
        };
        setSources((prev) => [newSource, ...prev]);
        setPinText("");
      }
    } finally {
      setPinning(false);
    }
  };

  const sourceCount = fetched ? sources.length : null;

  return (
    <div>
      <button
        onClick={toggle}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition"
      >
        <Pin className="h-3 w-3" />
        <span>
          {sourceCount !== null ? `${sourceCount} kilde${sourceCount === 1 ? "" : "r"}` : "kilder"}
        </span>
        <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}

          {!loading && fetched && sources.length === 0 && (
            <p className="text-[10px] text-muted-foreground">Ingen pinnede kilder endnu</p>
          )}

          {sources.map((s) => (
            <div
              key={s.id}
              className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 space-y-0.5"
            >
              {s.title && (
                <p className="text-[11px] font-medium text-foreground truncate">{s.title}</p>
              )}
              <p className="text-[10px] text-muted-foreground line-clamp-2">{s.content_preview}</p>
              <div className="flex items-center gap-2">
                {s.domain && (
                  <span className="text-[9px] bg-muted rounded px-1 text-muted-foreground">
                    {s.domain}
                  </span>
                )}
                <span className="text-[9px] text-muted-foreground">
                  score {s.quality_score.toFixed(2)}
                </span>
              </div>
            </div>
          ))}

          {/* Pin ny kilde */}
          <div className="space-y-1.5 pt-1 border-t border-border">
            <p className="text-[10px] text-muted-foreground font-medium">Pin ny kilde</p>
            <textarea
              value={pinText}
              onChange={(e) => setPinText(e.target.value)}
              placeholder="Indsæt kildetekst, citat eller observation…"
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            {pinError && <p className="text-[10px] text-destructive">{pinError}</p>}
            <button
              onClick={() => void pinSource()}
              disabled={pinning || !pinText.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {pinning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pin className="h-3 w-3" />}
              {pinning ? "Pinner…" : "Pin kilde"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const DELIVERABLE_KINDS: { id: DeliverableKind; label: string }[] = [
  { id: "analysis", label: "Analyse" },
  { id: "roadmap", label: "Roadmap" },
  { id: "assessment", label: "Assessment" },
];

function DeliverablePanel({ engagementId }: { engagementId: string }) {
  const [artifacts, setArtifacts] = useState<WorkArtifactRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [kind, setKind] = useState<DeliverableKind>("analysis");
  const [extraCtx, setExtraCtx] = useState("");
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<WorkArtifactRow | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastQuality, setLastQuality] = useState<{ score: number } | null>(null);

  const loadArtifacts = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/deliverable`);
      const body = (await res.json()) as EngagementDeliverablesResponse;
      if (res.ok) setArtifacts(body.artifacts);
    } finally {
      setLoadingList(false);
    }
  }, [engagementId]);

  useEffect(() => {
    void loadArtifacts();
  }, [loadArtifacts]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const body: GenerateDeliverableBody = {
        kind,
        ...(extraCtx.trim() ? { extra_context: extraCtx.trim() } : {}),
      };
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/deliverable`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as GenerateDeliverableResponse;
      if (!res.ok || data.error) {
        setGenError(data.error ?? `Fejl (${res.status})`);
      } else {
        const newArtifact: WorkArtifactRow = {
          id: data.artifact_id,
          title: `${kind.charAt(0).toUpperCase() + kind.slice(1)}: generated`,
          kind: data.kind,
          markdown: data.markdown,
          citations: data.citations,
          signed_status: null,
          created_at: new Date().toISOString(),
        };
        setArtifacts((prev) => [newArtifact, ...prev]);
        setPreview(newArtifact);
        setLastQuality(data.quality ?? null);
      }
    } finally {
      setGenerating(false);
    }
  }, [engagementId, kind, extraCtx]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Deliverables (WorkArtifact)
        </h3>
        <button
          onClick={() => void loadArtifacts()}
          disabled={loadingList}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-50"
        >
          {loadingList ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Existing artifacts */}
      {artifacts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Produceret ({artifacts.length})
          </p>
          <div className="space-y-1">
            {artifacts.map((wa) => (
              <button
                key={wa.id}
                onClick={() => setPreview((prev) => (prev?.id === wa.id ? null : wa))}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition",
                  preview?.id === wa.id
                    ? "border-primary bg-accent/60"
                    : "border-border bg-background hover:bg-accent/40",
                )}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-xs text-foreground">{wa.title}</span>
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {wa.kind}
                </span>
                {wa.signed_status === null && (
                  <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[10px] text-amber-600">
                    usigneret
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expanded preview */}
      {preview && (
        <div className="rounded-xl border border-border bg-background">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-medium">{preview.title}</span>
            <button onClick={() => setPreview(null)} className="rounded p-0.5 hover:bg-accent">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto px-3 py-3">
            <MessageContent text={preview.markdown} />
          </div>
          <div className="border-t border-border px-3 py-2 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-2 min-w-0 flex-1">
              <CitationsPanel engagementId={engagementId} count={preview.citations} />
              <SourcesPanel engagementId={engagementId} />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {preview.signed_status ? (
                <span className="text-[10px] text-muted-foreground">{preview.signed_status}</span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Afventer godkendelse</span>
              )}
              {lastQuality && preview.id === artifacts[0]?.id && (
                <ConfidenceDots score={lastQuality.score} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generate new */}
      <div className="rounded-xl border border-border bg-background p-3 space-y-3">
        <p className="text-[11px] font-medium text-foreground">Generér nyt deliverable</p>
        <div className="flex gap-2">
          {DELIVERABLE_KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-medium transition",
                kind === k.id
                  ? "bg-primary text-primary-foreground"
                  : "border border-input text-muted-foreground hover:bg-accent",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        <textarea
          value={extraCtx}
          onChange={(e) => setExtraCtx(e.target.value)}
          placeholder="Ekstra kontekst (valgfrit)…"
          rows={2}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        {genError && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {genError}
          </p>
        )}
        <button
          onClick={() => void generate()}
          disabled={generating}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {generating ? "Genererer…" : "Generér deliverable"}
        </button>
      </div>
    </div>
  );
}

function engagementHealthScore(e: EngagementRow): number {
  let s = 0;
  if (e.pattern_count >= 3) s += 0.35;
  else if (e.pattern_count >= 1) s += 0.15;
  if (e.client) s += 0.2;
  if (e.domain) s += 0.2;
  if ((e.description?.length ?? 0) >= 50) s += 0.25;
  else if ((e.description?.length ?? 0) >= 10) s += 0.1;
  return s;
}

function EngagementCard({
  engagement,
  active,
  onClick,
}: {
  engagement: EngagementRow;
  active: boolean;
  onClick: () => void;
}) {
  const health = engagementHealthScore(engagement);
  const level = scoreToLevel(health);
  const meta = CONFIDENCE_META[level];
  const navigate = useNavigate();
  const { setActiveEngagement } = useActiveEngagement();

  const handleStoryline = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveEngagement(engagement);
    const briefParts = [engagement.name, engagement.client, engagement.domain].filter(Boolean);
    const params = new URLSearchParams({
      brief: briefParts.join(" – "),
      kind: "analysis",
    });
    void navigate({ to: "/storyline", search: Object.fromEntries(params) });
  };

  return (
    <div
      onClick={() => {
        setActiveEngagement(engagement);
        onClick();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          setActiveEngagement(engagement);
          onClick();
        }
      }}
      className={cn(
        "group flex flex-col gap-2 rounded-2xl border p-4 text-left transition cursor-pointer hover:border-primary/40 hover:bg-accent/40",
        active ? "border-primary bg-accent/60 ring-1 ring-primary/20" : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {engagement.name || "Unavngivet engagement"}
        </span>
        <span
          className={cn("shrink-0 font-mono text-[10px] tracking-widest", meta.color)}
          title={meta.label}
        >
          {meta.dots}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {engagement.domain && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {engagement.domain}
          </span>
        )}
        {engagement.status && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              engagement.status === "active"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {engagement.status}
          </span>
        )}
        {engagement.pattern_count > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <BookOpen className="h-2.5 w-2.5" />
            {engagement.pattern_count}
          </span>
        )}
      </div>

      {engagement.client && (
        <p className="text-[11px] text-muted-foreground">{engagement.client}</p>
      )}

      {engagement.description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {engagement.description}
        </p>
      )}

      {/* Health bar */}
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            level === "velbelagt"
              ? "bg-emerald-500"
              : level === "indikativt"
                ? "bg-amber-500"
                : "bg-rose-500",
          )}
          style={{ width: `${Math.round(health * 100)}%` }}
        />
      </div>

      <button
        onClick={handleStoryline}
        className="mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-gradient-aurora px-3 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 hover:shadow-glow"
      >
        <FileText className="h-3 w-3" />
        Byg storyline →
      </button>
    </div>
  );
}

function CreateForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateEngagementBody = {
        name: name.trim(),
        ...(domain.trim() ? { domain: domain.trim() } : {}),
        ...(client.trim() ? { client: client.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        status,
      };
      const res = await fetch("/api/engagements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Fejl (${res.status})`);
      } else {
        onCreated();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netværksfejl");
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">
          Navn <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Engagement navn…"
          required
          className={field}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">Klient</label>
        <input
          type="text"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          placeholder="Klientnavn…"
          className={field}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">Domain</label>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="F.eks. digital-transformation…"
          className={field}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
          <option value="active">Active</option>
          <option value="planning">Planning</option>
          <option value="on-hold">On hold</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">Beskrivelse</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Engagementets formål og scope…"
          rows={4}
          className={cn(field, "resize-none")}
        />
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Opret engagement
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent"
        >
          Annuller
        </button>
      </div>
    </form>
  );
}
