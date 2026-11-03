# LIN-2063 — Aurora visible UX reset

Status: adopted implementation slice (candidate/L1 until merge and deploy readback)

## Adoption record

- Linear anchor: `LIN-2063` — Phase 1: WDC Chat UX Polish.
- Operator intent: make the currently deployed Aurora surface visibly calmer and usable.
- WorkBOM: `taskbom:adaptive:3312458d1115`.
- RouteEnvelope: validated `LLM -> wdc-agent`, truth-distance `0.5`.

## Adoption classification

`hybrid`: reuse the current AppShell, thread store, IntelligenceStrip and automatic
canvas self-heal; change only their presentation and deterministic list projection.

## Question report

1. Can the shell become calmer without deleting a route? Yes: keep the canonical
   navigation registry and collapse the secondary library group by default.
2. Can duplicate recent labels be removed without deleting user data? Yes: derive a
   display-only list and leave local storage untouched.
3. Should the frontend override a bad backend route? No: the canonical WDC chat
   backend remains routing authority; backend misrouting is a separate slice.
4. Is a local browser pass runtime proof? No: it is diagnostic-only.

## Triangulation report

- Direct source at remote-main SHA `c2276215282f` shows the email in the shell,
  an always-expanded ten-item library, raw routing score in the status summary,
  ASCII Danish run-state text and raw canvas validation labels.
- Deployed SHA readback matched that remote-main SHA 3/3 before this slice, so the
  screenshot is not explained by a stale deploy.
- SRAG missed `LIN-2063` and returned low-confidence unrelated results. It is negative
  retrieval-quality evidence only and is not used as implementation authority.

### LegoFactory design-adoption readback

- `widgetdc-openclaw/docs/assembly-harvest/mega-assembly-harvest-triangulation.md`
  defines `DesignSystemBlock`, `UIStyleBlock` and `ProductSurfaceBlock`, but its route-aware
  manifest marks the design tranche `dry_run_only_l1_design_projection`.
- Current graph readback returned zero nodes for those three labels and for
  `AppSurfaceBlock`, `DesignPatternBlock` and `ToolUiBlock`.
- `widgetdc-consulting-frontend` PR #7 merged the read-only Widget Foundry inventory:
  22 registry entries and 12 recommended Gemini slots, all candidate/projection-only.
- Gemini PR #95 added a candidate bridge. PR #122 later removed `BrokerageRouteCard`,
  its only UI consumer, while retaining `widgetFoundryBridge.ts`; the bridge is orphaned.
- The active `ConfiguredAssemblyVariant` in WidgeTDC emits BOM, route, project-tree and
  proof gates, but no design profile, selected design blocks or host-adapter contract.

Conclusion: this LIN-2063 change is a visible emergency cleanup using existing Gemini
tokens. It is not evidence that the LegoFactory design standard has been adopted. That
requires a separate cross-repo ConfiguredAssemblyVariant -> DesignProfile -> Gemini
host-adapter slice and governed materialization/readback of the curated Foundry inputs.

## Existence and reuse report

- Reuse `AppSidebar`; no new shell.
- Reuse `IntelligenceStrip`; no second diagnostics panel.
- Reuse the current automatic canvas self-heal; only present its result humanely.
- Reuse `useThreads` storage; deduplication is a pure display projection and performs
  no destructive migration.

## Compiled implementation directive

### Objective

Deliver one visible slice: calmer navigation, deduplicated recent titles, correct
Danish run-state copy, routing internals behind an Evidence disclosure, and a humane
canvas-format notice.

### Invariants

- Every canonical route remains reachable.
- Stored threads and messages are never deleted or rewritten by deduplication.
- WDC CLI remains the text frontend and Gemini-App remains the GUI frontend.
- Routing authority stays in the canonical backend.
- Evidence details remain accessible to operators, but are not primary UI chrome.

### Tests-first slices

1. Pure recent-thread projection tests.
2. Run-state copy tests.
3. SSR tests for collapsed evidence and validation notices.
4. Browser shell contract for identity removal and collapsed secondary navigation.

### Stop conditions

- Any route disappears or dead-click coverage regresses.
- Thread storage changes as a side effect of display deduplication.
- Raw route score remains in the collapsed status line.
- Focused tests, typecheck, build, or browser smoke fail.
- Branch loses parity with its reviewed head before merge.

### Claim boundary

Local tests and screenshots are `diagnostic_only`. An open/merged PR is at most L1.
No deployed or user-visible success claim is allowed until the production release SHA
matches the merge SHA and the browser behavior is read back from that deployed build.

## Rollout and done definition

Commit -> push -> PR -> Claude A2A peer review -> green CI -> merge -> deployed SHA
readback -> production browser smoke. LIN-2063 is not Done before that chain completes.
