# WidgeTDC Aurora — Build Backlog

Prioritized backlog for what to build **on top of** the new TanStack Start
foundation (imported 2026-06-07 from "Gemini App Enhancer") and what to **fix**,
for maximum utilization of the WidgeTDC platform (orchestrator MCP + Neo4j graph,
1.58M nodes / 3.55M rels, 7.8K MCPTool nodes).

**Legend:** P0 = blocks real platform use · P1 = high leverage · P2 = polish.
Each item names the concrete platform MCP tool(s) it should call.

---

## Foundation status (done in this migration)

- ✅ Express-BFF foundation replaced by TanStack Start SSR (React 19, Vite 7,
  Tailwind v4). Old foundation preserved on `backup/express-foundation-82ea83f`.
- ✅ `npm install` green (nitro pin bumped to `3.0.260603-beta`).
- ✅ `npm run build` green (client + nitro SSR bundle).
- ✅ `npm test` green — 97/97 vitest tests.
- ✅ Secrets moved to gitignored `.env`; `.env.example` rewritten (old file
  leaked a real-looking `MCP_ACCESS_TOKEN` — now removed).

---

## Intelligence-stack reflection (2026-06-07)

This backlog was pressure-tested through the WidgeTDC intelligence stack:
`reason_deeply` (sequencing), `next_best_action` (pattern: *Adoption Flywheel*),
`rag_route` (orchestrator wire-facts), and `moa_query` (master + omega + custodian,
confidence 0.85). Key adjustments folded in below: **chat stays client-side
streamed** (AUR-1), and **graph responses are never SSR-cached** (AUR-2). The
orchestrator MCP wire-contract is `POST .../api/mcp/route` with body
`{ tool, payload }` and `Authorization: Bearer <key>`; RAG channels are
`graphrag · srag · cypher`. Full synthesis stored in agent memory
(`widgetdc-aurora-app/intelligence-stack-synthesis-2026-06-07`).

---

## P0 — Connect chat & graph to the live platform

### AUR-1 — Route chat through the WidgetDC orchestrator (WidgetDC-first LLM)
**Why:** `src/routes/api/chat.ts` streams via the Lovable AI Gateway, bypassing
the platform's model policy, budget preflight, and RAG cascade.
**Build:** A server-side `chat.server.ts` that, per request:
1. `model_policy_check` + `model_budget_preflight_status` → gate/cost guard.
2. `model_route` (or `llm_chat`) → provider/model selection by the configured
   ConfiguratorEngine instead of a hardcoded `google/gemini-3-flash-preview`.
3. For knowledge-grounded turns, `rag_route` → `adaptive_rag_query` /
   `knowledge_query` (Hybrid RAG cascade) and append grounding sources.
4. Fall back to the Lovable Gateway only if the platform is unreachable.
Preserve streaming (`toUIMessageStreamResponse`) and thread a `correlation_id`
through every call (`src/lib/` helper).
**⚠ Intelligence-stack note (MoA, conf 0.85):** Keep the chat stream
**client-side** (the existing `@ai-sdk/react` hook over `fetch`), with the server
route a thin proxy that opens the upstream stream and pipes it through. Do **not**
push token streaming through SSR `requestMiddleware` — that path risks hydration
mismatches and stream-state loss. SSR stays scoped to the page shell.
**Tools:** `model_route`, `model_policy_check`, `model_budget_preflight_status`,
`llm_chat`, `rag_route`, `adaptive_rag_query`, `knowledge_query`.

### AUR-2 — Live Neo4j knowledge graph behind GraphBlock / visual.graph
**Why:** `GraphBlock` / `KnowledgeGraphBlock` render static figure specs only.
**Build:** A read-only `api/graph.query.ts` server route that runs vetted,
parameterized read Cypher via the platform and maps results to `GraphSpec` /
`KnowledgeGraphSpec`. Drive a real "Explore the graph" view from `query_graph`
(node/rel counts, lineage, communities). **Read-only only** — no write Cypher
from the browser (governance invariant).
**⚠ Intelligence-stack note (MoA, conf 0.85):** Do **not** SSR-cache or
pre-render graph responses — graph results are user/session-scoped and may carry
node-level ACLs; a cached SSR page can leak data the user shouldn't see. Enforce
ACLs at the orchestrator, fetch per-request, never behind a shared cache.
**Tools:** `query_graph`, `data_graph_read`, `data_graph_stats`,
`build_communities`, `decision_lineage`.

### AUR-3 — Wire the canvas resolver to the platform `canvas_builder`
**Why:** `api/mrp.canvas.resolve.ts` resolves intent + signs a token locally but
never calls the platform; FlowSpecs aren't persisted or graph-derived.
**Build:** After local `detectIntent`, call platform `canvas_builder` (and
`intent_detect`) so the family/standard decision is the platform's, and allow a
FlowSpec to be hydrated from `query_graph`. Keep the HMAC embed-token contract.
**Tools:** `canvas_builder`, `intent_detect`, `query_graph`.

