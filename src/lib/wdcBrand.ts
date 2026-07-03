export const wdcBrand = {
  name: "WidgeTDC",
  shortName: "WDC",
  logo: {
    src: "/wdc-logo.png",
    width: 46,
    height: 76,
    sha256: "412c94897ceb8a364651c326bf294e938d63f12c6f7dfdbdebbae516de4191a3",
    source: "operator-provided-codex-clipboard-2026-07-03",
    purpose: "Canonical WDC logo for frontend surfaces.",
  },
  colors: {
    ink: "#f5f3ed",
    graphite: "#141414",
    signal: "#8a8f98",
    ember: "#ffb86b",
  },
  integrity: {
    mutationPolicy: "frontend_asset_only",
    graphWriteAllowed: false,
    railwayMutationAllowed: false,
    claimPromotionAllowed: false,
  },
} as const;

export type WdcBrand = typeof wdcBrand;
