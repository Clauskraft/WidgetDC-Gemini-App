import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  FileText,
  Download,
  Copy,
  Check,
  Loader2,
  Sparkles,
  ShieldCheck,
  Boxes,
  FileDown,
} from "lucide-react";
import { MessageContent } from "@/components/MessageContent";

export const Route = createFileRoute("/deliverable")({
  head: () => ({
    meta: [
      { title: "Deliverable Studio — WidgeTDC Aurora" },
      {
        name: "description",
        content:
          "Generér citationsbaserede consulting-deliverables (analyse, roadmap, assessment) fra et brief.",
      },
    ],
  }),
  component: DeliverableRoute,
});

type Kind = "analysis" | "roadmap" | "assessment";
type Engine = "rag" | "lego" | "longform";
type DocFormat = "docx" | "pdf";

type DeliverablePayload = {
  markdown: string;
  citations: number;
  kind: Kind;
  engine?: Engine;
  quality?: { score: number; dimensions?: Record<string, number> } | null;
};

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "analysis", label: "Analyse", hint: "Struktureret problemanalyse" },
  { id: "roadmap", label: "Roadmap", hint: "Faset plan med milepæle" },
  { id: "assessment", label: "Assessment", hint: "Vurdering mod kriterier" },
];

const ENGINES: { id: Engine; label: string; hint: string }[] = [
  { id: "rag", label: "RAG draft", hint: "Hurtig, citationsbaseret" },
  { id: "lego", label: "Lego Factory", hint: "Plan→Retrieve→Write→Assemble→Render" },
  { id: "longform", label: "Long-form", hint: "Iterativ RLM + folding (meget langt)" },
];

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DeliverableRoute() {
  const [brief, setBrief] = useState("");
  const [kind, setKind] = useState<Kind>("analysis");
  const [engine, setEngine] = useState<Engine>("rag");
  const [maxSections, setMaxSections] = useState(5);
  const [validate, setValidate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<DocFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeliverablePayload | null>(null);
  const [copied, setCopied] = useState(false);

  const briefReady = brief.trim().length >= 10;
  const busy = loading || exporting !== null;
  const canSubmit = briefReady && !busy;

  const generate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/deliverable/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief: brief.trim(), kind, engine, maxSections, validate }),
      });
      const data = (await res.json()) as DeliverablePayload & { error?: string };
      if (!res.ok) setError(data.error ?? `Fejl (${res.status})`);
      else setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netværksfejl");
    } finally {
      setLoading(false);
    }
  };

  const exportDoc = async (format: DocFormat) => {
    if (!briefReady || busy) return;
    setExporting(format);
    setError(null);
    try {
      const res = await fetch("/api/deliverable/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brief: brief.trim(),
          format,
          kind,
          engine,
          maxSections,
          markdown: result?.markdown,
        }),
      });
      const data = (await res.json()) as {
        base64?: string;
        filename?: string;
        mediaType?: string;
        error?: string;
      };
      if (!res.ok || !data.base64) {
        setError(data.error ?? `Eksport fejlede (${res.status})`);
        return;
      }
      triggerDownload(
        base64ToBlob(data.base64, data.mediaType ?? "application/octet-stream"),
        data.filename ?? `deliverable.${format}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netværksfejl");
    } finally {
      setExporting(null);
    }
  };

  const download = () => {
    if (!result) return;
    triggerDownload(
      new Blob([result.markdown], { type: "text/markdown" }),
      `deliverable-${result.kind}-${new Date().toISOString().slice(0, 10)}.md`,
    );
  };

  const copy = () => {
    if (!result) return;
    void navigator.clipboard?.writeText(result.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-aurora shadow-glow">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Deliverable Studio</h1>
            <p className="text-sm text-muted-foreground">
              Et brief ind — en citationsbaseret consulting-deliverable ud, drevet af platformens
              knowledge graph og Lego Factory-pipeline.
            </p>
          </div>
        </header>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <label htmlFor="brief" className="mb-1.5 block text-sm font-medium">
              Brief
            </label>
            <textarea
              id="brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="Beskriv hvad deliverablen skal dække (min. 10 tegn)…"
              className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Type</label>
              <div className="flex flex-col gap-1">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKind(k.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                      kind === k.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-input text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <div className="font-medium">{k.label}</div>
                    <div className="text-[11px] text-muted-foreground">{k.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Engine</label>
                <div className="grid grid-cols-2 gap-2">
                  {ENGINES.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setEngine(e.id)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                        engine === e.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-input text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-medium">
                        {e.id === "lego" && <Boxes className="h-3.5 w-3.5" />}
                        {e.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{e.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="sections" className="mb-1.5 block text-sm font-medium">
                  Sektioner: {maxSections}
                </label>
                <input
                  id="sections"
                  type="range"
                  min={2}
                  max={8}
                  value={maxSections}
                  onChange={(e) => setMaxSections(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={validate}
                  onChange={(e) => setValidate(e.target.checked)}
                  className="h-4 w-4"
                />
                <ShieldCheck className="h-4 w-4 text-primary" />
                Kvalitetsvalidering (PRISM-score)
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={generate}
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-aurora px-5 py-2.5 text-sm font-medium text-white shadow-glow transition disabled:opacity-40 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Genererer… (kan tage op til ~2 min)
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generér deliverable
                </>
              )}
            </button>
            <span className="text-xs text-muted-foreground">eller eksportér direkte:</span>
            {(["docx", "pdf"] as DocFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => exportDoc(f)}
                disabled={!briefReady || busy}
                title="Output Forge — render brief til dokument"
                className="inline-flex items-center gap-1.5 rounded-full border border-input px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent disabled:opacity-40"
              >
                {exporting === f ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {result.kind}
              </span>
              {result.engine === "lego" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Boxes className="h-3 w-3" />
                  Lego Factory
                </span>
              )}
              {result.citations > 0 && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {result.citations} citationer
                </span>
              )}
              {result.quality && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-3 w-3" />
                  PRISM {result.quality.score.toFixed(1)}/10
                </span>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Kopieret" : "Kopiér"}
                </button>
                <button
                  onClick={download}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
                >
                  <Download className="h-3 w-3" />
                  Download .md
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <MessageContent text={result.markdown} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
