import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import {
  Presentation,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Download,
  Check,
  AlertTriangle,
  GripVertical,
  Edit3,
  CheckCircle2,
  XCircle,
  FileDown,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  generatePPTX,
  generateDOCX,
  generateXLSX,
  downloadBlob,
  slidesToMarkdown,
  type DocTheme,
} from "@/lib/output-generators";
import type { HeadlineSlide, StorylineResponse, MeceResponse } from "./api/storyline";

export const Route = createFileRoute("/storyline")({
  head: () => ({
    meta: [
      { title: "Storyline Builder — WidgeTDC Aurora" },
      { name: "description", content: "Outline-first McKinsey-stil præsentationsbuilder med MECE-check og governing-thought headlines." },
    ],
  }),
  component: StorylineRoute,
});

type Kind = "analysis" | "roadmap" | "assessment";
type Step = 1 | 2 | 3;
type ExportFormat = "pptx" | "docx" | "xlsx";

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "analysis", label: "Analyse", hint: "Problem → findings → anbefalinger" },
  { id: "roadmap", label: "Roadmap", hint: "Vision → faser → milepæle" },
  { id: "assessment", label: "Assessment", hint: "Kriterier → vurdering → score" },
];

const THEMES: { id: DocTheme; label: string; dot: string }[] = [
  { id: "modern",   label: "Modern",   dot: "bg-blue-500" },
  { id: "mckinsey", label: "McKinsey", dot: "bg-indigo-600" },
  { id: "bcg",      label: "BCG",      dot: "bg-emerald-600" },
  { id: "bain",     label: "Bain",     dot: "bg-red-600" },
  { id: "dark",     label: "Dark",     dot: "bg-slate-700" },
];

