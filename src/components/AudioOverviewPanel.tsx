/**
 * AudioOverviewPanel — NotebookLM-style Audio Overview player.
 *
 * Generates a 2-host podcast script from ingested sources using the
 * /api/audio-overview endpoint, then plays it via the Web Speech API.
 * Host A gets voice index 0, Host B gets voice index 1 (or pitch-shifted
 * fallback). Shows the full script as a transcript alongside.
 */
import { useEffect, useRef, useState } from "react";
import {
  Headphones,
  Play,
  Pause,
  Square,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Mic2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { IngestedSource } from "@/components/IngestSourcesPanel";
import type { AudioSegment, AudioOverviewResponse } from "@/routes/api/audio-overview";

type Status = "idle" | "generating" | "ready" | "playing" | "paused" | "error";

type Props = {
  sources: IngestedSource[];
  onClose: () => void;
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioOverviewPanel({ sources, onClose }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<AudioSegment[]>([]);
  const [durationEstimate, setDurationEstimate] = useState(0);
  const [currentSegIdx, setCurrentSegIdx] = useState(-1);
  const [scriptOpen, setScriptOpen] = useState(false);

  const utterQueueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const playingRef = useRef(false);
  const segIdxRef = useRef(-1);
  const pausedRef = useRef(false);

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Load voices — they may not be available immediately
  useEffect(() => {
    const load = () => {
      voicesRef.current = window.speechSynthesis?.getVoices() ?? [];
    };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const generate = async () => {
    setStatus("generating");
    setError(null);
    setSegments([]);
    setCurrentSegIdx(-1);
    segIdxRef.current = -1;

    const okSources = sources.filter((s) => s.status === "ok").map((s) => s.filename);
    const allSources = sources.map((s) => s.filename);

    try {
      const res = await fetch("/api/audio-overview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sources: okSources.length > 0 ? okSources : allSources }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AudioOverviewResponse;
      setSegments(data.segments);
      setDurationEstimate(data.duration_estimate_seconds);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generering fejlede");
      setStatus("error");
    }
  };

  const speakFrom = (startIdx: number) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      setError("Web Speech API ikke tilgængelig i denne browser");
      return;
    }
    synth.cancel();
    utterQueueRef.current = [];
    playingRef.current = true;
    pausedRef.current = false;

    const voices = voicesRef.current;
    // Pick two distinct voices: prefer matching-language voices
    const daVoices = voices.filter((v) => v.lang.startsWith("da") || v.lang.startsWith("en"));
    const allV = daVoices.length >= 2 ? daVoices : voices;
    const voiceA = allV[0] ?? null;
    const voiceB = allV[1] ?? allV[0] ?? null;

    const remaining = segments.slice(startIdx);
    remaining.forEach((seg, relIdx) => {
      const absIdx = startIdx + relIdx;
      const utt = new SpeechSynthesisUtterance(seg.text);
      utt.lang = "da-DK";
      utt.rate = 1.0;
      utt.pitch = seg.speaker === "A" ? 1.1 : 0.9;
      if (seg.speaker === "A" && voiceA) utt.voice = voiceA;
      if (seg.speaker === "B" && voiceB) utt.voice = voiceB;

      utt.onstart = () => {
        segIdxRef.current = absIdx;
        setCurrentSegIdx(absIdx);
        setStatus("playing");
      };

      utt.onend = () => {
        if (absIdx === segments.length - 1) {
          // Done
          playingRef.current = false;
          segIdxRef.current = -1;
          setCurrentSegIdx(-1);
          setStatus("ready");
        }
      };

      utt.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        playingRef.current = false;
        setError(`TTS-fejl: ${e.error}`);
        setStatus("error");
      };

      utterQueueRef.current.push(utt);
      synth.speak(utt);
    });
  };

  const handlePlay = () => {
    if (status === "paused") {
      pausedRef.current = false;
      window.speechSynthesis?.resume();
      setStatus("playing");
    } else {
      speakFrom(0);
    }
  };

  const handlePause = () => {
    if (window.speechSynthesis?.speaking) {
      pausedRef.current = true;
      window.speechSynthesis.pause();
      setStatus("paused");
    }
  };

  const handleStop = () => {
    window.speechSynthesis?.cancel();
    playingRef.current = false;
    segIdxRef.current = -1;
    setCurrentSegIdx(-1);
    setStatus("ready");
  };

  const handleSegmentClick = (idx: number) => {
    speakFrom(idx);
  };

  const isPlaying = status === "playing";
  const isPaused = status === "paused";
  const hasSpeech = typeof window !== "undefined" && !!window.speechSynthesis;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/95 p-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Headphones className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-foreground">Audio Overview</div>
            <div className="text-[11px] text-muted-foreground">
              {sources.length} kilde{sources.length !== 1 ? "r" : ""}
              {durationEstimate > 0 && ` · ~${formatDuration(durationEstimate)}`}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition"
          aria-label="Luk Audio Overview"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* State: idle */}
      {status === "idle" && (
        <button
          onClick={generate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <Mic2 className="h-4 w-4" />
          Generer podcast-oversigt
        </button>
      )}

      {/* State: generating */}
      {status === "generating" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin flex-none text-primary" />
          Genererer manuskript…
        </div>
      )}

      {/* State: error */}
      {status === "error" && (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-xs text-destructive">
            {error}
          </div>
          <button
            onClick={generate}
            className="self-start text-xs text-primary underline underline-offset-2 hover:no-underline"
          >
            Prøv igen
          </button>
        </div>
      )}

      {/* State: ready / playing / paused */}
      {(status === "ready" || isPlaying || isPaused) && segments.length > 0 && (
        <>
          {/* Player controls */}
          <div className="flex items-center gap-2">
            {!isPlaying && !isPaused ? (
              <button
                onClick={handlePlay}
                disabled={!hasSpeech}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Afspil
              </button>
            ) : (
              <>
                {isPlaying ? (
                  <button
                    onClick={handlePause}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition hover:bg-primary/90"
                  >
                    <Pause className="h-3.5 w-3.5 fill-current" />
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={handlePlay}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition hover:bg-primary/90"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Fortsæt
                  </button>
                )}
                <button
                  onClick={handleStop}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-[13px] text-foreground transition hover:bg-accent"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  Stop
                </button>
              </>
            )}
            <button
              onClick={generate}
              className="ml-auto text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground hover:no-underline transition"
            >
              Generer igen
            </button>
          </div>

          {!hasSpeech && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Web Speech API ikke tilgængelig — se manuskriptet nedenfor.
            </p>
          )}

          {/* Collapsible transcript */}
          <div className="border-t border-border/50 pt-2">
            <button
              onClick={() => setScriptOpen((v) => !v)}
              className="flex w-full items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
            >
              {scriptOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Manuskript ({segments.length} replikker)
            </button>
            {scriptOpen && (
              <div className="mt-2 flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
                {segments.map((seg, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSegmentClick(idx)}
                    className={cn(
                      "group flex gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] leading-relaxed transition hover:bg-accent/60",
                      currentSegIdx === idx && "bg-primary/10 text-foreground",
                      currentSegIdx !== idx && "text-muted-foreground",
                    )}
                    title={`Afspil fra denne replik`}
                  >
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
                        seg.speaker === "A"
                          ? "bg-primary/15 text-primary"
                          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {seg.speaker === "A" ? "A" : "B"}
                    </span>
                    <span className="flex-1">{seg.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
