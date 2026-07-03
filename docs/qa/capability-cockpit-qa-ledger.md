# Capability Cockpit QA Ledger

## Scope

Branch: `codex/lin-953-gemini-frontend-toolbox-orbit`

PR: `#102`

Route under review: `/capabilities`

This ledger is a ratchet boundary for the capability cockpit slice. It does not
claim runtime proof, adoption proof, claim promotion, or full-app QA green.

## Fresh Command Evidence

Captured on 2026-07-03 from
`C:\Users\claus\Projetcs\WidgetDC-Gemini-App-frontend-toolbox-orbit`.

| Gate | Status | Evidence | Blocker | Next action |
| --- | --- | --- | --- | --- |
| WDC status | PASS | Backend GREEN, deployed SHA `bcdfbb0717fb`, GOV enforce, EventSpine durable, `427/427` active capabilities | none | refresh before future claims |
| WDC boot | PASS | `session:d301a4a65bbc`, target clean, source mutation actor verified | none | release session at closeout |
| Initial worktree | PASS | `git status --short` empty before QA work | none | keep clean before commit |
| Build | PASS | `npm run build`, exit `0` | existing warnings only | keep as required gate |
| Unit tests | PASS | `npm test -- --run`, `50` files, `300` tests | none | keep as required gate |
| Slice-owned lint | PASS | `npx eslint` on capability cockpit files, exit `0` | none | ratchet with `npm run verify:capability-cockpit` |
| World-class proof E2E | PASS | `npx playwright test e2e/world-class-proof.spec.ts --reporter=dot`, `3/3` | none | keep as targeted proof gate |
| Full repo lint | FAIL | `npm run lint`, `524 problems (507 errors, 17 warnings)` | repo-wide Prettier debt outside capability slice | fix in separate lint-debt slice or ratchet |
| Full E2E | FAIL | `npm run test:e2e -- --reporter=dot`, `18 passed`, `4 failed` | graph fullscreen visual snapshots | classify or update graph baselines in separate slice |

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

## Graph Snapshot Failure Ledger

Full E2E failures are isolated to `e2e/graph.spec.ts` fullscreen visual
snapshots. The capability cockpit diff does not touch `e2e`, graph components,
or `src/routes/visual.graph.tsx`.

| Case | Expected | Received | Classification |
| --- | --- | --- | --- |
| `linear` fullscreen | `314x539` | `324x539` | graph visual snapshot debt |
| `branching` fullscreen | `314x539` | `323x539` | graph visual snapshot debt |
| `knowledge` fullscreen | `322x599` | `328x599` | graph visual snapshot debt |
| `invalid` fullscreen | `606x630` | `650x652`, diff ratio `0.20` | graph visual snapshot debt |

Evidence:

- failing file: `e2e/graph.spec.ts`
- failing locator: `getByTestId("visual-fullscreen")`
- passing count: `18`
- failing count: `4`

Required next action for full-app QA green:

- Either update graph baselines after visual review, or fix the graph fullscreen
  layout instability.
- Do this in a graph-specific slice, not inside the capability cockpit slice.

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

PR `#102` can be reviewed as a candidate/L1 capability cockpit slice.

PR `#102` must remain blocked from full-app QA/world-class-ready language until:

- full repo lint is either green or governed by a broader accepted debt ratchet
- graph visual snapshot failures are fixed or accepted through graph-owner review

Allowed claim language:

- Capability cockpit route is visible and targeted proof-tested.
- Frontend slice is candidate/L1 only.
- World-class proof harness passes for current capability flow.
- Full app QA remains blocked by repo-wide lint debt and graph visual snapshots.

Forbidden claim language:

- world-class complete
- runtime proven
- adoption proven
- all capabilities governed
- zero legacy
- fully autonomous
- claim ready
