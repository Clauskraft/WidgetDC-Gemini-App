import { wdcBrand } from "../lib/wdcBrand";

export type WdcLogoSize = "sm" | "md" | "lg";

export type WdcLogoProps = {
  size?: WdcLogoSize;
  label?: string;
  showWordmark?: boolean;
  className?: string;
};

const logoDimensions: Record<WdcLogoSize, { width: number; height: number }> = {
  sm: { width: 18, height: 30 },
  md: { width: 23, height: 38 },
  lg: { width: 46, height: 76 },
};

export function WdcLogo({
  size = "md",
  label = "WidgeTDC",
  showWordmark = false,
  className = "",
}: WdcLogoProps) {
  const dimensions = logoDimensions[size];
  const classes = ["inline-flex items-center gap-2 text-current", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span aria-label={label} className={classes} title={label}>
      <img
        aria-hidden="true"
        alt=""
        className="shrink-0 object-contain"
        height={dimensions.height}
        src={wdcBrand.logo.src}
        width={dimensions.width}
      />
      {showWordmark ? (
        <span className="text-xs font-semibold uppercase tracking-[0.2em]">
          {wdcBrand.shortName}
        </span>
      ) : null}
    </span>
  );
}

export default WdcLogo;
