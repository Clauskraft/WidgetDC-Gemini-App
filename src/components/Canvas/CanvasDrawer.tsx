/**
 * GF-PR3: THE one canvas (P2 — the answer's shadow).
 *
 * Drawer mechanics (resize handle, width persistence, collapse-to-rail,
 * keep-mounted body) are carried over from CanvasPanel. What changed:
 *  - Content renders the FULL focused message through MessageContent — the
 *    same pipeline as the chat, so mermaid becomes SVG and graph blocks get
 *    their built-in zoom/selection. (CanvasPanel stripped mermaid fences and
 *    showed raw code — that bug dies here.)
 *  - A "‹ n/m ›" pager moves between the thread's structured answers.
 *  - State lives in CanvasProvider (route-agnostic slot in __root); chat
 *    auto-opens it via the canvasTrigger contract.
 *  - Decorative Zoom/Pin no-ops and the auto-layout toolbar chrome are gone.
 */
import type { UIMessage } from "ai";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  Layers,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageContent } from "@/components/MessageContent";
import { useCanvas } from "@/lib/canvas-context";
import { shouldAutoOpenCanvas } from "@/lib/canvasTrigger";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "aurora.canvas.width";
const COLLAPSED_KEY = "aurora.canvas.collapsed";
const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 320;
const COLLAPSED_WIDTH = 44;

function getText(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

export function latestStructuredMessage(messages: UIMessage[]): UIMessage | null {
  return (
    [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && shouldAutoOpenCanvas(getText(m))) ?? null
  );
}

function clampWidth(n: number): number {
  if (typeof window === "undefined") return Math.max(MIN_WIDTH, n);
  const max = Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.9));
  return Math.min(max, Math.max(MIN_WIDTH, n));
}

/** Pure presentational half — SSR-testable without a provider. */
export function CanvasDrawerView({
  messages,
  focusedMessageId,
  onClose,
  onFocusMessage,
}: {
  messages: UIMessage[];
  focusedMessageId: string | null;
  onClose: () => void;
  onFocusMessage: (id: string) => void;
}) {
  const structured = useMemo(
    () => messages.filter((m) => m.role === "assistant" && shouldAutoOpenCanvas(getText(m))),
    [messages],
  );
  const focused =
    structured.find((m) => m.id === focusedMessageId) ?? structured[structured.length - 1] ?? null;
  const focusedIndex = focused ? structured.findIndex((m) => m.id === focused.id) : -1;

  const [expandedWidth, setExpandedWidth] = useState<number>(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n >= MIN_WIDTH) setExpandedWidth(clampWidth(n));
    setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

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
    const onMove = (clientX: number) =>
      setExpandedWidth(clampWidth(startWidth + (startX - clientX)));
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
  const effectiveWidth = collapsed ? COLLAPSED_WIDTH : expandedWidth;

  // The canvas-grid gives prose blocks fixed row-spans, so the first figure
  // can start below the fold — an auto-opened canvas would show only empty
  // stage. Bring the focused answer's first figure into view instead.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const focusedId = focused?.id ?? null;
  useEffect(() => {
    if (!focusedId || !bodyRef.current) return;
    const body = bodyRef.current;
    const raf = requestAnimationFrame(() => {
      const figure = body.querySelector(".aurora-figure");
      if (figure) figure.scrollIntoView({ block: "start" });
      else body.scrollTop = 0;
    });
    return () => cancelAnimationFrame(raf);
  }, [focusedId]);

  return (
    <aside
      data-testid="canvas-drawer"
      data-collapsed={collapsed ? "true" : "false"}
      aria-expanded={!collapsed}
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex h-screen w-full flex-col overflow-hidden border-l border-border bg-card shadow-2xl md:static md:z-auto md:shadow-none",
        !dragging && "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
      )}
      style={{
        width:
          typeof window !== "undefined" && window.innerWidth >= 768 ? effectiveWidth : undefined,
        maxWidth: "100vw",
      }}
    >
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
            <div className="flex min-w-0 items-center gap-2">
              <Layers className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-medium">Canvas</span>
            </div>
            <div className="flex items-center gap-1">
              {structured.length > 1 && focusedIndex >= 0 ? (
                <div className="mr-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <button
                    type="button"
                    aria-label="Forrige artifact"
                    disabled={focusedIndex === 0}
                    onClick={() => onFocusMessage(structured[focusedIndex - 1].id)}
                    className="rounded-md p-1 hover:bg-accent disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span>
                    {focusedIndex + 1}/{structured.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Næste artifact"
                    disabled={focusedIndex === structured.length - 1}
                    onClick={() => onFocusMessage(structured[focusedIndex + 1].id)}
                    className="rounded-md p-1 hover:bg-accent disabled:opacity-30"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                title="Luk canvas"
                aria-label="Luk canvas"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {collapsed && <Layers className="h-4 w-4 text-primary" />}
      </div>

      {/* Body stays MOUNTED when collapsed (display-only hide) so Mermaid SVG
          and graph state survive; ResizeObserver ignores width 0. */}
      <div
        ref={bodyRef}
        aria-hidden={collapsed}
        className={cn(
          "flex-1 overflow-y-auto p-6 transition-opacity duration-200 ease-out",
          collapsed && "pointer-events-none opacity-0",
        )}
        style={{ minWidth: expandedWidth - 1 }}
      >
        {focused ? (
          <MessageContent text={getText(focused)} layout="canvas" />
        ) : (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            <div>
              <Layers className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <p>Canvas åbner når et svar bærer struktur.</p>
              <p className="mt-1 text-xs">Bed om et diagram, en graf eller en tabel.</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

/** Wired half: renders the drawer only when the canvas is open. */
export function CanvasSlot() {
  const canvas = useCanvas();
  if (!canvas.open) return null;
  return (
    <CanvasDrawerView
      messages={canvas.messages}
      focusedMessageId={canvas.focusedMessageId}
      onClose={() => canvas.closeCanvas(true)}
      onFocusMessage={canvas.setFocusedMessageId}
    />
  );
}
