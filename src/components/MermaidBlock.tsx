import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { detectIntent, detectMermaidType, isMermaidMismatch } from "@/lib/visualizationIntent";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

/**
 * MermaidBlock — render et ```mermaid fence via mermaid.js med pan/zoom der
 * persisteres pr. diagram-indhold på tværs af resize, canvas-skift og reload.
 */

type Viewport = { scale: number; x: number; y: number };

const DEFAULT_VIEWPORT: Viewport = { scale: 1, x: 0, y: 0 };
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const STORAGE_PREFIX = "aurora.mermaid.viewport.";

// Stabil hash så samme diagram-indhold giver samme storage-nøgle.
function hashContent(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function readViewport(key: string): Viewport {
  if (typeof window === "undefined") return DEFAULT_VIEWPORT;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return DEFAULT_VIEWPORT;
    const v = JSON.parse(raw) as Partial<Viewport>;
    return {
      scale: clampScale(Number(v.scale ?? 1)),
      x: Number.isFinite(v.x) ? Number(v.x) : 0,
      y: Number.isFinite(v.y) ? Number(v.y) : 0,
    };
  } catch {
    return DEFAULT_VIEWPORT;
  }
}

function clampScale(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, n));
}

export function MermaidBlock({ content }: { content: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const storageKey = `${STORAGE_PREFIX}${hashContent(content.trim())}`;
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);

  // Hydrér viewport fra localStorage efter mount (undgår SSR-mismatch).
  useEffect(() => {
    setViewport(readViewport(storageKey));
  }, [storageKey]);

  // Persistér viewport (debounced).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(viewport));
      } catch {
        /* quota — ignorér */
      }
    }, 80);
    return () => clearTimeout(t);
  }, [viewport, storageKey]);

  // ResizeObserver: re-render Mermaid hvis containerens målte bredde reelt ændrer sig.
  // Vigtigt: vi observerer YDRE wrapper, ikke stage (stage har CSS-transform der ikke
  // påvirker target-bredden), så zoom-handlinger trigger ikke unødigt re-render.
  useEffect(() => {
    if (typeof window === "undefined" || !wrapRef.current) return;
    let lastWidth = wrapRef.current.clientWidth;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w === 0) return; // collapsed / display:none
      if (Math.abs(w - lastWidth) < 12) return;
      lastWidth = w;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setTick((t) => t + 1), 140);
    });
    observer.observe(wrapRef.current);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Render mermaid SVG. Viewport (zoom/pan) er adskilt og persisteres separat,
  // så re-render af SVG ikke nulstiller den.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const baseInit = {
          startOnLoad: false,
          theme: "dark",
          securityLevel: "strict",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        } as const;

        const trimmed = content.trim();
        mermaid.initialize({
          ...baseInit,
          flowchart: { defaultRenderer: "dagre" },
        } as never);

        const { svg } = await mermaid.render(`m-${id}-${tick}`, trimmed);

        if (cancelled) return;
        if (stageRef.current) {
          stageRef.current.innerHTML = svg;
          const el = stageRef.current.querySelector("svg");
          if (el) {
            el.style.maxWidth = "100%";
            el.style.height = "auto";
            el.style.display = "block";
          }
        }
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        // Beskyt mod cirkulære/DOM-refs i sjældne mermaid-fejlobjekter.
        if (stageRef.current) stageRef.current.innerHTML = "";
        setError(typeof msg === "string" ? msg.slice(0, 500) : "Mermaid render failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content, id, tick]);

  // Wheel-zoom omkring cursor.
  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 1) return;
    e.preventDefault();
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setViewport((v) => {
      const factor = Math.exp(-e.deltaY * 0.0015);
      const next = clampScale(v.scale * factor);
      const k = next / v.scale;
      return { scale: next, x: cx - k * (cx - v.x), y: cy - k * (cy - v.y) };
    });
  }, []);

  // Drag-pan med mus.
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      dragRef.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
    },
    [viewport.x, viewport.y],
  );
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    setViewport((v) => ({ ...v, x: d.vx + (e.clientX - d.x), y: d.vy + (e.clientY - d.y) }));
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  const resetViewport = useCallback(() => setViewport(DEFAULT_VIEWPORT), []);
  const zoomBy = useCallback((f: number) => {
    setViewport((v) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      const cx = rect ? rect.width / 2 : 0;
      const cy = rect ? rect.height / 2 : 0;
      const next = clampScale(v.scale * f);
      const k = next / v.scale;
      return { scale: next, x: cx - k * (cx - v.x), y: cy - k * (cy - v.y) };
    });
  }, []);

  // §2-3 Intent→family resolver: bind brief til canonical family og flag mismatch.
  const detection = useMemo(() => {
    const det = detectIntent(content);
    const actual = detectMermaidType(content);
    const mismatch = det.confidence === "high" && isMermaidMismatch(det.intent, actual);
    // Log altid detaljer for hvorfor klassifikationen blev sat / nedjusteret.
    if (typeof console !== "undefined") {
      console.debug("[MermaidBlock] intent detection", {
        intent: det.intent,
        confidence: det.confidence,
        score: det.score,
        reason: det.reason,
        matchedSignals: det.matchedSignals,
        actualMermaidType: actual,
        mismatch,
      });
    }
    return { det, actual, mismatch };
  }, [content]);

  const mismatchTooltip = useMemo(() => {
    const { det, actual } = detection;
    const signals = det.matchedSignals
      .map((s) => `${s.kind === "keyword" ? `"${s.token}"` : s.token} (+${s.weight})`)
      .join(", ");
    const header = `Forventet mermaid-type: ${det.standard.mermaidType} — fundet: ${actual ?? "?"}`;
    const why = det.matchedSignals.length
      ? `Udløst af ${det.matchedSignals.length} signal(er): ${signals}`
      : "Ingen direkte signaler — default-intent.";
    const conf = det.reason;
    return `${header}\n${why}\n${conf}`;
  }, [detection]);

  if (error) {
    return (
      <figure className="aurora-figure aurora-mermaid-host">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          Mermaid-fejl: {error}
        </div>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">{content}</pre>
      </figure>
    );
  }

  return (
    <figure className="aurora-figure aurora-figure--flat aurora-mermaid-host">
      <div
        ref={wrapRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="aurora-mermaid relative w-full overflow-hidden touch-none select-none"
        style={{ cursor: dragRef.current ? "grabbing" : "grab", minHeight: 120 }}
      >
        <div
          ref={stageRef}
          className="flex w-full justify-center will-change-transform"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
            transformOrigin: "0 0",
          }}
        />
        <div className="pointer-events-auto absolute left-2 top-2 flex items-center gap-1 rounded-md border border-border/60 bg-card/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur">
          <span className="font-semibold text-foreground/80">{detection.det.standard.label}</span>
          <span className="opacity-50">·</span>
          <span>{detection.det.standard.family}</span>
          {detection.mismatch && (
            <HoverCard openDelay={120} closeDelay={80}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  className="ml-1 cursor-help rounded-sm bg-amber-500/20 px-1 py-px text-[9px] font-semibold text-amber-400 hover:bg-amber-500/30"
                  title={mismatchTooltip}
                  aria-label="Mismatch-detaljer"
                >
                  !mismatch
                </button>
              </HoverCardTrigger>
              <HoverCardContent side="bottom" align="start" className="w-80 space-y-2 text-xs">
                <div className="font-semibold text-foreground">Type-mismatch detekteret</div>
                <div className="text-muted-foreground">
                  Forventet:{" "}
                  <span className="font-mono text-foreground">
                    {detection.det.standard.mermaidType}
                  </span>
                  {" — "}
                  fundet:{" "}
                  <span className="font-mono text-foreground">{detection.actual ?? "?"}</span>
                </div>
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Hvorfor intent = {detection.det.intent}
                  </div>
                  {detection.det.matchedSignals.length > 0 ? (
                    <ul className="space-y-0.5">
                      {detection.det.matchedSignals.map((s, i) => (
                        <li key={i} className="font-mono text-[11px]">
                          <span className="text-muted-foreground">{s.kind}:</span>{" "}
                          <span className="text-foreground">{s.token}</span>{" "}
                          <span className="text-amber-400">+{s.weight}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-muted-foreground">Ingen signaler — default.</div>
                  )}
                </div>
                <div className="border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                  {detection.det.reason}
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
        </div>
        <div className="pointer-events-auto absolute right-2 top-2 flex gap-1 rounded-md border border-border/60 bg-card/80 p-1 text-[11px] backdrop-blur">
          <button
            type="button"
            onClick={() => zoomBy(1.2)}
            className="rounded px-2 py-0.5 hover:bg-accent"
            title="Zoom ind"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.2)}
            className="rounded px-2 py-0.5 hover:bg-accent"
            title="Zoom ud"
          >
            −
          </button>
          <button
            type="button"
            onClick={resetViewport}
            className="rounded px-2 py-0.5 hover:bg-accent"
            title="Reset zoom"
          >
            {Math.round(viewport.scale * 100)}%
          </button>
        </div>
      </div>
    </figure>
  );
}