function SlideCard({
  slide,
  index,
  total,
  onUpdate,
  onMoveUp,
  onMoveDown,
}: {
  slide: HeadlineSlide;
  index: number;
  total: number;
  onUpdate: (updated: HeadlineSlide) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [editingGT, setEditingGT] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);

  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 transition hover:border-primary/40">
      <div className="mb-2 flex items-start gap-2">
        <div className="flex flex-col gap-0.5 pt-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
          >
            <GripVertical className="h-3 w-3" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
          >
            <GripVertical className="h-3 w-3 rotate-180" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {index + 1}
            </span>
            {editingTitle ? (
              <input
                autoFocus
                value={slide.title}
                onChange={(e) => onUpdate({ ...slide, title: e.target.value })}
                onBlur={() => setEditingTitle(false)}
                className="flex-1 rounded border border-input bg-background px-2 py-0.5 text-sm outline-none focus:border-primary"
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="flex-1 text-left text-sm font-semibold text-foreground hover:text-primary"
              >
                {slide.title}
                <Edit3 className="ml-1 inline h-3 w-3 opacity-0 group-hover:opacity-60" />
              </button>
            )}
          </div>

          {/* Governing thought */}
          <div className="mb-2 ml-7">
            {editingGT ? (
              <textarea
                autoFocus
                value={slide.governing_thought}
                onChange={(e) => onUpdate({ ...slide, governing_thought: e.target.value })}
                onBlur={() => setEditingGT(false)}
                rows={2}
                placeholder="Governing thought — hvad er konklusionen på denne slide?"
                className="w-full resize-none rounded border border-primary/50 bg-background px-2 py-1 text-sm text-primary outline-none"
              />
            ) : (
              <button
                onClick={() => setEditingGT(true)}
                className="w-full text-left text-sm text-primary font-medium italic"
              >
                {slide.governing_thought || (
                  <span className="text-muted-foreground not-italic">"Klik for at tilføje governing thought…"</span>
                )}
                <Edit3 className="ml-1 inline h-3 w-3 opacity-0 group-hover:opacity-60" />
              </button>
            )}
          </div>

          {/* Key points */}
          <ul className="ml-7 space-y-1">
            {slide.key_points.map((pt, pi) => (
              <li key={pi} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="mt-0.5 text-primary">▸</span>
                <input
                  value={pt}
                  onChange={(e) => {
                    const points = [...slide.key_points];
                    points[pi] = e.target.value;
                    onUpdate({ ...slide, key_points: points });
                  }}
                  className="flex-1 bg-transparent outline-none hover:underline focus:underline"
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StorylineRoute() {
  const [step, setStep] = useState<Step>(1);
  const [brief, setBrief] = useState("");
  const [kind, setKind] = useState<Kind>("analysis");
  const [slideCount, setSlideCount] = useState(5);
  const [theme, setTheme] = useState<DocTheme>("modern");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<HeadlineSlide[]>([]);
  const [degraded, setDegraded] = useState(false);

  const [meceLoading, setMeceLoading] = useState(false);
  const [meceResult, setMeceResult] = useState<MeceResponse | null>(null);

  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const briefReady = brief.trim().length >= 10;

  const generateOutline = async () => {
    if (!briefReady) return;
    setLoading(true);
    setError(null);
    setMeceResult(null);
    try {
      const res = await fetch("/api/storyline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief: brief.trim(), kind, slide_count: slideCount }),
      });
      const data = (await res.json()) as StorylineResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Fejl (${res.status})`);
        return;
      }
      setSlides(data.slides);
      setDegraded(data.degraded ?? false);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netværksfejl");
    } finally {
      setLoading(false);
    }
  };

  const checkMece = async () => {
    setMeceLoading(true);
    setMeceResult(null);
    try {
      const res = await fetch("/api/storyline/mece", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slides }),
      });
      const data = (await res.json()) as MeceResponse & { error?: string };
      if (res.ok) setMeceResult(data);
    } catch {
      // Silent — MECE check is best-effort
    } finally {
      setMeceLoading(false);
    }
  };

  const moveSlide = useCallback((from: number, to: number) => {
    setSlides((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const updateSlide = useCallback((index: number, updated: HeadlineSlide) => {
    setSlides((prev) => prev.map((s, i) => (i === index ? updated : s)));
  }, []);

  const doExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      const markdown = slidesToMarkdown(slides);
      const title = slides[0]?.title ?? "storyline";
      const date = new Date().toISOString().slice(0, 10);
      const base = `${title.replace(/[^a-z0-9æøå]/gi, "-").toLowerCase()}-${date}`;

      if (format === "pptx") {
        downloadBlob(generatePPTX(markdown, theme), `${base}.html`);
      } else if (format === "docx") {
        downloadBlob(generateDOCX(markdown, theme), `${base}.doc`);
      } else {
        downloadBlob(generateXLSX(markdown), `${base}.xls`);
      }
    } finally {
      setExporting(null);
    }
  };

  const proceed = async () => {
    await checkMece();
    setStep(3);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">

        {/* Header */}
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-aurora shadow-glow">
            <Presentation className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Storyline Builder</h1>
            <p className="text-sm text-muted-foreground">
              McKinsey Pyramid Principle — outline-first med governing-thought headlines og MECE-check.
            </p>
          </div>
        </header>

        {/* Step indicators */}
        <div className="mb-8 flex items-center gap-2 text-xs">
          {[
            { n: 1, label: "Brief" },
            { n: 2, label: "Rediger outline" },
            { n: 3, label: "MECE + Export" },
          ].map(({ n, label }) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition",
                  step === n
                    ? "bg-primary text-primary-foreground"
                    : step > n
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {step > n ? <Check className="h-3 w-3" /> : n}
              </div>
              <span className={step >= n ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              {n < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* ── Step 1: Brief ─── */}
        {step === 1 && (
          <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
            <div>
              <label htmlFor="brief" className="mb-1.5 block text-sm font-medium">
                Brief
              </label>
              <textarea
                id="brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={4}
                placeholder="Beskriv hvad præsentationen skal dække. Fx: Analyse af kundernes kanalvalg og implikationer for prisstrategi."
                className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Type</label>
                <div className="flex flex-col gap-1">
                  {KINDS.map((k) => (
                    <button
                      key={k.id}
                      onClick={() => setKind(k.id)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm transition",
                        kind === k.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-input text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <div className="font-medium">{k.label}</div>
                      <div className="text-[11px] text-muted-foreground">{k.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Antal slides: {slideCount}</label>
                  <input
                    type="range"
                    min={3}
                    max={10}
                    value={slideCount}
                    onChange={(e) => setSlideCount(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>3</span><span>10</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Tema</label>
                  <div className="flex flex-wrap gap-2">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition",
                          theme === t.id
                            ? "border-primary text-foreground"
                            : "border-input text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <div className={cn("h-2.5 w-2.5 rounded-full", t.dot)} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={generateOutline}
              disabled={!briefReady || loading}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-aurora px-5 py-2.5 text-sm font-medium text-white shadow-glow transition disabled:opacity-40 disabled:shadow-none"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Genererer outline…</>
              ) : (
                <><Sparkles className="h-4 w-4" />Generer storyline-outline</>
              )}
            </button>
          </div>
        )}

        {/* ── Step 2: Edit outline ─── */}
        {step === 2 && (
          <div className="space-y-4">
            {degraded && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Platform-pipeline ikke tilgængelig — outline er et placeholder. Udfyld governing thoughts manuelt.
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {slides.length} slides — klik for at redigere titel, governing thought og key points.
              </p>
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-3 w-3" />
                Rediger brief
              </button>
            </div>

            <div className="space-y-3">
              {slides.map((slide, i) => (
                <SlideCard
                  key={i}
                  slide={slide}
                  index={i}
                  total={slides.length}
                  onUpdate={(updated) => updateSlide(i, updated)}
                  onMoveUp={() => moveSlide(i, i - 1)}
                  onMoveDown={() => moveSlide(i, i + 1)}
                />
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={proceed}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-aurora px-5 py-2.5 text-sm font-medium text-white shadow-glow transition"
              >
                <CheckCircle2 className="h-4 w-4" />
                MECE-check + Eksporter
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: MECE + Export ─── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">MECE-check + Eksport</h2>
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-3 w-3" />
                Rediger outline
              </button>
            </div>

            {/* MECE result */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {meceLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : meceResult?.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : meceResult ? (
                    <XCircle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    {meceLoading
                      ? "Kører MECE-check…"
                      : meceResult?.passed
                      ? "MECE godkendt"
                      : meceResult
                      ? "MECE: mulige forbedringer"
                      : "MECE-check ikke kørt"}
                  </span>
                </div>
                <button
                  onClick={checkMece}
                  disabled={meceLoading}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  <RefreshCw className="h-3 w-3" />
                  Kør igen
                </button>
              </div>

              {meceResult && !meceResult.passed && (
                <div className="space-y-3">
                  {meceResult.issues.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-300">Problemer:</p>
                      <ul className="space-y-1">
                        {meceResult.issues.map((issue, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="text-amber-500">•</span>{issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {meceResult.suggestions.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-primary">Forslag:</p>
                      <ul className="space-y-1">
                        {meceResult.suggestions.map((s, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="text-primary">→</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {meceResult?.passed && (
                <p className="text-xs text-muted-foreground">
                  Slides er MECE — ingen overlappende emner, storylinen dækker problemet fuldt ud.
                </p>
              )}
            </div>

            {/* Slide summary */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-medium">Outline ({slides.length} slides)</h3>
              <ol className="space-y-3">
                {slides.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <div className="font-medium text-foreground">{s.title}</div>
                      {s.governing_thought && (
                        <div className="text-xs text-primary italic mt-0.5">{s.governing_thought}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Export */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-1 text-sm font-medium">Eksportér</h3>
              <p className="mb-4 text-xs text-muted-foreground">
                Tema: <strong>{theme}</strong> — genererer direkte fra outline i browseren (ingen server-round-trip).
              </p>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    { format: "pptx" as ExportFormat, label: "PowerPoint (.html)", icon: <Presentation className="h-4 w-4" /> },
                    { format: "docx" as ExportFormat, label: "Word (.doc)", icon: <FileDown className="h-4 w-4" /> },
                    { format: "xlsx" as ExportFormat, label: "Excel (.xls)", icon: <FileDown className="h-4 w-4" /> },
                  ] as const
                ).map(({ format, label, icon }) => (
                  <button
                    key={format}
                    onClick={() => doExport(format)}
                    disabled={exporting !== null}
                    className="inline-flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
                  >
                    {exporting === format ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
                    {label}
                  </button>
                ))}
              </div>

              {/* Tema-vælger på export step */}
              <div className="mt-4 flex flex-wrap gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition",
                      theme === t.id
                        ? "border-primary text-foreground"
                        : "border-input text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <div className={cn("h-2.5 w-2.5 rounded-full", t.dot)} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setStep(1); setSlides([]); setMeceResult(null); setBrief(""); }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Start forfra
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
