/**
 * GF-PR2 · P1/P5: the ONE calm status line for the golden flow.
 *
 * Collapsed (always visible during/after a run, 32px): run-state dot+label,
 * then calm user-facing segments that appear only as REAL data arrives.
 * Internal routing names and scores stay behind the route disclosure. Click
 * expands to evidence and run detail. At most ONE contextual
 * action lives on the right edge (P5). Never a wall of panels (P1).
 */
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  isActiveChatRunState,
  type ChatRunState,
  type ChatRunStatePresentation,
} from "@/lib/chatRunState";
import { cn } from "@/lib/utils";

export type StripReasoning = {
  intentTool?: string;
  intentScore?: number;
  intentCandidates?: string[];
  provider?: string;
  model?: string;
  confidence?: number;
};

export function IntelligenceStrip({
  state,
  presentation,
  reasoning,
  sourceCount,
  canvasReady,
  action,
  defaultExpanded = false,
  onExpand,
}: {
  state: ChatRunState;
  presentation: ChatRunStatePresentation;
  reasoning: StripReasoning | null;
  sourceCount: number;
  canvasReady: boolean;
  action?: { label: string; onClick: () => void } | null;
  defaultExpanded?: boolean;
  /** Fires on each user-initiated collapse→expand (GF-PR4 receipt hook). */
  onExpand?: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const active = isActiveChatRunState(state);
  const candidates = reasoning?.intentCandidates ?? [];
  const routeCandidates =
    candidates.length > 0 ? candidates : reasoning?.intentTool ? [reasoning.intentTool] : [];
  const hasRouteDetail = routeCandidates.length > 0;
  const hasDetail = hasRouteDetail || Boolean(presentation.detail);

  return (
    <div
      data-testid="intelligence-strip"
      className="rounded-xl border border-border bg-background/80 text-xs text-muted-foreground"
    >
      <div className="flex h-8 items-center gap-2 px-3">
        <button
          type="button"
          onClick={() => {
            if (!hasDetail) return;
            if (!expanded) onExpand?.();
            setExpanded(!expanded);
          }}
          aria-expanded={expanded}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 text-left",
            hasDetail && "cursor-pointer",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              active ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/50",
            )}
          />
          <span className="shrink-0 font-medium text-foreground/80">{presentation.label}</span>
          {sourceCount > 0 ? <span className="shrink-0">· {sourceCount} kilder</span> : null}
          {canvasReady ? <span className="shrink-0 text-foreground/70">· canvas klar</span> : null}
          {hasRouteDetail ? <span className="shrink-0 text-foreground/70">· Rute</span> : null}
          {hasDetail ? (
            <ChevronDown
              className={cn("ml-1 h-3 w-3 shrink-0 transition-transform", expanded && "rotate-180")}
            />
          ) : null}
        </button>
        {action ? (
          <button
            type="button"
            data-testid="strip-action"
            onClick={action.onClick}
            className="shrink-0 rounded-lg border border-input px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-accent"
          >
            {action.label}
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-border px-3 py-2.5">
          {routeCandidates.length > 0 ? (
            <div>
              <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground/70">
                Rute
              </div>
              <ol className="space-y-0.5">
                {routeCandidates.map((tool, i) => (
                  <li key={tool} className={cn(i === 0 && "font-medium text-foreground/80")}>
                    {i + 1}. {tool}
                  </li>
                ))}
              </ol>
              {typeof reasoning?.intentScore === "number" ? (
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  Intern score: {reasoning.intentScore}
                </p>
              ) : null}
            </div>
          ) : null}
          <div>
            <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground/70">
              Kørsel
            </div>
            <p>{presentation.detail}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
