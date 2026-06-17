import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageContent } from "@/components/MessageContent";
import type { EngagementRow, EngagementsResponse, CreateEngagementBody } from "./api/engagements";
import type { PatternRef, EngagementPatternsResponse } from "./api/engagements.$id.patterns";
import type {
  DeliverableKind,
  WorkArtifactRow,
  EngagementDeliverablesResponse,
  GenerateDeliverableBody,
  GenerateDeliverableResponse,
} from "./api/engagements.$id.deliverable";

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
      prev.map((e) =>
        e.id === engId ? { ...e, pattern_count: e.pattern_count + 1 } : e,
      ),
    );
    setSelected((prev) =>
      prev?.id === engId ? { ...prev, pattern_count: prev.pattern_count + 1 } : prev,
    );
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel */}
      <div className={cn("flex flex-col overflow-hidden transition-all", selected || showCreate ? "w-1/2" : "flex-1")}>
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-aurora shadow-glow">
            <Briefcase className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">Engagements</h1>
            <p className="text-xs text-muted-foreground">
              {engagements.length > 0
                ? `${engagements.length}${hasMore ? "+" : ""} engagements`
                : "WidgeTDC knowledge graph"}
            </p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setSelected(null); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Nyt engagement
          </button>
          <button
            onClick={() => void fetchEngagements(q, domain, 0, true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Opdatér
          </button>
        </div>

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
            <p className="py-12 text-center text-sm text-muted-foreground">Ingen engagements fundet.</p>
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
                <span className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  selected.status === "active"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}>
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
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
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

  useEffect(() => { void loadArtifacts(); }, [loadArtifacts]);

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
          {loadingList ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Existing artifacts */}
      {artifacts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Produceret ({artifacts.length})</p>
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
          <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
            {preview.citations} citationer · {preview.id} · {preview.signed_status ?? "GAP-3: unsigned"}
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

function EngagementCard({
  engagement,
  active,
  onClick,
}: {
  engagement: EngagementRow;
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
          {engagement.name || "Unavngivet engagement"}
        </span>
        {engagement.pattern_count > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <BookOpen className="h-2.5 w-2.5" />
            {engagement.pattern_count}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {engagement.domain && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {engagement.domain}
          </span>
        )}
        {engagement.status && (
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            engagement.status === "active"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground",
          )}>
            {engagement.status}
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
    </button>
  );
}

function CreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
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

  const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

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
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={field}
        >
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
