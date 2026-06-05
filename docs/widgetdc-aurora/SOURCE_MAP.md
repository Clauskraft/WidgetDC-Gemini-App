# Source Map

## GitHub application base

The frontend is intended to sit on top of the existing runtime-app full-stack shape:

```text
React + Vite frontend
Express server/BFF
Runtime chat route
WidgeTDC MCP route/proxy
```

The UI calls only server-relative routes and assumes the Express process owns secrets and backend authentication.

## Uploaded Stitch design system

The uploaded design system contributed these UI primitives:

```text
Lumina Aurora visual language
- deep charcoal surfaces
- aurora cyan/lavender/pink gradient accents
- Inter + JetBrains Mono typography
- glassmorphism and tonal layering
- fixed sidebar + chat/canvas split
- mission-control dashboard panels
- connector integration panels
- Phantom BOM deep-dive panels
```

Applied files:

```text
src/styles.css
src/components/TopBar.tsx
src/components/LeftRail.tsx
src/components/MissionControl.tsx
src/components/ChatPanel.tsx
src/components/CanvasView.tsx
src/components/ConnectorsPanel.tsx
src/components/PhantomBomPanel.tsx
```

## WidgeTDC governance model

The package implements governance as UI behavior only. Enforcement stays server-side.

```text
read_only        → route through server proxy
staged_write     → show HyperAgent plan + approval requirement
production_write → show plan + approval + policy profile + durable EventSpine requirement
```

No browser action mutates canonical graph truth. The UI displays typed graph promotion paths, not raw Cypher.
