import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Boxes,
  Search,
  RefreshCw,
  Loader2,
  ChevronRight,
  X,
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssemblyBlockRow, AssembleResponse, CpListResponse, FallbackMode } from "./api/consulting.assemble";

export const Route = createFileRoute("/consulting")({
  head: () => ({
    meta: [
      { title: "Consulting Assembly — WidgeTDC Aurora" },
      {
        name: "description",
        content: "Assemblér en BOM af AssemblyBlocks for en ConsultingProcess fra WidgeTDC knowledge graph.",
      },
    ],
  }),
  component: ConsultingRoute,
});

function qualityBadge(score: number): { label: string; className: string } {
  if (score >= 0.7) return { label: `${(score * 100).toFixed(0)}%`, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30" };
  if (score >= 0.4) return { label: `${(score * 100).toFixed(0)}%`, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30" };
  return { label: `${(score * 100).toFixed(0)}%`, className: "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30" };
}

interface PreviewDrawerProps {
  block: AssemblyBlockRow;
  onClose: () => void;
  onCopy: (id: string, content: string) => void;
  copiedId: string | null;
}

function PreviewDrawer({ block, onClose, onCopy, copiedId }: PreviewDrawerProps) {
  const badge = qualityBadge(block.quality_score);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative flex h-full w-[420px] flex-col bg-card shadow-2xl border-l border-border overflow-hidden animate-in slide-in-from-right-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">
              {block.title ?? block.id}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {block.domain && (
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/30">
                  {block.domain}
                </span>
              )}
              <span
                className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", badge.className)}
                title={`Quality score ${block.quality_score} — ≥70% = velbelagt, 40-70% = indikativt, <40% = eksplorativt`}
              >
                Quality {badge.label}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 mt-0.5">
            <button
              onClick={() => onCopy(block.id, block.content)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
              title="Kopiér indhold"
            >
              {copiedId === block.id ? (
                <><Check className="h-3.5 w-3.5 text-emerald-500" />Kopieret</>
              ) : (
                <><Copy className="h-3.5 w-3.5" />Kopiér</>
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent"
              title="Luk"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Metadata strip */}
        <div className="shrink-0 flex items-center gap-4 border-b border-border px-5 py-2 text-[11px] text-muted-foreground">
          <span className="truncate font-mono opacity-60">{block.id.slice(0, 20)}…</span>
        </div>

        {/* Full content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
            {block.content}
          </p>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-3 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/60">
            BOM-item · AssemblyBlock · Knowledge Graph
          </p>
          {block.content_truncated && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              Indhold afkortet (vises 800 tegn)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BomCard({
  block,
  index,
  onPreview,
  onCopy,
  copiedId,
}: {
  block: AssemblyBlockRow;
  index: number;
  onPreview: (block: AssemblyBlockRow) => void;
  onCopy: (id: string, content: string) => void;
  copiedId: string | null;
}) {
  const badge = qualityBadge(block.quality_score);

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card transition hover:border-border/60 hover:shadow-md hover:shadow-black/10">
      {/* Card header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          {block.title ? (
            <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
              {block.title}
            </p>
          ) : (
            <p className="text-xs font-mono text-muted-foreground/60 truncate">{block.id}</p>
          )}

          {/* Tags row */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {block.domain && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/25">
                {block.domain}
              </span>
            )}
            <span
              className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", badge.className)}
              title={`Quality score: ${block.quality_score} — baseret på indholdsrigdom, strukturering og relevans i WidgeTDC knowledge graph`}
            >
              {badge.label}
            </span>
          </div>
        </div>

        {/* Actions — visible on hover */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onCopy(block.id, block.content)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition"
            title="Kopiér indhold"
          >
            {copiedId === block.id ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => onPreview(block)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition"
            title="Forhåndsvisning"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content preview */}
      <div
        className="cursor-pointer px-4 pb-4 pl-12"
        onClick={() => onPreview(block)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onPreview(block)}
        aria-label="Åbn forhåndsvisning"
      >
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
          {block.content}
        </p>
      </div>
    </div>
  );
}

function ConsultingRoute() {
  const [cps, setCps] = useState<{ name: string; domain: string | null }[]>([]);
  const [cpFilter, setCpFilter] = useState("");
  const [selectedCp, setSelectedCp] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [maxBlocks, setMaxBlocks] = useState(10);
  const [bom, setBom] = useState<AssemblyBlockRow[] | null>(null);
  const [loadingCps, setLoadingCps] = useState(false);
  const [loadingBom, setLoadingBom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cpError, setCpError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewBlock, setPreviewBlock] = useState<AssemblyBlockRow | null>(null);
  const [fallbackMode, setFallbackMode] = useState<FallbackMode | null>(null);
  const briefRef = useRef<HTMLTextAreaElement>(null);

  const fetchCps = useCallback(async () => {
    setLoadingCps(true);
    setCpError(null);
    try {
      const res = await fetch("/api/consulting/assemble");
      const body = (await res.json()) as CpListResponse;
      if (!res.ok || body.error) {
        setCpError(body.error ?? `Fejl (${res.status})`);
      } else {
        setCps(body.cps);
      }
    } catch (e) {
      setCpError(e instanceof Error ? e.message : "Netværksfejl");
    } finally {
      setLoadingCps(false);
    }
  }, []);

  useEffect(() => {
    void fetchCps();
  }, [fetchCps]);

  const filteredCps = cpFilter
    ? cps.filter((cp) => cp.name.toLowerCase().includes(cpFilter.toLowerCase()))
    : cps;

  const handleAssemble = useCallback(async () => {
    if (!selectedCp || !brief.trim()) return;
    setLoadingBom(true);
    setError(null);
    setBom(null);
    setPreviewBlock(null);
    setFallbackMode(null);
    try {
      const res = await fetch("/api/consulting/assemble", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cp_name: selectedCp,
          brief: brief.trim(),
          max_blocks: maxBlocks,
          domain_filter: domainFilter.trim() || undefined,
        }),
      });
      const body = (await res.json()) as AssembleResponse;
      if (!res.ok || body.error) {
        setError(body.error ?? `Fejl (${res.status})`);
      } else {
        setBom(body.bom);
        setFallbackMode(body.fallback_mode ?? null);
        if (body.bom.length === 0) {
          setError(
            "Ingen relevante blocks fundet for denne proces og opgave — prøv et bredere brief eller et andet domain filter."
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netværksfejl");
    } finally {
      setLoadingBom(false);
    }
  }, [selectedCp, brief, maxBlocks, domainFilter]);

  const copyContent = useCallback((id: string, content: string) => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel: CP picker */}
      <div className={cn("flex shrink-0 flex-col overflow-hidden border-r border-border transition-all duration-200", bom ? "w-60" : "w-72")}>
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-aurora shadow-glow">
            <Boxes className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold tracking-tight truncate">Consulting Processes</h2>
            <p className="text-xs text-muted-foreground">{cps.length > 0 ? `${cps.length} tilgængelige` : "Henter…"}</p>
          </div>
          <button
            onClick={() => void fetchCps()}
            disabled={loadingCps}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-50 transition"
            title="Opdatér liste"
          >
            {loadingCps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="shrink-0 px-3 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filtrer…"
              value={cpFilter}
              onChange={(e) => setCpFilter(e.target.value)}
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {cpError && (
          <div className="mx-3 mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mb-0.5 mr-1 inline h-3 w-3" />
            {cpError}
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-1">
          {filteredCps.length === 0 && !loadingCps && !cpError && (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">Ingen ConsultingProcess nodes fundet.</p>
          )}
          {filteredCps.map((cp) => (
            <button
              key={cp.name}
              onClick={() => {
                setSelectedCp(cp.name);
                setBom(null);
                setError(null);
                setPreviewBlock(null);
                setTimeout(() => briefRef.current?.focus(), 80);
              }}
              className={cn(
                "w-full px-4 py-2.5 text-left transition hover:bg-accent",
                selectedCp === cp.name && "bg-accent/80",
              )}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{cp.name}</p>
                  {cp.domain && (
                    <p className="truncate text-[10px] text-muted-foreground">{cp.domain}</p>
                  )}
                </div>
                {selectedCp === cp.name && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel: brief + BOM grid */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {selectedCp ?? "Consulting Assembly"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {selectedCp
                ? "Beskriv opgaven — assemblér relevante byggeklodser fra knowledge graph"
                : "Vælg en ConsultingProcess til venstre"}
            </p>
          </div>
          {bom && bom.length > 0 && (
            <span className="ml-auto rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20">
              {bom.length} blokke
            </span>
          )}
        </div>

        {/* Brief form */}
        <div className="shrink-0 border-b border-border px-6 py-4">
          <div className="flex flex-col gap-3">
            <textarea
              ref={briefRef}
              rows={3}
              placeholder={
                selectedCp
                  ? `Beskriv kundeudfordringen eller opgaven for "${selectedCp}"…`
                  : "Vælg en ConsultingProcess og beskriv opgaven her…"
              }
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              disabled={!selectedCp}
              className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Domain filter (valgfrit)…"
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="w-44 rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Maks blokke:</label>
                <select
                  value={maxBlocks}
                  onChange={(e) => setMaxBlocks(Number(e.target.value))}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {[5, 10, 15, 20, 50].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => void handleAssemble()}
                disabled={!selectedCp || !brief.trim() || loadingBom}
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-aurora px-5 py-2 text-sm font-medium text-white shadow-glow transition hover:opacity-90 disabled:opacity-40 disabled:shadow-none"
              >
                {loadingBom ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Assemblerer…</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Assemblér BOM</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mb-0.5 mr-1.5 inline h-4 w-4" />
            {error}
          </div>
        )}

        {/* Fallback mode banner */}
        {fallbackMode && fallbackMode !== "requires" && bom && bom.length > 0 && (
          <div className="mx-6 mt-3 shrink-0 rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {fallbackMode === "domain_match"
              ? "Viser blocks baseret på domain-match — REQUIRES-edges ikke tilgængelige for denne CP."
              : "Viser bredt udvalg fra knowledge graph — ingen specifik CP valgt."}
          </div>
        )}

        {/* BOM card grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!bom && !loadingBom && !error && selectedCp && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Boxes className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Beskriv opgaven ovenfor og klik <strong>Assemblér BOM</strong>
              </p>
              <p className="text-xs text-muted-foreground/60">
                Henter AssemblyBlocks relateret til <em>{selectedCp}</em> fra knowledge graph
              </p>
            </div>
          )}
          {!bom && !loadingBom && !error && !selectedCp && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Boxes className="h-12 w-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Vælg en ConsultingProcess for at starte</p>
            </div>
          )}
          {bom && bom.length > 0 && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {bom.map((block, idx) => (
                <BomCard
                  key={block.id}
                  block={block}
                  index={idx}
                  onPreview={setPreviewBlock}
                  onCopy={copyContent}
                  copiedId={copiedId}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview drawer */}
      {previewBlock && (
        <PreviewDrawer
          block={previewBlock}
          onClose={() => setPreviewBlock(null)}
          onCopy={copyContent}
          copiedId={copiedId}
        />
      )}
    </div>
  );
}
