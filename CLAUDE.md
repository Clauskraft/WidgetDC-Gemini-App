# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Run the dev server (`tsx server.ts`). Express serves the API/BFF routes and mounts Vite as middleware (SPA, HMR). This is the single process for local development; there is no separate frontend dev server.
- `npm run build` — Two-stage build: `vite build` emits the SPA to `dist/`, then `esbuild` bundles `server.ts` into `dist/server.cjs` (CJS, Node platform, external packages).
- `npm start` — Production: `node dist/server.cjs`. Requires `NODE_ENV=production` so Express serves static `dist/` instead of Vite.
- `npm run lint` — Type-check only (`tsc --noEmit`). There is no ESLint and no Jest/Vitest test runner.
- Node `>=22` and npm `>=10` are required (enforced in `package.json` engines; Railway pins via `nixpacks.toml`).

There is no automated test suite. `scripts/smoke/*.cjs` are **manual** endpoint smoke scripts (run individually with `node`), explicitly not part of CI and not type-checked by the app runtime.

## Architecture

This is a single-process full-stack app: **Express acts as a Backend-for-Frontend (BFF)** that owns all secrets and proxies to the WidgeTDC platform and the configured server-side model provider. The React SPA never holds API keys or talks to backends directly — it only calls server-relative routes.

### The two processes are one
`server.ts` is the entry point for both dev and prod. In dev it creates a Vite middleware server; in prod (`NODE_ENV=production`) it serves the prebuilt `dist/`. All `/api/*`, `/auth/*`, and `/health` routes live in `server.ts` and run identically in both modes.

### Server routes (`server.ts`)
- `/api/chat` — Server-side chat proxy. Provider keys are **server-only**; they must never reach the bundle. Requires an `mcp_token` cookie unless `ALLOW_DEV_AUTH_BYPASS=true`.
- `/api/widgetdc/route` — The core agentic router. Forwards a `{ tool, payload }` to the WidgeTDC backend (`/api/mcp/route`) using `MCP_AGENT_API_KEY`. Its behavior is layered (see below).
- `/api/mcp/proxy` — Raw JSON-RPC pass-through to the MCP server, authed via the `mcp_token` cookie.
- `/auth/simple`, `/auth/token`, `/auth/callback`, `/auth/status` — Auth flows that set an httpOnly `mcp_token` cookie. `test/test` and `admin/admin` are hardcoded dev shortcuts.
- `/api/threads` (GET/POST) — Chat thread persistence. Uses Supabase if `SUPABASE_URL`/`SUPABASE_ANON_KEY` are set, otherwise an **in-memory volatile** array (lost on restart).

### `/api/widgetdc/route` routing layers (read this before touching it)
The route resolves a request through a priority cascade — understanding the order is essential:
1. **Read-only UI tool remapping** (`mapReadOnlyUiTool`): certain UI tool names (`graph.integrity_check`, `graph.get_lineage`, `eventspine.replay`, `workflow_cost_trace`) are rewritten to safe read-only Cypher/calls or resolved entirely locally. These never mutate state and are tagged `risk_level: read_only`.
2. **Enabled-tools agentic chain** (when `payload.enabled_tools` is non-empty): runs a fixed sequence — health → `intent_detect` → optional `srag.query` (@NotebookLM) / `kg_rag.query` (@GraphRAG) → `reason_deeply`. Grounding sources are appended for display.
3. **Intent-gated routing**: `intent_detect` runs as a mandatory gate; if the top candidate scores `>= 1.0`, the query routes to that tool. Some tools (`flow-develop`, `emit_sonar_pulse`, `skill-tdd`, `platform.get_dashboard_data`) are **locally mocked** because the MCP backend lacks them — see the `missingTools` list and `MOCK_RLM_DIAGRAM`.
4. **Configured model fallback**: if no high-confidence route exists, uses `RUNTIME_MODEL` / `GENERATIVE_MODEL` when configured. If no model is configured or the provider fails, it returns local synthesis or the deep-reasoning plan rather than erroring.

When editing this route, preserve the early-return-on-success pattern and the graceful-degradation chain (tool failure falls back to reasoning, reasoning falls back to a returned plan).

### Frontend (`src/`)
- `src/api/widgetdcClient.ts` — The only network layer. All fetches use `credentials: 'include'` for the cookie. `isStaticPreviewHost()` detects GitHub Pages / `file:` hosting and short-circuits to a "static preview" mode where the BFF is assumed unreachable.
- `src/App.tsx` — Single stateful shell; switches between canvas modes (`mission`, `chat`, `phantom`, `events`, `claims`, `connectors`). Tracks `serverReachable` to gate live vs. preview behavior.
- `src/data/mockData.ts` — **Most dashboard/panel data is static mock data** representing May 2026 milestones, not live analytics. Treat panels as presentation unless wired to a real endpoint.
- `@/*` import alias maps to the repo root (configured in both `tsconfig.json` and `vite.config.ts`).

### Governance model (UI-side display only)
`src/types/widgetdc.ts` and `src/utils/governance.ts` encode a risk model: `read_only` → routes through the BFF; `staged_write` / `production_write` → the UI shows a HyperAgent plan + approval requirement and refuses to execute from the browser (`canExecuteFromBrowser`). **This is UI behavior only — real enforcement must stay server-side.** Client-supplied governance context (`ui_context`) is for operator clarity and must never be trusted as authority by the server. See `docs/widgetdc-aurora/INTEGRATION.md` for the server-enforcement checklist and the browser-safety invariants (no keys in bundle, no raw `graph.write_cypher`, all actions carry a `correlation_id`).

## Conventions & invariants

- **Secrets are server-only.** `GEMINI_API_KEY`, `MCP_AGENT_API_KEY`, and `MCP_ACCESS_TOKEN` live in `server.ts`/env and must never appear in `src/` or the Vite bundle. There is no `VITE_`-prefixed key for any backend.
- **All request bodies on server routes are validated with Zod** before use — follow this pattern for new routes.
- The WidgeTDC backend and orchestrator URLs are hardcoded defaults in `server.ts` (`backend-production-d3da.up.railway.app`, `orchestrator-production-c27e.up.railway.app`) overridable via env.
- `correlation_id` (see `src/utils/ids.ts`) threads through chat messages and tool calls for traceability — preserve it on new operator actions.
- Claim-safe wording: avoid asserting "production-ready" / "proven" capabilities in UI copy or docs without runtime evidence (per `docs/widgetdc-aurora/INTEGRATION.md`).

## Deployment

Railway via Nixpacks (`railway.toml`, `nixpacks.toml`): build runs `npm run build`, start runs `npm start`, health check hits `/health` (returns `commit_sha` from `RAILWAY_GIT_COMMIT_SHA`). Production cookies are `secure` + `sameSite: none`; dev cookies are `lax`.