---

## P1 — High-leverage platform features

### AUR-4 — Governance plan + approval flow (staged/production writes)
**Why:** Governance is currently UI-display only; there is no real plan/approve
path for mutating actions.
**Build:** A "HyperAgent plan" surface: when a chat turn implies a write, call
`governance_plan_create` → show plan + risk → `governance_plan_approve`
(human-in-the-loop) → `governance_plan_execute` server-side. Browser never
executes writes directly. Show `governance_matrix` / `governance_policy_decide`
results inline.
**Tools:** `governance_plan_create/approve/evaluate/execute`,
`governance_policy_decide`, `governance_matrix`, `agentic_hitl_escalate`.

### AUR-5 — Deep-reasoning & verification mode in chat
**Why:** Long/strategic queries deserve the platform's reasoning stack, not a
single LLM pass.
**Build:** A "Reason deeply" toggle that routes to `reason_deeply`, then
`verify_output` / `judge_response` / `critique_refine` before display; show the
reasoning plan as pinnable Canvas notes.
**Tools:** `reason_deeply`, `verify_output`, `judge_response`, `critique_refine`,
`next_best_action`.

### AUR-6 — Agent memory persistence (cross-session continuity)
**Why:** Threads persist in Supabase, but no agent memory / lessons feed the
platform flywheel.
**Build:** On meaningful turns, `memory_store` insights/closures; on session
start, `memory_search` / `memory_retrieve` to hydrate context. Surface a
"Memory" panel.
**Tools:** `memory_store`, `memory_search`, `memory_retrieve`,
`memory_consolidate`.

### AUR-7 — Deploy target decision (Cloudflare vs Railway) + CI
**Why:** Old Railway/Nixpacks config was removed; nitro currently defaults to a
Cloudflare target. Need one deterministic prod path + health check.
**Build:** Decide Cloudflare Workers (matches nitro default, per-request env) vs
Railway node-server preset. Add a `/health` route returning `commit_sha`. Wire
`.github/workflows/e2e.yml` to run vitest + build on PR. Optionally use
`railway_deploy` / `railway_env` platform tools for env sync.
**Tools (optional):** `railway_deploy`, `railway_env`, `get_platform_health`.

### AUR-8 — Platform health & live dashboard data
**Why:** `dashboard.tsx` is local-only (threads/gems). The old app's "live vs
preview" gating is gone.
**Build:** A `serverReachable`-style probe via `get_platform_health` +
`system_metrics_summary`; show real platform/service status and (read-only)
`tool_metrics` / `flywheel_metrics` cards.
**Tools:** `get_platform_health`, `system_metrics_summary`, `tool_metrics`,
`flywheel_metrics`, `runtime_summary`.

---

## P2 — Polish, safety, hardening

### AUR-9 — Auth hardening
Supabase publishable key + URL currently live in `.env` (and were committed in
the source `.env`). **Rotate the Supabase anon key**, confirm RLS on the
`threads` table, and verify `auth-middleware` enforces ownership server-side.

### AUR-10 — Embed/bridge origin allow-list for production
`isAllowedOrigin` defaults must be tightened for prod (no `*`). Set the canvas
embed origin allow-list from env and keep `docs/mcp-bridge-origins.md` accurate.

### AUR-11 — `CANVAS_SIGNING_SECRET` must be set in prod
The token signer falls back to `LOVABLE_API_KEY` then a dev default. Make a real
`CANVAS_SIGNING_SECRET` required in production (fail-fast if missing).

### AUR-12 — Observability: ship structured logs to the platform
`src/lib/server-logger.ts` logs locally. Forward error/audit events to
`system_logs_summary` / the EventSpine so platform governance can correlate.
**Tools:** `eventspine_replay`, `governance_audit_query`, `system_logs_summary`.

### AUR-13 — Recharts v3 migration
`recharts@2.15.4` is EOL (deprecation warning on install). Plan the v3 migration
for `src/components/Chart.tsx` + `ui/chart.tsx`.

### AUR-14 — Drop the `@types/dompurify` stub
dompurify now ships its own types; remove the redundant `@types/dompurify`
devDependency.

---

## Cross-cutting invariants (enforce on every item above)

1. **No secrets in the bundle.** `process.env` reads inside handlers; `.server.ts`
   for node-only code; only Supabase anon key behind `VITE_*`.
2. **Read-only from the browser.** All writes/mutations go through a
   governance-gated server path; no raw write Cypher client-side.
3. **Never SSR-cache user/session-scoped platform data** (graph, RAG, chat).
   Fetch per-request; ACL enforcement lives at the orchestrator, not in an SSR
   cache. (MoA governance finding, 2026-06-07.)
4. **Zod-validate every server request body.**
5. **Thread a `correlation_id`** through chat → tool calls → memory for audit.
6. **Claim-safe wording** in UI/docs — no unproven "production-ready" claims.
