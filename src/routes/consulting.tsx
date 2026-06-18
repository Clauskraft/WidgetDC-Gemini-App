import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Boxes, Search, RefreshCw, Loader2, ChevronRight, X, Sparkles, Copy, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssemblyBlockRow, AssembleResponse, CpListResponse } from "./api/consulting.assemble";

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
        if (body.bom.length === 0) {
          setError("Ingen AssemblyBlocks fundet for denne ConsultingProcess. G5-gap kan stadig være aktiv — CP→AB REQUIRES edges ikke seeded endnu.");
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
      <div className={cn("flex w-72 shrink-0 flex-col overflow-hidden border-r border-border transition-all", bom ? "w-64" : "w-72")}>
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

      {/* Right panel: brief + BOM */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {selectedCp ?? "Consulting Assembly"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {selectedCp
                ? "Beskriv opgaven — assemblér relevante byggeklodser"
                : "Vælg en ConsultingProcess til venstre"}
            </p>
          </div>
          {bom && (
            <span className="ml-auto rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
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
                  {[5, 10, 15, 20].map((n) => (
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

        {/* BOM results */}
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
            <div className="flex flex-col gap-3">
              {bom.map((block, idx) => (
                <div
                  key={block.id}
                  className="group relative rounded-xl border border-border bg-card p-4 transition hover:border-border/80 hover:shadow-sm"
                >
                  <div className="mb-2 flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      {block.title ? (
                        <p className="text-sm font-medium text-foreground leading-snug">{block.title}</p>
                      ) : (
                        <p className="text-xs font-mono text-muted-foreground/60 truncate">{block.id}</p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        {block.domain && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {block.domain}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          quality {(block.quality_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => copyContent(block.id, block.content)}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-accent group-hover:opacity-100"
                      title="Kopiér indhold"
                    >
                      {copiedId === block.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="pl-8 text-xs leading-relaxed text-muted-foreground line-clamp-4">
                    {block.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
