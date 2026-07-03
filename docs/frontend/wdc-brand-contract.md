# WDC Brand Contract

## Canonical Logo

- Asset path: `public/wdc-logo.png`
- Runtime URL: `/wdc-logo.png`
- Source: operator-provided Codex clipboard image, 2026-07-03
- Dimensions: `46x76`
- SHA-256: `412c94897ceb8a364651c326bf294e938d63f12c6f7dfdbdebbae516de4191a3`

This image is the canonical WDC logo for the Gemini App frontend until a later
brand-governed asset replacement is explicitly approved.

## Code Surface

- Brand constants: `src/lib/wdcBrand.ts`
- React component: `src/components/WdcLogo.tsx`

The component intentionally renders the logo from the public asset path instead
of inlining SVG or base64 data. This keeps future asset replacement simple and
keeps provenance explicit.

## Invariants

- The frontend may read and render the logo.
- The frontend may not mutate graph data from this brand contract.
- The frontend may not promote claims from this brand contract.
- The frontend may not infer runtime proof from this asset.
- Any replacement logo must update the SHA-256 and source fields.

## Usage Pattern

```tsx
import { WdcLogo } from "./components/WdcLogo";

export function HeaderBrand() {
  return <WdcLogo size="md" showWordmark />;
}
```

## Acceptance Gate

- Logo renders from `/wdc-logo.png`.
- Any UI using it references `WdcLogo` or `wdcBrand.logo.src`.
- No user-facing copy claims runtime proof, deployment, claim promotion, or graph
  state because of this asset.
