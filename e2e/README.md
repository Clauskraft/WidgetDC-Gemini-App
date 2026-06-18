# Visuelle snapshots

Playwright-suiter der renderer centrale visualiseringer på isolerede harness-routes
og snapshotter både normal- og fuldskærms-layout. Bruges som visuel regression-net:
ændrer en commit nodepositioner, edge-styling, farver eller toolbar, fanges det her
før det rammer brugerne.

## Kør lokalt

```bash
bun run test:e2e:install      # 1. gang: hent Chromium
bun run test:e2e              # kør snapshot-diff
bun run test:e2e:update       # opdater baselines bevidst
```

Webserver startes automatisk (`vite dev --strictPort` på port 4173). Production
SSR dækkes separat af `npm run build`.
Sæt `PW_NO_SERVER=1` hvis du allerede har en server kørende på `PW_BASE_URL`.

## Suiter

### graph.spec.ts → `/visual/graph?case=<id>&fs=<0|1>`

Dækker `GraphBlock`, `KnowledgeGraphBlock` og `GraphErrorBlock` med
deterministiske fixtures (ingen tilfældighed, ingen netværk).

| case        | formål                                                    |
| ----------- | --------------------------------------------------------- |
| `linear`    | Lineær 4-node pipeline — basis-layout for layered graph   |
| `branching` | Router der fan-outter til 3 agents — flere edges per node |
| `knowledge` | KnowledgeGraph med blandede `type`-farver                 |
| `invalid`   | Ugyldigt spec → `GraphErrorBlock` (fejl-UX regression)    |

Hver case snapshottes både `normal` (880px stage) og `fullscreen` (1280px).

## Determinisme

Harness'en injicerer global CSS der dræber animationer/transitions og tvinger
toolbar-opacity til 1. Playwright sætter `animations: "disabled"` og en lille
`maxDiffPixelRatio` så anti-aliasing-forskelle ikke fælder testen. Layout i
`GraphCanvas` er rent deterministisk (ingen `Math.random`, ingen async layout).
