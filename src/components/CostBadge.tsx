import { cn } from "@/lib/utils";

const R = 10;
const CIRC = 2 * Math.PI * R; // ~62.83

function colorClass(pct: number) {
  if (pct > 50) return "text-emerald-500";
  if (pct > 20) return "text-amber-500";
  return "text-red-500";
}

function strokeColor(pct: number) {
  if (pct > 50) return "oklch(72% 0.19 160)";
  if (pct > 20) return "oklch(78% 0.17 70)";
  return "oklch(63% 0.22 25)";
}

export function CostBadge({
  pct,
  usedDKK,
  compact = false,
  className,
}: {
  pct: number;
  usedDKK: number;
  compact?: boolean;
  className?: string;
}) {
  const clampedPct = Math.max(0, Math.min(100, pct));
  const offset = CIRC * (1 - clampedPct / 100);

  return (
    <span
      className={cn("inline-flex items-center gap-1", colorClass(clampedPct), className)}
      title={`Budget: ${clampedPct.toFixed(0)}% tilbage · ${usedDKK.toFixed(2)} DKK brugt`}
    >
      <svg
        width={compact ? 20 : 24}
        height={compact ? 20 : 24}
        viewBox="0 0 24 24"
        fill="none"
        className="shrink-0 -rotate-90"
      >
        <circle
          cx="12"
          cy="12"
          r={R}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth="2.5"
        />
        <circle
          cx="12"
          cy="12"
          r={R}
          stroke={strokeColor(clampedPct)}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      {compact ? (
        <span className="text-[11px] tabular-nums font-medium">{clampedPct.toFixed(0)}%</span>
      ) : (
        <span className="text-xs tabular-nums">
          <span className="font-medium">{usedDKK.toFixed(2)}</span>
          <span className="text-muted-foreground"> DKK / dag</span>
        </span>
      )}
    </span>
  );
}
