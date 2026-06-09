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
`reason_deeply` (sequencing), `next_best_action` (pattern: _Adoption Flywheel_),
`rag_route` (orchestrator wire-facts), and `moa_query` (master + omega + custodian,
confidence 0.85). Key adjustments folded in below: **chat stays client-side
streamed** (AUR-1), and **graph responses are never SSR-cached** (AUR-2). The
orchestrator MCP wire-contract is `POST .../api/mcp/route` with body
`{ tool, payload }` and `Authorization: Bearer <key>`; RAG channels are
`graphrag · srag · cypher`. Full synthesis stored in agent memory
(`widgetdc-aurora-app/intelligence-stack-synthesis-2026-06-07`).

---

## ▶ NEXT BATCH (chosen 2026-06-07 via intelligence stack)

**AUR-2 (live read-only Neo4j graph) → then AUR-5 (deep-reasoning/verify mode).**

Chosen by `reason_deeply` + a counter-argument pass (MoA was non-responsive this
round). Rationale: both deliver immediate, user-visible value at low risk and
deepen platform utilization. **AUR-4 (governance plan/approve HITL) is explicitly
deferred** — the frontend is read/reason-only today, so there are no write
operations to govern; pulling AUR-4 forward would be premature write-enforcement
overhead. Revisit AUR-4 the moment a real write feature lands.

1. **AUR-2** — `api/graph.query.ts` (read-only `query_graph` → `GraphSpec`),
   drive an "Explore the graph" view. Immediate visible value, lowest risk.
2. **AUR-5** — "Reason deeply" chat toggle → `reason_deeply` then
   `verify_output` / `judge_response`; render the reasoning chain as pinnable
   Canvas notes.

---

## P0 — Connect chat & graph to the live platform

### AUR-1 — Route chat through the WidgetDC orchestrator ✅ DONE (2026-06-07)

**Done:** Lovable AI Gateway fully removed (`@ai-sdk/openai-compatible` dropped,
`ai-gateway.server.ts` deleted). `src/routes/api/chat.ts` now calls the WidgeTDC
orchestrator: `rag_route` for grounding + `llm_chat` for completion, via
`src/lib/widgetdc.server.ts` (MCP `{tool,payload}` + Bearer). The non-streaming
orchestrator answer is wrapped in an AI-SDK UI message stream
(`createUIMessageStream`) so the `useChat` client renders it unchanged.
`correlation_id` threaded through. Requires `WIDGETDC_API_KEY`/`MCP_AGENT_API_KEY`.
**Follow-ups (P1):** add `model_policy_check` + `model_budget_preflight_status`
preflight and `model_route`-driven provider selection (currently provider is
inferred from the UI model id).
**Tools:** `llm_chat`, `rag_route` (done); `model_route`, `model_policy_check`,
`model_budget_preflight_status`, `adaptive_rag_query`, `knowledge_query` (follow-up).

### AUR-2 — Live Neo4j knowledge graph ✅ DONE (2026-06-07)

**Done:** `api/graph.query.ts` server route — **whitelisted named queries only**
(`label-overview`, `sample-subgraph`, `neighbors`; `neighbors` seed label is
allow-listed), no raw Cypher from the browser (governance invariant held). Runs
via the platform **`data_graph_read`** tool (NOTE: `query_graph` is NOT exposed
on the backend MCP route — only `data_graph_read` is). `queryGraph()` in
`widgetdc.server.ts` normalizes Neo4j `{low,high}` ints. New `/graph` route
(sidebar nav) renders results through the existing `GraphBlock` /
`KnowledgeGraphBlock`; fetched per-request, never SSR-cached (MoA ACL finding).
**Verified live:** all 3 views return real Neo4j data (ReasonStep 209K,
AgentMemory 204K, :Agent neighbors, typed-edge subgraph).
**Tool used:** `data_graph_read`. **Follow-up:** `build_communities`,
`decision_lineage` as richer views.

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

### AUR-5 — Deep-reasoning & verification mode in chat ✅ DONE (2026-06-08)

**Done:** "Deep" toggle (Brain icon) in chat header, persisted in localStorage.
When ON, `api/chat.ts` sends `reflect: true` to `reason_deeply` and surfaces the
RLM's rich reflection envelope: `reasoning_chain[]`, `confidence`,
`quality.overall_score`, `quality.reflection_attempted/kept`, and
`routing.provider/model/domain/latency_ms`. Server emits this as a custom
`data-reasoning` UI-message-stream part alongside the text. Client renders it
inline under the assistant message as a collapsible `ReasoningPanel`
(confidence%, quality, reflection chip, provider/model, numbered chain).
**Backend reality:** the backend MCP route exposes only `reason_deeply`
(`verify_output`/`judge_response`/`critique_refine` all 404 — they live on a
different MCP surface). The RLM's internal reflection signal is rich enough to
ship the experience without chaining; revisit verify/judge if/when they appear
on this route.
**Tools used:** `reason_deeply` (with `reflect: true`).

### AUR-6 — Agent memory persistence (cross-session continuity)

**Why:** Threads persist in Supabase, but no agent memory / lessons feed the
platform flywheel.
**Build:** On meaningful turns, `memory_store` insights/closures; on session
start, `memory_search` / `memory_retrieve` to hydrate context. Surface a
"Memory" panel.
**Tools:** `memory_store`, `memory_search`, `memory_retrieve`,
`memory_consolidate`.

### AUR-7 — Deploy target (Railway) + auto-deploy ✅ DONE (2026-06-07)

**Done:** Target is **Railway** (nitro `node-server` preset, `railway.toml` +
`nixpacks.toml` Node 22, `npm install` install phase). `/health` route added.
**Auto-deploy is live:** the service has a GitHub repoTrigger on `main`
(`Clauskraft/WidgetDC-Gemini-App`) — verified by the PR #9 merge auto-firing
deploy `3e33836a` (SUCCESS). Future merges to `main` deploy automatically; no
manual `railway up`.
**Follow-up (P2):** wire `.github/workflows/e2e.yml` to run vitest + build on PR
as a pre-merge gate; `commit_sha` in `/health` is "unknown" on CLI deploys but
populated on GitHub-trigger deploys (`RAILWAY_GIT_COMMIT_SHA`).

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

The token signer falls back to `WIDGETDC_API_KEY` then a dev default. Make a real
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
