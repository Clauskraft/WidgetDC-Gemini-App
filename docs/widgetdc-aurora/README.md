# WidgeTDC Aurora Frontend

A governed React/Vite frontend package that combines the existing `WidgetDC-Gemini-App` shape with the uploaded Stitch/Lumina design system and WidgeTDC control-plane rules.

## What this contains

- **Mission Control** for runtime truth, service posture, tool surface and claim holds.
- **Captain Chat** that calls the existing server-side `/api/chat` route.
- **Governed Tool Surface** with read-only execution and structured rejection guidance for staged/prod writes.
- **EventSpine Timeline** with `correlation_id`-first event replay UI.
- **Phantom BOM View** with BOMItems, WorkArtifact linkage and PRODUCES coverage guardrails.
- **Claims Registry View** that keeps claim maturity evidence-gated.
- **Connectors View** for Neural Bridge / Backend MCP / HyperAgent / EventSpine / Neo4j / Postgres posture.

## Architecture decision

This is a thin frontend. It is not a policy engine, secret store, raw graph shell or admin bypass.

```text
Browser UI
  ↓
Existing Express BFF routes
  ↓
Governed Backend MCP / Orchestrator / Neural Bridge
  ↓
HyperAgent / EventSpine / typed graph promotion
```

Safe reads can be started from the UI. Staged and production writes are blocked in the browser and rendered as a required HyperAgent path.

## Expected existing backend routes

The package expects the same route family used by the Gemini app:

```text
GET  /auth/status
POST /api/chat
POST /api/widgetdc/route
POST /api/mcp/proxy
```

If the app is run as a standalone static Vite preview, the UI will show fallback guidance instead of failing hard.

## Install in `WidgetDC-Gemini-App`

Copy this package into the existing repo or replace the current frontend source while preserving `server.ts`.

```bash
npm install
npm run dev
```

For production build:

```bash
npm run build
npm start
```

## Environment posture

Server-side only:

```bash
GEMINI_API_KEY=...
MCP_AGENT_API_KEY=...
```

Do not expose those as `VITE_*` browser variables. The browser must not ship real MCP or Gemini credentials.

## Governance behavior

- `read_only` tools can be routed through the server-side proxy.
- `staged_write` tools display a HyperAgent plan + approval requirement.
- `production_write` tools display a HyperAgent plan + approval + policy profile + durable EventSpine requirement.
- Raw `graph.write_cypher` is not provided as a browser action.
- Typed lineage/promotion actions must be performed server-side through governed tools.

## Files

```text
src/App.tsx                         Workspace router and governed interaction logic
src/api/widgetdcClient.ts            BFF clients for chat/MCP/tool routing
src/data/mockData.ts                 UI-safe demo data and tool metadata
src/types/widgetdc.ts                Shared UI governance/data types
src/components/*                     Mission, chat, governance, claims, events, Phantom BOM
src/styles.css                       Lumina Aurora-inspired visual system
```

## Integration notes

See `docs/INTEGRATION.md` for a source map and implementation checklist.
