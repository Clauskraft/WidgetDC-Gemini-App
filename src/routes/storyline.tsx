import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import {
  Presentation,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SlideCard } from "@/components/SlideCard";
import { ThemePicker, THEMES } from "@/components/ThemePicker";
import { MeceResultPanel } from "@/components/MeceResultPanel";
import { ExportToolbar } from "@/components/ExportToolbar";
import type { DocTheme } from "@/lib/output-generators";
import type { HeadlineSlide, StorylineResponse, MeceResponse, ComplianceTier } from "./api/storyline";

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

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "analysis",   label: "Analyse",    hint: "Problem → findings → anbefalinger" },
  { id: "roadmap",    label: "Roadmap",    hint: "Vision → faser → milepæle" },
  { id: "assessment", label: "Assessment", hint: "Kriterier → vurdering → score" },
];

const COMPLIANCE_TIERS: { id: ComplianceTier; label: string; hint: string }[] = [
  { id: "public",       label: "Public",       hint: "Kan deles frit" },
  { id: "confidential", label: "Confidential", hint: "Kun internt" },
  { id: "restricted",   label: "Restricted",   hint: "Strengt fortroligt" },
];

const STEPS = [
  { n: 1 as Step, label: "Brief" },
  { n: 2 as Step, label: "Rediger outline" },
  { n: 3 as Step, label: "MECE + Export" },
];

function StorylineRoute() {
  const [step, setStep] = useState<Step>(1);
  const [brief, setBrief] = useState("");
  const [kind, setKind] = useState<Kind>("analysis");
  const [slideCount, setSlideCount] = useState(5);
  const [theme, setTheme] = useState<DocTheme>("modern");
  const [complianceTier, setComplianceTier] = useState<ComplianceTier>("public");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<HeadlineSlide[]>([]);
  const [degraded, setDegraded] = useState(false);

  const [meceLoading, setMeceLoading] = useState(false);
  const [meceResult, setMeceResult] = useState<MeceResponse | null>(null);

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
        body: JSON.stringify({
          brief: brief.trim(),
          kind,
          slide_count: slideCount,
          compliance_tier: complianceTier,
        }),
      });
      const data = (await res.json()) as StorylineResponse & { error?: string };
      if (!res.ok) { setError(data.error ?? `Fejl (${res.status})`); return; }
      setSlides(data.slides);
      setDegraded(data.degraded ?? false);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netværksfejl");
    } finally {
      setLoading(false);
    }
  };

  const checkMece = useCallback(async () => {
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
    } catch { /* best-effort */ } finally {
      setMeceLoading(false);
    }
  }, [slides]);

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

  const proceed = useCallback(async () => {
    await checkMece();
    setStep(3);
  }, [checkMece]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">

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
          {STEPS.map(({ n, label }) => (
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
              <label htmlFor="brief" className="mb-1.5 block text-sm font-medium">Brief</label>
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
                  <ThemePicker value={theme} onChange={setTheme} />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Fortrolighed</label>
                  <div className="flex flex-col gap-1">
                    {COMPLIANCE_TIERS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setComplianceTier(t.id)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-left text-xs transition",
                          complianceTier === t.id
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-input text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <span className="font-medium">{t.label}</span>
                        <span className="ml-2 text-muted-foreground">{t.hint}</span>
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

            <MeceResultPanel loading={meceLoading} result={meceResult} onRerun={checkMece} />

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

            <ExportToolbar slides={slides} theme={theme} onThemeChange={setTheme} />

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
