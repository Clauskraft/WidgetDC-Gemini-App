/**
 * The one app header (GF-PR1). Slim, calm, identical on every page:
 * current page title · active engagement scope · canvas toggle · ⌘K.
 *
 * TopBarView is the pure presentational half (SSR-testable without a router);
 * TopBar wires it to the live route. The canvas toggle ships DISABLED with an
 * honest explanation until the unified canvas lands (GF-PR3) — a visibly
 * disabled control is not a dead click; a fake link is.
 */
import { Command, PanelRight } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { useCanvas } from "@/lib/canvas-context";
import { useActiveEngagement } from "@/lib/engagement-context";
import { pageTitleFor } from "@/lib/navigation";

export function TopBarView({
  title,
  scopeLabel,
  canvasEnabled = false,
  onToggleCanvas,
  onOpenPalette,
}: {
  title: string;
  scopeLabel?: string | null;
  canvasEnabled?: boolean;
  onToggleCanvas?: () => void;
  onOpenPalette?: () => void;
}) {
  return (
    <header
      role="banner"
      data-testid="top-bar"
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4"
    >
      <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight">{title}</h1>
      {scopeLabel ? (
        <span className="hidden truncate rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground sm:inline">
          {scopeLabel}
        </span>
      ) : null}
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          data-testid="canvas-toggle"
          disabled={!canvasEnabled}
          onClick={onToggleCanvas}
          title={canvasEnabled ? "Toggle canvas" : "Opens with structured answers"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition enabled:hover:bg-accent enabled:hover:text-foreground disabled:opacity-40"
        >
          <PanelRight className="h-3.5 w-3.5" />
          Canvas
        </button>
        <button
          type="button"
          data-testid="command-palette-trigger"
          onClick={onOpenPalette}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <Command className="h-3.5 w-3.5" />
          <span aria-hidden>⌘K</span>
          <span className="sr-only">Open command palette</span>
        </button>
      </div>
    </header>
  );
}

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { activeEngagement } = useActiveEngagement();
  const canvas = useCanvas();
  // GF-PR3: the toggle is live once the thread has anything canvas-worthy
  // (or the canvas is already open, so it can always be closed from here).
  const canvasEnabled = canvas.open || canvas.messages.length > 0;
  const openPalette = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  };
  return (
    <TopBarView
      title={pageTitleFor(pathname)}
      scopeLabel={activeEngagement ? activeEngagement.name : null}
      canvasEnabled={canvasEnabled}
      onToggleCanvas={() => (canvas.open ? canvas.closeCanvas(true) : canvas.openCanvas())}
      onOpenPalette={openPalette}
    />
  );
}
