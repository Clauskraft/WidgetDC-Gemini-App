import type { UIMessage } from "ai";
import { X, Layers, ZoomIn, Pin, GripVertical, ChevronsRight, ChevronsLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageContent } from "@/components/MessageContent";
import { cn } from "@/lib/utils";

function getText(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

// Extract Mermaid diagrams from content
function extractMermaid(content: string): { text: string; diagrams: string[] } {
  const diagrams: string[] = [];
  const text = content.replace(/```mermaid\n([\s\S]*?)```/g, (_, code) => {
    diagrams.push(code.trim());
    return '';
  });
  return { text, diagrams };
}

// Den "expanded" bredde gemmes UAFHÆNGIGT af collapsed-flaget, så vi altid kan
// gendanne den nøjagtige sidste bredde når brugeren udvider panelet igen.
const STORAGE_KEY = "aurora.canvas.width";
const COLLAPSED_KEY = "aurora.canvas.collapsed";
const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 320;
const COLLAPSED_WIDTH = 44;

function clampWidth(n: number): number {
  if (typeof window === "undefined") return Math.max(MIN_WIDTH, n);
  const max = Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.9));
  return Math.min(max, Math.max(MIN_WIDTH, n));
}

function readStoredExpandedWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= MIN_WIDTH ? clampWidth(n) : DEFAULT_WIDTH;
}

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(COLLAPSED_KEY) === "1";
}

export function CanvasPanel({ messages, onClose }: { messages: UIMessage[]; onClose: () => void }) {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const content = lastAssistant ? getText(lastAssistant) : "";
  const { text: cleanText, diagrams } = extractMermaid(content);

  // expandedWidth = brugerens valgte bredde når panelet er åbent.
  // collapsed = visuel tilstand (rail). Disse er bevidst adskilte.
  const [expandedWidth, setExpandedWidth] = useState<number>(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setExpandedWidth(readStoredExpandedWidth());
    setCollapsed(readStoredCollapsed());
  }, []);

  // Persistér KUN expanded-bredden — collapsed-bredden (rail) er en
  // afledt visningstilstand og må aldrig overskrive den huskede bredde.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, String(expandedWidth));
  }, [expandedWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const startDrag = useCallback((startX: number, startWidth: number) => {
    setDragging(true);
    const onMove = (clientX: number) => {
      // Handle sits on left edge; dragging left increases width.
      const delta = startX - clientX;
      setExpandedWidth(clampWidth(startWidth + delta));
    };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientX);
    };
    const stop = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stop);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", stop);
  }, []);

  const expandedWidthRef = useRef(expandedWidth);
  expandedWidthRef.current = expandedWidth;

  // Visningsbredde: rail når collapsed, ellers den huskede expanded-bredde.
  const effectiveWidth = collapsed ? COLLAPSED_WIDTH : expandedWidth;

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      aria-expanded={!collapsed}
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex h-screen w-full flex-col overflow-hidden border-l border-border bg-card shadow-2xl md:static md:z-auto md:shadow-none",
        // Skip width-transition under aktiv drag for at undgå "elastik"-følelse.
        !dragging && "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
      )}
      style={{
        width:
          typeof window !== "undefined" && window.innerWidth >= 768 ? effectiveWidth : undefined,
        maxWidth: "100vw",
      }}
    >
      {/* Resize handle (desktop only, hidden when collapsed) */}
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize canvas"
          title="Træk for at justere bredde · dobbeltklik for reset"
          onMouseDown={(e) => {
            e.preventDefault();
            startDrag(e.clientX, expandedWidthRef.current);
          }}
          onTouchStart={(e) => {
            if (e.touches[0]) startDrag(e.touches[0].clientX, expandedWidthRef.current);
          }}
          onDoubleClick={() => setExpandedWidth(DEFAULT_WIDTH)}
          className={cn(
            "absolute inset-y-0 -left-1 z-50 hidden w-2 cursor-col-resize items-center justify-center md:flex",
            dragging ? "bg-primary/30" : "hover:bg-primary/20",
          )}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/60" />
        </div>
      )}

      {/* Header — kompakt vertikal stripe når collapsed */}
      <div
        className={cn(
          "flex items-center border-b border-border/60",
          collapsed ? "flex-col gap-2 px-2 py-3" : "justify-between px-4 py-3",
        )}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Udvid canvas" : "Skjul canvas"}
          aria-label={collapsed ? "Udvid canvas" : "Skjul canvas"}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        >
          {collapsed ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
        </button>

        {!collapsed && (
          <>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Canvas</span>
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                {expandedWidth}px
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                title="Zoom"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                title="Pin"
              >
                <Pin className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                title="Luk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {collapsed && <Layers className="h-4 w-4 text-primary" />}
      </div>

      {/*
        Body forbliver MONTERET når collapsed=true (kun display:none) så Mermaid-SVG
        og al React-state bevares. MermaidBlocks ResizeObserver ignorerer width=0.
      */}
      <div
        aria-hidden={collapsed}
        className={cn(
          "flex-1 overflow-y-auto p-6 transition-opacity duration-200 ease-out",
          collapsed && "pointer-events-none opacity-0",
        )}
        style={{ minWidth: expandedWidth - 1 }}
      >
        {content ? (
          <figure className="aurora-figure">
            {/* Mermaid Diagrams */}
            {diagrams.length > 0 && (
              <div className="mb-6 space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Diagrams
                </h3>
                {diagrams.map((d, i) => (
                  <div key={i} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 overflow-auto">
                    <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono">{d}</pre>
                    <div className="mt-2 text-xs text-zinc-500 italic">
                      Mermaid diagram {i + 1} — render with Mermaid.js for visualization
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="aurora-canvas-toolbar">
              <div className="flex items-center gap-2">
                <span className="chip">Process Insight</span>
                <span className="title">Aurora · auto-layout</span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                snap · 8px grid
              </span>
            </div>
            <MessageContent text={content} layout="canvas" />
            <figcaption>Aurora artifact · normaliseret visning</figcaption>
          </figure>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            <div>
              <Layers className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <p>Canvas viser seneste artifact fra Aurora.</p>
              <p className="mt-1 text-xs">Send en besked for at se output her.</p>
            </div>
          </div>
        )}
      </div>

      <div
        aria-hidden={collapsed}
        className={cn(
          "border-t border-border/60 px-4 py-2 text-xs text-muted-foreground transition-opacity duration-200 ease-out",
          collapsed && "pointer-events-none opacity-0",
        )}
      >
        Strategic zoom · Layer management · WidgeTDC governance
      </div>
    </aside>
  );
}
