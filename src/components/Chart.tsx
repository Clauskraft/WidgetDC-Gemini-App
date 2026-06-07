import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Normaliseret chart-wrapper.
 * Wrap enhver SVG, canvas eller Recharts/visx-komponent i <Chart> for at få:
 * - automatisk axis/grid/label/legend-styling via tokens
 * - chart-1..5 paletten på tværs af temaer
 * - figur-ramme, baggrund og caption
 *
 * Brug data-series="1..5" eller class="series-N" på dine path/rect/circle for at få token-farver.
 * Recharts: serierne får automatisk chart-1..5 i rækkefølge.
 */
export type LegendItem = {
  label: string;
  /** 1-5 = brug --chart-N token. Eller giv en eksplicit CSS-farve. */
  series?: 1 | 2 | 3 | 4 | 5;
  color?: string;
};

export function Chart({
  children,
  caption,
  legend,
  legendPosition = "top",
  legendGap,
  legendSwatchSize,
  framed = true,
  className,
  style,
}: {
  children: ReactNode;
  caption?: ReactNode;
  legend?: LegendItem[];
  legendPosition?: "top" | "bottom" | "left" | "right";
  legendGap?: number;
  legendSwatchSize?: number;
  framed?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const cssVars: CSSProperties = {};
  if (legendGap !== undefined) {
    (cssVars as any)["--legend-gap"] = `${legendGap}px`;
  }
  if (legendSwatchSize !== undefined) {
    (cssVars as any)["--legend-swatch-size"] = `${legendSwatchSize}px`;
  }

  const inner = (
    <div
      data-chart={legendPosition}
      className={cn("aurora-chart", className)}
      style={{ ...cssVars, ...style }}
    >
      {legend && legend.length > 0 && (
        <div className="legend" data-legend role="list" aria-label="Forklaring">
          {legend.map((item, i) => {
            const swatch =
              item.color ?? (item.series ? `var(--chart-${item.series})` : `var(--chart-${(i % 5) + 1})`);
            return (
              <span key={i} className="legend-item" role="listitem">
                <span className="legend-swatch" style={{ background: swatch }} />
                {item.label}
              </span>
            );
          })}
        </div>
      )}
      {children}
    </div>
  );
  if (!framed) return inner;
  return (
    <figure className="aurora-figure">
      {inner}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Læs token-farver i runtime (til Recharts/visx-props som `stroke`, `fill`). */
export function getChartTokens() {
  if (typeof window === "undefined") {
    return {
      series: ["", "", "", "", ""],
      axis: "",
      grid: "",
      surface: "",
      border: "",
      foreground: "",
      muted: "",
    };
  }
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    series: [v("--chart-1"), v("--chart-2"), v("--chart-3"), v("--chart-4"), v("--chart-5")],
    axis: v("--figure-axis"),
    grid: v("--figure-grid"),
    surface: v("--figure-surface"),
    border: v("--figure-border"),
    foreground: v("--foreground"),
    muted: v("--muted-foreground"),
  };
}

export const CHART_SERIES_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;
