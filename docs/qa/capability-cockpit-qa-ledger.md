# Capability Cockpit QA Ledger

## Scope

Branch: `codex/lin-953-gemini-frontend-toolbox-orbit`

PR: `#102`

Route under review: `/capabilities`

This ledger is a ratchet boundary for the capability cockpit slice. It does not
claim runtime proof, adoption proof, claim promotion, or full-app QA green.

## Fresh Command Evidence

Captured on 2026-07-03 from
`C:\Users\claus\Projetcs\WidgetDC-Gemini-App-frontend-toolbox-orbit`
through WDC CLI frontend gates from
`C:\Users\claus\Projetcs\WidgeTDC-frontend-toolbox-orbit`.

| Gate | Status | Evidence | Blocker | Next action |
| --- | --- | --- | --- | --- |
| WDC status | PASS | `wdc status --json`: backend GREEN, deployed SHA `6724bd4808c3`, GOV enforce, EventSpine durable, `440/440` active capabilities | none | refresh before future claims |
| WDC boot/session | PASS_WITH_BOUNDARY | Active Agent Office session `session:47a1720b7e27`; later boot correctly blocked while target was dirty during in-progress edits | target dirty during edit loop only | release session at closeout |
| WDC BOM/Lego | PASS | `adaptive_bom.compose`: `taskbom:adaptive:cafef4c1aef8`, `claim_maturity:L1`, `graph_promoted:false`; `lego stats`: CP `42/42`, L2 `845/1051`, target met | none | keep BOM/Lego visible in closeout |
| Build | PASS | `wdc test frontend --gate build --json`, exit `0` | existing warnings only | keep as required gate |
| Unit tests | PASS | `wdc test frontend --gate unit --json`, `50` files, `300` tests | none | keep as required gate |
| Capability cockpit ratchet | PASS | `wdc test frontend --gate capability-cockpit --json`, `capability cockpit guard passed` | none | keep as slice ratchet |
| Graph visual E2E | PASS | `wdc test frontend --gate graph-e2e --json`, `8 passed` | none | keep graph snapshots under WDC gate |
| World-class proof E2E | PASS | `wdc test frontend --gate world-class-proof --json`, `3 passed` | none | keep as targeted proof gate |
| Full E2E | PASS | `wdc test frontend --gate e2e --json`, `22 passed` | none | keep as broad frontend gate |
| Full repo lint | FAIL_BOUNDARY | `wdc test frontend --gate lint --json`, `524 problems (507 errors, 17 warnings)` | repo-wide Prettier debt outside capability slice | formal lint-debt ratchet; fix in separate debt-reduction slice |

## Lint Debt Ledger

Current broad lint status is not green.

Failure signature:

- `524 problems`
- `507 errors`
- `17 warnings`
- `506 errors and 1 warning potentially fixable with --fix`
- dominant rule: `prettier/prettier`

Representative affected paths:

- `scripts/validate-peer-signoff.mjs`
- `src/components/CanvasPanel.tsx`
- `src/components/Chart.tsx`
- `src/components/CommandPalette.tsx`
- `src/components/DeepResearchPanel.tsx`
- `src/components/WorldClassAssessment.tsx`
- `src/components/ui/button.tsx`
- `src/lib/chatTools.server.ts`
- `src/routes/storyline.tsx`

Capability cockpit ratchet:

- New or modified capability cockpit files must pass targeted lint.
- New or modified capability cockpit files must pass the anti-legacy proof
  guard.
- Existing broad lint debt must not be described as green.
- Existing broad lint debt requires a separate debt-reduction slice if full-app
  QA green is required.

Command:

```bash
npm run verify:capability-cockpit
```

## Graph Snapshot Closure Ledger

The prior full E2E blocker was closed in a graph-specific follow-up slice.
The root cause was the visual harness shrink-wrapping inside the app root flex
shell plus a global `.aurora-figure svg` rule overriding Lucide error icons.

Fixes:

- `src/routes/visual.graph.tsx` now gives the visual harness explicit width,
  minimum width, box sizing, and viewport-height constraints.
- `src/components/GraphErrorBlock.tsx` now pins Lucide icon sizes with inline
  dimensions so global figure SVG rules cannot inflate the error icon.
- Five graph snapshots were regenerated after visual review.

Regenerated baselines:

- `graph-linear-fullscreen-chromium-desktop-win32.png`
- `graph-branching-fullscreen-chromium-desktop-win32.png`
- `graph-knowledge-fullscreen-chromium-desktop-win32.png`
- `graph-invalid-normal-chromium-desktop-win32.png`
- `graph-invalid-fullscreen-chromium-desktop-win32.png`

WDC evidence:

- `wdc test frontend --gate graph-e2e --update-snapshots --json`: `8 passed`,
  five snapshots regenerated.
- `wdc test frontend --gate graph-e2e --json`: `8 passed`, read-only.
- `wdc test frontend --gate e2e --json`: `22 passed`.

### 2026-07-03 CI Baseline Parity Addendum

Remote PR head `9ed94cbeac8d1f9ea969325f2dec6610ef55dc73` updated the
Linux Playwright graph baselines that CI consumes. The previous failing CI run
reported five Linux snapshot mismatches in `e2e/graph.spec.ts`; the updated
Linux baselines now match the rendered dimensions:

- `graph-linear-fullscreen-chromium-desktop-linux.png`: `1120x539`
- `graph-branching-fullscreen-chromium-desktop-linux.png`: `1120x539`
- `graph-knowledge-fullscreen-chromium-desktop-linux.png`: `1120x599`
- `graph-invalid-normal-chromium-desktop-linux.png`: `880x172`
- `graph-invalid-fullscreen-chromium-desktop-linux.png`: `1120x138`

Fresh local gate readback on the clean PR worktree:

- `npm run build`: passed.
- `npm test -- --run`: `50` files, `300` tests passed.
- `npm run verify:capability-cockpit`: passed.
- `npm run test:e2e -- e2e/graph.spec.ts`: `8` graph tests passed.
- `npm run test:e2e`: `22` full E2E tests passed.
- `npm run lint -- --format json`: failed with `524` known repo-wide problems
  (`507` errors, `17` warnings); this remains the formal lint-debt boundary,
  not a green lint claim.

This addendum is candidate/L1 evidence only. It does not claim runtime proof,
adoption proof, graph truth promotion, Railway deployment, or claim promotion.

## Anti-Legacy Guard

The capability cockpit slice must not introduce:

- stale hardcoded capability counts in user-facing proof text
- false runtime/adoption proof language
- Gemini App as orchestrator authority
- direct provider selection before capability resolution
- graph write calls
- Railway mutation calls
- claim promotion calls

Guard command:

```bash
npm run verify:capability-cockpit
```

## PR Readiness Verdict

PR `#102` can be reviewed as a candidate/L1 capability cockpit slice with the
graph visual E2E blocker closed.

PR `#102` must remain blocked from runtime/adoption/world-class-ready language
until:

- full repo lint is either green or governed by a broader accepted debt ratchet
- runtime proof and adoption proof are produced in later governed slices

Allowed claim language:

- Capability cockpit route is visible and targeted proof-tested.
- Frontend slice is candidate/L1 only.
- World-class proof harness passes for current capability flow.
- Full E2E passes 22/22 after graph visual snapshot closure.
- Full repo lint remains bounded by the explicit lint-debt ratchet.

Forbidden claim language:

- world-class complete
- runtime proven
- adoption proven
- all capabilities governed
- zero legacy
- fully autonomous
- claim ready
