# WidgeTDC Aurora Frontend Integration

## Source map

| Source element | Frontend translation |
|---|---|
| `WidgetDC-Gemini-App` React + Express + Vite structure | Vite React app using `/api/chat`, `/api/widgetdc/route`, `/api/mcp/proxy` and `/auth/status` |
| Server-side Gemini key posture | No browser Gemini key; chat goes through Express route |
| Server-side MCP proxy posture | No browser MCP secret; tool calls go through BFF |
| Stitch / Lumina design system | Dark glassmorphism, Aurora gradient, sidebar + chat/canvas layout, Mission Control panels |
| WidgeTDC governance docs | Risk badges, plan/approval requirements, EventSpine preview and claim holds |
| Phantom BOM pattern | BOMRun, BOMItems, WorkArtifact and PRODUCES coverage UI |

## Component map

```text
App
├── TopBar
├── LeftRail
├── MissionControl
├── ChatPanel
├── GovernancePanel
├── CanvasView
├── PhantomBomPanel
├── EventSpineTimeline
├── ClaimsPanel
└── ConnectorsPanel
```

## Required server-side enforcement

The UI is intentionally conservative. Actual enforcement must remain server-side:

```text
1. Resolve server-side identity and tenant.
2. Ignore client-supplied governance as authority.
3. Resolve canonical tool metadata.
4. Reject risky writes without plan/approval.
5. Persist durable EventSpine evidence before governed write success.
6. Use typed graph promotion or governed lineage only.
```

## Browser safety checklist

```text
[ ] No GEMINI_API_KEY in frontend bundle.
[ ] No MCP_AGENT_API_KEY in frontend bundle.
[ ] No VITE_API_KEY for backend MCP.
[ ] No raw graph.write_cypher action.
[ ] No direct Neo4j/Postgres/Railway writes.
[ ] All write-like actions show plan/approval path unless server confirms approved context.
[ ] All operator actions carry correlation_id.
```

## Recommended next server tasks

```text
[ ] Add `/api/governance/tools` returning canonical tool metadata.
[ ] Add `/api/events/replay?correlation_id=...` for EventSpine replay.
[ ] Add `/api/claims` read endpoint.
[ ] Add `/api/phantom/runs/:id` read endpoint for BOMRun/BOMItems.
[ ] Add typed endpoint for `graph.link_execution_lineage`, server-gated by HyperAgent.
```

## Claim-safe wording

Use:

```text
Frontend implementation package prepared for governed WidgeTDC control-plane UI.
```

Do not use until runtime proof exists:

```text
production-ready control plane
zero-bypass complete
runtime-global governance proven
Phantom BOM L3 proven
```
