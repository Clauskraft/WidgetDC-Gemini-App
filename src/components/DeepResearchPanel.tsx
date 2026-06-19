/**
 * DeepResearchPanel — streams multi-step deep research results.
 *
 * Shows live progress through Plan → Research steps → Report.
 * The final report is rendered as markdown in a scrollable panel.
 */
import { useState, useRef } from "react";
import {
  Search,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  FileSearch,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { IngestedSource } from "@/components/IngestSourcesPanel";

type Phase = "idle" | "planning" | "researching" | "synthesizing" | "done" | "error";

type Step = {
  index: number;
  question: string;
  finding: string;
  done: boolean;
};

type Props = {
  sources: IngestedSource[];
  onClose: () => void;
  onInsertReport?: (markdown: string) => void;
};

export function DeepResearchPanel({ sources, onClose, onInsertReport }: Props) {
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [questions, setQuestions] = useState<string[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stepsOpen, setStepsOpen] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const okSources = sources.filter((s) => s.status === "ok").map((s) => s.filename);

  const start = async () => {
    if (!topic.trim() || phase === "planning" || phase === "researching" || phase === "synthesizing") return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setPhase("planning");
    setQuestions([]);
    setSteps([]);
    setReport(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/deep-research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), sources: okSources }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const eventLine = part.match(/^event: (.+)$/m)?.[1];
          const dataLine = part.match(/^data: (.+)$/ms)?.[1];
          if (!eventLine || !dataLine) continue;
          try {
            const payload = JSON.parse(dataLine) as Record<string, unknown>;
            if (eventLine === "plan") {
              const qs = (payload.questions as string[]) ?? [];
              setQuestions(qs);
              setPhase("researching");
              setSteps(qs.map((q, i) => ({ index: i, question: q, finding: "", done: false })));
            } else if (eventLine === "step") {
              const idx = payload.index as number;
              const finding = (payload.finding as string) ?? "";
              setSteps((prev) =>
                prev.map((s) => (s.index === idx ? { ...s, finding, done: true } : s)),
              );
              // If all steps done, synthesizing
              setSteps((prev) => {
                const allDone = prev.every((s) => s.index === idx || s.done);
                if (allDone) setPhase("synthesizing");
                return prev;
              });
            } else if (eventLine === "report") {
              const md = (payload.markdown as string) ?? "";
              setReport(md);
              setPhase("done");
            } else if (eventLine === "error") {
              setErrorMsg((payload.message as string) ?? "Ukendt fejl");
              setPhase("error");
            }
          } catch {
            // malformed SSE chunk
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setErrorMsg(err instanceof Error ? err.message : "Netværksfejl");
        setPhase("error");
      }
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setPhase("idle");
  };

  const isRunning = phase === "planning" || phase === "researching" || phase === "synthesizing";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/95 shadow-lg overflow-hidden max-h-[90vh]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
            <FileSearch className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-foreground">Deep Research</div>
            <div className="text-[11px] text-muted-foreground">
              {sources.length > 0
                ? `${okSources.length} kilde${okSources.length !== 1 ? "r" : ""} · ${sources.length - okSources.length > 0 ? `${sources.length - okSources.length} afventer` : "klar"}`
                : "Ingen kilder — forsker i platform-viden"}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition"
          aria-label="Luk Deep Research"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Input */}
      <div className="px-4 pt-1">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isRunning) void start();
              }}
              placeholder={
                sources.length > 0
                  ? "Hvad vil du forske i dine dokumenter?"
                  : "Hvad vil du forske i?"
              }
              disabled={isRunning}
              className="w-full rounded-xl border border-border bg-background py-2 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 disabled:opacity-60"
            />
          </div>
          {isRunning ? (
            <button
              onClick={stop}
              className="flex-none rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => void start()}
              disabled={!topic.trim()}
              className="flex-none rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
            >
              Start
            </button>
          )}
        </div>
      </div>

      {/* Progress area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
        {/* Phase indicator */}
        {(isRunning || phase === "done") && (
          <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/15 px-3 py-2">
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary flex-none" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-none" />
            )}
            <span className="text-[12px] font-medium text-foreground">
              {phase === "planning" && "Analyserer emnet og planlægger forskning…"}
              {phase === "researching" && `Forsker i ${steps.filter((s) => s.done).length}/${steps.length} underspørgsmål…`}
              {phase === "synthesizing" && "Syntetiserer rapport…"}
              {phase === "done" && "Forskning afsluttet"}
            </span>
          </div>
        )}

        {/* Error */}
        {phase === "error" && errorMsg && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-xs text-destructive">
            {errorMsg}
          </div>
        )}

        {/* Questions / steps */}
        {steps.length > 0 && (
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setStepsOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition self-start"
            >
              {stepsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Forskningsspørgsmål ({steps.filter((s) => s.done).length}/{steps.length})
            </button>
            {stepsOpen && (
              <div className="flex flex-col gap-1.5 mt-1">
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-[12px] transition-colors",
                      step.done
                        ? "border-green-500/20 bg-green-500/5"
                        : questions.length > 0 && !step.done && steps.slice(0, i).every((s) => s.done)
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/50 bg-muted/20",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex-none">
                        {step.done ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : questions.length > 0 && steps.slice(0, i).every((s) => s.done) && isRunning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full border border-border/60" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground leading-snug">{step.question}</div>
                        {step.finding && (
                          <div className="mt-1 text-muted-foreground leading-relaxed line-clamp-3">
                            {step.finding}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Report */}
        {report && (
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                Forskningsrapport
              </div>
              {onInsertReport && (
                <button
                  onClick={() => onInsertReport(report)}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/15"
                >
                  <Sparkles className="h-3 w-3" />
                  Indsæt i chat
                </button>
              )}
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-[12px] leading-relaxed text-foreground max-h-96 overflow-y-auto">
              <ReportMarkdown markdown={report} />
            </div>
          </div>
        )}

        {/* Idle placeholder */}
        {phase === "idle" && (
          <div className="text-center text-[12px] text-muted-foreground/60 py-4">
            Stil et spørgsmål — Aurora forsker autonomt og skriver en rapport.
          </div>
        )}
      </div>
    </div>
  );
}

/** Minimal markdown renderer — headings, bold, lists. No new deps. */
function ReportMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="my-1 list-disc pl-4 space-y-0.5">
          {listItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ul>,
      );
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    if (line.startsWith("### ")) {
      flushList();
      elements.push(<h3 key={i} className="mt-3 mb-1 font-semibold text-foreground text-[13px]">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(<h2 key={i} className="mt-3 mb-1 font-bold text-foreground text-[13px] border-b border-border/40 pb-0.5">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      flushList();
      elements.push(<h1 key={i} className="mt-2 mb-1 font-bold text-foreground text-[14px]">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listItems.push(line.slice(2));
    } else if (/^\d+\. /.test(line)) {
      listItems.push(line.replace(/^\d+\. /, ""));
    } else if (line.trim() === "") {
      flushList();
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      flushList();
      elements.push(
        <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />,
      );
    }
  });
  flushList();

  return <div className="space-y-0.5">{elements}</div>;
}

function inlineFormat(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">$1</code>')
    .replace(/\[(\d+)\]/g, '<sup class="text-primary font-medium">[$1]</sup>');
}
