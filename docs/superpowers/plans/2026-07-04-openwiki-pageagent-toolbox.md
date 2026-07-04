# OpenWiki PageAgent Frontend Toolbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WDC-governed frontend toolbox slice that folds OpenWiki-inspired knowledge-pack maintenance and Page-Agent-inspired in-page guided actions into the Gemini App capability cockpit without weakening candidate/L1 boundaries.

**Architecture:** WDC remains the authority for governance, BOM, A2A, proof boundaries, and claim control. OpenWiki contributes a repo knowledge-pack pattern, Page Agent contributes a DOM-indexed guided action pattern, Lovable remains a candidate prototype source, and Gemini App remains the cockpit/readback surface. The first implementation is fixture-backed and candidate-only; no browser automation, deployment, graph write, Railway mutation, or claim promotion is part of this plan.

**Tech Stack:** React, TypeScript, TanStack Router, Vitest, existing Gemini App components, WDC CLI for boot/session/route/BOM/A2A/work claims, Markdown docs.

## Global Constraints

- Vercel remains paused until a separate explicit deploy/login task is resumed.
- Claim boundary is candidate/L1 only.
- No graph writes.
- No Railway mutation.
- No claim promotion.
- No runtime, adoption, or world-class-complete language.
- All WDC platform operations use WDC CLI.
- Local app tests are diagnostic evidence only unless wrapped by a deployed governed runtime proof surface.
- OpenWiki-derived docs are diagnostic/candidate knowledge, not graph truth.
- Page-Agent-derived action suggestions are disabled-by-default candidates, not orchestrator authority.
- No API keys, bearer tokens, or provider secrets are allowed in browser bundles, docs, logs, PR bodies, Linear comments, or A2A payloads.
- Existing context to preserve: PR #103 merged; `/audit-factory` exists; Lovable candidate project is ready; Vercel integration/deploy is paused.

## Source Anchors

- OpenWiki repository: `https://github.com/langchain-ai/openwiki`
- OpenWiki architecture: `https://raw.githubusercontent.com/langchain-ai/openwiki/main/openwiki/architecture/overview.md`
- OpenWiki agent workflow: `https://raw.githubusercontent.com/langchain-ai/openwiki/main/openwiki/agent/workflow.md`
- OpenWiki operations: `https://raw.githubusercontent.com/langchain-ai/openwiki/main/openwiki/operations/credentials-and-updates.md`
- Page Agent repository: `https://github.com/alibaba/page-agent`
- Page Agent agent instructions: `https://raw.githubusercontent.com/alibaba/page-agent/main/AGENTS.md`
- Page Agent developer guide: `https://raw.githubusercontent.com/alibaba/page-agent/main/docs/developer-guide.md`
- WDC BOM readback: `taskbom:adaptive:f308fc99e504`
- WDC BOM correlation: `corr:adaptive-bom:f308fc99e504`
- WDC route: `MCP/world-class-capability-cockpit-route`
- WDC session: `session:96cb8f3ec7cd`
- WDC claim: `claim:b2e33393a465`

## File Structure

- Create: `docs/frontend/openwiki-pageagent-toolbox.md`
- Create: `src/features/frontend-toolbox/toolboxCatalog.ts`
- Create: `src/features/frontend-toolbox/toolboxCatalog.test.ts`
- Create: `src/features/frontend-toolbox/knowledgePackFactory.ts`
- Create: `src/features/frontend-toolbox/knowledgePackFactory.test.ts`
- Create: `src/features/frontend-toolbox/cockpitDomAgent.ts`
- Create: `src/features/frontend-toolbox/cockpitDomAgent.test.ts`
- Modify: `src/components/AuditFactoryCockpit.tsx`
- Modify: `scripts/verify-capability-cockpit.mjs`

## Task 1: Governance Documentation and Boundary Ledger

**Files:**
- Create: `docs/frontend/openwiki-pageagent-toolbox.md`

**Interfaces:**
- Consumes: WDC route/BOM/source anchors listed above.
- Produces: A human-readable contract for OpenWiki/Page Agent pattern use in Gemini App.

- [ ] **Step 1: Create the documentation file**

Write `docs/frontend/openwiki-pageagent-toolbox.md` with this exact structure:

```markdown
# OpenWiki and Page Agent Frontend Toolbox

## Status

Candidate/L1 only. This document is not runtime proof, graph truth, deployment proof, adoption proof, or claim promotion evidence.

## Current Context

- PR #103 has been merged into Gemini App main.
- `/audit-factory` exists as the cockpit route for audit/toolbox visibility.
- Lovable project `1170ae84-4e85-4138-95dd-c9c3312b530b` is candidate-only.
- Vercel deploy and login are paused.
- WDC BOM readback for this slice is `taskbom:adaptive:f308fc99e504`.

## OpenWiki Pattern Import

OpenWiki contributes the following reusable concepts:

| Pattern | WDC adaptation | Boundary |
|---|---|---|
| Knowledge folder | KnowledgePackFactory | Diagnostic/candidate |
| Last-update metadata | KnowledgePackManifest | Diagnostic/candidate |
| Git evidence window | WDC boot/git/readback window | Diagnostic unless deployed runtime confirms |
| Scheduled docs PR | WDC-governed doc refresh slice | Candidate/L1 |
| Secret diagnostics | Masked env diagnostics | No secret values |

## Page Agent Pattern Import

Page Agent contributes the following reusable concepts:

| Pattern | WDC adaptation | Boundary |
|---|---|---|
| DOM to simplified tree | CockpitDOMSnapshot | Candidate UI evidence |
| Indexed operations | GuidedActionCandidate | Disabled by default |
| Controller/brain/UI split | CockpitDomAgent contracts | No orchestrator authority |
| Reflection before action | Plan/critique/action proposal | No automatic mutation |
| Visible mask | Candidate action overlay | User-visible only |

## Required Proof Boundary

Every UI state must be typed as exactly one of:

- `candidate`
- `diagnostic`
- `runtime`
- `claim`

This slice may only emit `candidate` and `diagnostic` states.

## Forbidden Language

- world-class complete
- runtime proven
- adoption proven
- all capabilities governed
- zero legacy
- fully autonomous
- claim ready
- orchestrator authority

## Execution Sequence

1. WDC boot session.
2. WDC route validation.
3. WDC adaptive BOM compose.
4. WDC work claim.
5. Implement fixture-backed frontend catalog.
6. Add proof-boundary tests.
7. Send A2A handoff/review request.
8. Commit and push via WDC git surfaces.
9. Open PR as candidate/L1 only.
```

- [ ] **Step 2: Confirm no forbidden claim words were added**

Run:

```powershell
Select-String -Path docs/frontend/openwiki-pageagent-toolbox.md -Pattern 'world-class complete|runtime proven|adoption proven|all capabilities governed|zero legacy|fully autonomous|claim ready|orchestrator authority'
```

Expected: matches only inside the `Forbidden Language` section.

- [ ] **Step 3: Commit after documentation passes local scan**

Use WDC git commit-local:

```powershell
wdc git commit-local --repo "C:\Users\claus\Projetcs\WidgetDC-Gemini-App-frontend-toolbox-orbit" --paths "docs/frontend/openwiki-pageagent-toolbox.md" --message "docs: add openwiki pageagent toolbox boundary"
```

Expected: commit succeeds; no unrelated files are included.

## Task 2: Typed Toolbox Catalog

**Files:**
- Create: `src/features/frontend-toolbox/toolboxCatalog.ts`
- Create: `src/features/frontend-toolbox/toolboxCatalog.test.ts`

**Interfaces:**
- Produces: `ToolboxCapability`, `ToolboxPattern`, `TOOLBOX_PATTERNS`, `getToolboxPatternsBySource(source)`.
- Consumes: No app runtime state.

- [ ] **Step 1: Create failing tests**

Create `src/features/frontend-toolbox/toolboxCatalog.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  TOOLBOX_PATTERNS,
  getToolboxPatternsBySource,
} from './toolboxCatalog';

describe('toolboxCatalog', () => {
  it('keeps all imported patterns candidate or diagnostic only', () => {
    expect(TOOLBOX_PATTERNS.length).toBeGreaterThanOrEqual(8);
    expect(TOOLBOX_PATTERNS.every((pattern) => ['candidate', 'diagnostic'].includes(pattern.boundary))).toBe(true);
  });

  it('separates OpenWiki and Page Agent pattern sources', () => {
    expect(getToolboxPatternsBySource('openwiki').map((pattern) => pattern.id)).toContain('knowledge-pack-factory');
    expect(getToolboxPatternsBySource('page-agent').map((pattern) => pattern.id)).toContain('cockpit-dom-agent');
  });

  it('never assigns orchestrator authority to Gemini App patterns', () => {
    expect(TOOLBOX_PATTERNS.every((pattern) => pattern.authority !== 'orchestrator')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test and observe failure**

```powershell
npm test -- --run src/features/frontend-toolbox/toolboxCatalog.test.ts
```

Expected: FAIL because `toolboxCatalog.ts` does not exist.

- [ ] **Step 3: Create implementation**

Create `src/features/frontend-toolbox/toolboxCatalog.ts`:

```typescript
export type ToolboxSource = 'openwiki' | 'page-agent' | 'wdc' | 'lovable';
export type ProofBoundary = 'candidate' | 'diagnostic' | 'runtime' | 'claim';
export type ToolboxAuthority = 'knowledge' | 'ui-assist' | 'prototype' | 'governance';

export interface ToolboxPattern {
  id: string;
  source: ToolboxSource;
  title: string;
  summary: string;
  boundary: Extract<ProofBoundary, 'candidate' | 'diagnostic'>;
  authority: ToolboxAuthority;
  disabledByDefault: boolean;
}

export const TOOLBOX_PATTERNS: ToolboxPattern[] = [
  {
    id: 'knowledge-pack-factory',
    source: 'openwiki',
    title: 'KnowledgePackFactory',
    summary: 'Maintains agent-readable repo knowledge packs from anchored evidence windows.',
    boundary: 'diagnostic',
    authority: 'knowledge',
    disabledByDefault: false,
  },
  {
    id: 'knowledge-pack-manifest',
    source: 'openwiki',
    title: 'KnowledgePackManifest',
    summary: 'Stores commit, source window, content hash, and stale status for knowledge packs.',
    boundary: 'diagnostic',
    authority: 'knowledge',
    disabledByDefault: false,
  },
  {
    id: 'idempotent-context-fold',
    source: 'openwiki',
    title: 'IdempotentContextFold',
    summary: 'Skips metadata churn when content hashes do not change.',
    boundary: 'diagnostic',
    authority: 'knowledge',
    disabledByDefault: false,
  },
  {
    id: 'masked-secret-diagnostics',
    source: 'openwiki',
    title: 'MaskedSecretDiagnostics',
    summary: 'Reports credential readiness without revealing secret values.',
    boundary: 'diagnostic',
    authority: 'knowledge',
    disabledByDefault: false,
  },
  {
    id: 'cockpit-dom-agent',
    source: 'page-agent',
    title: 'CockpitDOMAgent',
    summary: 'Builds simplified DOM snapshots for guided cockpit actions.',
    boundary: 'candidate',
    authority: 'ui-assist',
    disabledByDefault: true,
  },
  {
    id: 'indexed-action-contract',
    source: 'page-agent',
    title: 'IndexedActionContract',
    summary: 'Represents actions as element-indexed proposals that can be reviewed before execution.',
    boundary: 'candidate',
    authority: 'ui-assist',
    disabledByDefault: true,
  },
  {
    id: 'reflection-before-action',
    source: 'page-agent',
    title: 'ReflectionBeforeAction',
    summary: 'Requires plan and critique text before presenting an action candidate.',
    boundary: 'candidate',
    authority: 'ui-assist',
    disabledByDefault: true,
  },
  {
    id: 'candidate-prototype-lab',
    source: 'lovable',
    title: 'CandidatePrototypeLab',
    summary: 'Uses visual prototypes as candidate inputs only.',
    boundary: 'candidate',
    authority: 'prototype',
    disabledByDefault: false,
  },
  {
    id: 'evidence-boundary-ledger',
    source: 'wdc',
    title: 'EvidenceBoundaryLedger',
    summary: 'Labels every visible state as candidate, diagnostic, runtime, or claim.',
    boundary: 'diagnostic',
    authority: 'governance',
    disabledByDefault: false,
  },
];

export function getToolboxPatternsBySource(source: ToolboxSource): ToolboxPattern[] {
  return TOOLBOX_PATTERNS.filter((pattern) => pattern.source === source);
}
```

- [ ] **Step 4: Run test and observe pass**

```powershell
npm test -- --run src/features/frontend-toolbox/toolboxCatalog.test.ts
```

Expected: PASS.

## Task 3: KnowledgePackFactory Contract

**Files:**
- Create: `src/features/frontend-toolbox/knowledgePackFactory.ts`
- Create: `src/features/frontend-toolbox/knowledgePackFactory.test.ts`

**Interfaces:**
- Consumes: `ProofBoundary` from `toolboxCatalog.ts`.
- Produces: `KnowledgePackManifest`, `createKnowledgePackManifest(input)`.

- [ ] **Step 1: Create failing tests**

Create `src/features/frontend-toolbox/knowledgePackFactory.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createKnowledgePackManifest } from './knowledgePackFactory';

describe('createKnowledgePackManifest', () => {
  it('creates diagnostic-only manifests from anchored evidence', () => {
    const manifest = createKnowledgePackManifest({
      sourceCommit: '1c4a9615b40e',
      sourceWindow: ['docs/frontend/openwiki-pageagent-toolbox.md'],
      contentHash: 'sha256:abc123',
      generatedAt: '2026-07-04T00:00:00.000Z',
    });

    expect(manifest.boundary).toBe('diagnostic');
    expect(manifest.graphTruth).toBe(false);
    expect(manifest.runtimeProof).toBe(false);
    expect(manifest.sourceWindow).toEqual(['docs/frontend/openwiki-pageagent-toolbox.md']);
  });

  it('marks the pack stale when the source commit changes', () => {
    const manifest = createKnowledgePackManifest({
      sourceCommit: '1c4a9615b40e',
      sourceWindow: ['docs/frontend/openwiki-pageagent-toolbox.md'],
      contentHash: 'sha256:abc123',
      generatedAt: '2026-07-04T00:00:00.000Z',
      currentCommit: 'different-commit',
    });

    expect(manifest.stale).toBe(true);
  });
});
```

- [ ] **Step 2: Run test and observe failure**

```powershell
npm test -- --run src/features/frontend-toolbox/knowledgePackFactory.test.ts
```

Expected: FAIL because `knowledgePackFactory.ts` does not exist.

- [ ] **Step 3: Create implementation**

Create `src/features/frontend-toolbox/knowledgePackFactory.ts`:

```typescript
import type { ProofBoundary } from './toolboxCatalog';

export interface KnowledgePackManifestInput {
  sourceCommit: string;
  sourceWindow: string[];
  contentHash: string;
  generatedAt: string;
  currentCommit?: string;
}

export interface KnowledgePackManifest {
  id: 'knowledge-pack-factory';
  boundary: Extract<ProofBoundary, 'diagnostic'>;
  sourceCommit: string;
  sourceWindow: string[];
  contentHash: string;
  generatedAt: string;
  stale: boolean;
  graphTruth: false;
  runtimeProof: false;
}

export function createKnowledgePackManifest(input: KnowledgePackManifestInput): KnowledgePackManifest {
  const currentCommit = input.currentCommit ?? input.sourceCommit;

  return {
    id: 'knowledge-pack-factory',
    boundary: 'diagnostic',
    sourceCommit: input.sourceCommit,
    sourceWindow: [...input.sourceWindow],
    contentHash: input.contentHash,
    generatedAt: input.generatedAt,
    stale: currentCommit !== input.sourceCommit,
    graphTruth: false,
    runtimeProof: false,
  };
}
```

- [ ] **Step 4: Run test and observe pass**

```powershell
npm test -- --run src/features/frontend-toolbox/knowledgePackFactory.test.ts
```

Expected: PASS.

## Task 4: CockpitDOMAgent Candidate Contract

**Files:**
- Create: `src/features/frontend-toolbox/cockpitDomAgent.ts`
- Create: `src/features/frontend-toolbox/cockpitDomAgent.test.ts`

**Interfaces:**
- Consumes: `ProofBoundary` from `toolboxCatalog.ts`.
- Produces: `CockpitDomNode`, `GuidedActionCandidate`, `createGuidedActionCandidate(input)`.

- [ ] **Step 1: Create failing tests**

Create `src/features/frontend-toolbox/cockpitDomAgent.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createGuidedActionCandidate } from './cockpitDomAgent';

describe('createGuidedActionCandidate', () => {
  it('creates disabled candidate-only UI actions', () => {
    const action = createGuidedActionCandidate({
      elementIndex: 3,
      elementLabel: 'Open Audit Factory',
      action: 'focus',
      plan: 'Move keyboard focus to the Audit Factory navigation item.',
      critique: 'This is safe because it is a local focus proposal with no graph or network mutation.',
    });

    expect(action.boundary).toBe('candidate');
    expect(action.disabledByDefault).toBe(true);
    expect(action.requiresApproval).toBe(true);
    expect(action.mutations).toEqual([]);
  });

  it('rejects action candidates without plan and critique', () => {
    expect(() =>
      createGuidedActionCandidate({
        elementIndex: 1,
        elementLabel: 'Run',
        action: 'click',
        plan: '',
        critique: '',
      }),
    ).toThrow('Guided actions require both plan and critique text.');
  });
});
```

- [ ] **Step 2: Run test and observe failure**

```powershell
npm test -- --run src/features/frontend-toolbox/cockpitDomAgent.test.ts
```

Expected: FAIL because `cockpitDomAgent.ts` does not exist.

- [ ] **Step 3: Create implementation**

Create `src/features/frontend-toolbox/cockpitDomAgent.ts`:

```typescript
import type { ProofBoundary } from './toolboxCatalog';

export type GuidedDomAction = 'focus' | 'click' | 'input' | 'scroll';

export interface GuidedActionCandidateInput {
  elementIndex: number;
  elementLabel: string;
  action: GuidedDomAction;
  plan: string;
  critique: string;
}

export interface GuidedActionCandidate {
  id: string;
  boundary: Extract<ProofBoundary, 'candidate'>;
  elementIndex: number;
  elementLabel: string;
  action: GuidedDomAction;
  plan: string;
  critique: string;
  disabledByDefault: true;
  requiresApproval: true;
  mutations: [];
}

export function createGuidedActionCandidate(input: GuidedActionCandidateInput): GuidedActionCandidate {
  if (input.plan.trim().length === 0 || input.critique.trim().length === 0) {
    throw new Error('Guided actions require both plan and critique text.');
  }

  return {
    id: `guided-action:${input.elementIndex}:${input.action}`,
    boundary: 'candidate',
    elementIndex: input.elementIndex,
    elementLabel: input.elementLabel,
    action: input.action,
    plan: input.plan,
    critique: input.critique,
    disabledByDefault: true,
    requiresApproval: true,
    mutations: [],
  };
}
```

- [ ] **Step 4: Run test and observe pass**

```powershell
npm test -- --run src/features/frontend-toolbox/cockpitDomAgent.test.ts
```

Expected: PASS.

## Task 5: Audit Factory Cockpit Visibility

**Files:**
- Modify: `src/components/AuditFactoryCockpit.tsx`
- Test: `scripts/verify-capability-cockpit.mjs`

**Interfaces:**
- Consumes: `TOOLBOX_PATTERNS`, `createKnowledgePackManifest`, `createGuidedActionCandidate`.
- Produces: visible sections named `KnowledgePackFactory`, `CockpitDOMAgent`, and `Evidence Boundary` on `/audit-factory`.

- [ ] **Step 1: Add script assertions first**

Modify `scripts/verify-capability-cockpit.mjs` to assert that the rendered/build-inspected cockpit includes:

```javascript
const requiredAuditFactoryTerms = [
  'KnowledgePackFactory',
  'CockpitDOMAgent',
  'Evidence Boundary',
  'candidate/L1 only',
  'Vercel paused',
];
```

Expected behavior: verification fails until `AuditFactoryCockpit.tsx` renders these terms.

- [ ] **Step 2: Update `AuditFactoryCockpit.tsx`**

Add three sections to the existing cockpit without removing current PR #103 content:

```tsx
<section aria-labelledby="knowledge-pack-factory-heading">
  <p className="eyebrow">OpenWiki pattern</p>
  <h2 id="knowledge-pack-factory-heading">KnowledgePackFactory</h2>
  <p>
    Diagnostic knowledge-pack maintenance for agents. It records source commit,
    evidence window, content hash, and stale status without claiming graph truth.
  </p>
</section>

<section aria-labelledby="cockpit-dom-agent-heading">
  <p className="eyebrow">Page Agent pattern</p>
  <h2 id="cockpit-dom-agent-heading">CockpitDOMAgent</h2>
  <p>
    Candidate-only in-page guidance. Actions are indexed, disabled by default,
    and require plan plus critique before they can be presented.
  </p>
</section>

<section aria-labelledby="evidence-boundary-heading">
  <p className="eyebrow">WDC boundary</p>
  <h2 id="evidence-boundary-heading">Evidence Boundary</h2>
  <p>
    This slice is candidate/L1 only. Vercel is paused. No graph writes, Railway
    mutations, claim promotion, runtime proof, or adoption proof are included.
  </p>
</section>
```

- [ ] **Step 3: Run focused verification**

```powershell
npm run verify:capability-cockpit
```

Expected: PASS.

- [ ] **Step 4: Run focused unit tests**

```powershell
npm test -- --run src/features/frontend-toolbox
```

Expected: PASS.

## Task 6: A2A and PR Boundary Execution

**Files:**
- No source file required unless PR body file is created temporarily outside commit scope.

**Interfaces:**
- Consumes: WDC session, claim, BOM id, local diagnostic results.
- Produces: A2A handoff and optional review request.

- [ ] **Step 1: Send A2A handoff**

```powershell
wdc a2a send HANDOFF '{"handoff_type":"OPENWIKI_PAGEAGENT_TOOLBOX_PLAN","track":"gemini-frontend-toolbox/candidate-l1","repo":"C:\\Users\\claus\\Projetcs\\WidgetDC-Gemini-App-frontend-toolbox-orbit","branch":"codex/lin-953-openwiki-pageagent-toolbox","workbom_id":"taskbom:adaptive:f308fc99e504","correlation_id":"corr:adaptive-bom:f308fc99e504","scope":["KnowledgePackFactory","CockpitDOMAgent","EvidenceBoundaryLedger"],"boundary":["candidate/L1 only","Vercel paused","no graph writes","no Railway mutation","no claim promotion"],"next_action":"Implement fixture-backed frontend toolbox catalog and cockpit visibility under /audit-factory."}' --session-id session:96cb8f3ec7cd --json
```

Expected: A2A message id is returned.

- [ ] **Step 2: Send review request after implementation**

```powershell
wdc a2a request-review '{"review_type":"SentinelQA","track":"gemini-frontend-toolbox/candidate-l1","branch":"codex/lin-953-openwiki-pageagent-toolbox","required_checks":["no overclaim","candidate/L1 only","no graph writes","no Railway mutation","no Vercel deploy","proof-boundary rendering"],"review_boundary":"Review may block candidate/L1 PR, but may not claim runtime/adoption proof."}' --session-id session:96cb8f3ec7cd --json
```

Expected: REVIEW_REQUEST message id is returned.

- [ ] **Step 3: Commit source changes through WDC CLI**

```powershell
wdc git commit-local --repo "C:\Users\claus\Projetcs\WidgetDC-Gemini-App-frontend-toolbox-orbit" --paths "docs/frontend/openwiki-pageagent-toolbox.md,src/features/frontend-toolbox/toolboxCatalog.ts,src/features/frontend-toolbox/toolboxCatalog.test.ts,src/features/frontend-toolbox/knowledgePackFactory.ts,src/features/frontend-toolbox/knowledgePackFactory.test.ts,src/features/frontend-toolbox/cockpitDomAgent.ts,src/features/frontend-toolbox/cockpitDomAgent.test.ts,src/components/AuditFactoryCockpit.tsx,scripts/verify-capability-cockpit.mjs" --message "feat: add frontend toolbox pattern contracts"
```

Expected: commit succeeds and includes only listed files.

- [ ] **Step 4: Push branch through WDC CLI**

```powershell
wdc git push-local --repo "C:\Users\claus\Projetcs\WidgetDC-Gemini-App-frontend-toolbox-orbit" --branch codex/lin-953-openwiki-pageagent-toolbox --json
```

Expected: branch is pushed.

## Task 7: PR Candidate/L1 Gate

**Files:**
- PR body only.

**Interfaces:**
- Consumes: pushed branch, diagnostic test results, A2A message ids.
- Produces: draft PR or ready PR as candidate/L1 only.

- [ ] **Step 1: PR body must include these sections**

```markdown
## What

Adds OpenWiki-inspired KnowledgePackFactory and Page-Agent-inspired CockpitDOMAgent contracts to the Gemini App frontend toolbox.

## Boundary

Candidate/L1 only. Vercel is paused. No graph writes, Railway mutation, claim promotion, runtime proof, adoption proof, or world-class-complete claim.

## Verification

- WDC boot session: PASS
- WDC route validate: PASS
- WDC adaptive BOM compose: PASS
- Focused unit tests: PASS/FAIL with exact command output
- Capability cockpit verification: PASS/FAIL with exact command output

## A2A

- Handoff: <message-id>
- Review request: <message-id>

## Linked

- LIN-953
```

- [ ] **Step 2: Open PR through WDC/GitHub route**

Use the existing WDC/GitHub PR creation surface if available. If unavailable, stop and report the missing WDC PR surface instead of falling back to raw `gh` without operator approval.

Expected: PR is opened against `main` as candidate/L1 only.

## Quantitative Acceptance Targets

| Metric | Target |
|---|---:|
| Forbidden overclaim terms outside forbidden-language ledger | 0 |
| UI states above diagnostic/candidate in this slice | 0 |
| Graph writes | 0 |
| Railway mutations | 0 |
| Claim promotions | 0 |
| Vercel deploy/login actions | 0 |
| New frontend toolbox unit tests | >= 6 |
| Required `/audit-factory` visible terms | >= 5 |
| A2A handoff messages | >= 1 |
| A2A review requests | >= 1 |
| WDC BOM/route/session anchors in PR body | >= 3 |

## Stop Conditions

- Stop if WDC boot fails.
- Stop if worktree is dirty before a task starts.
- Stop if WDC work claim reports conflicts.
- Stop if any implementation requires graph write, Railway mutation, Vercel deploy, or claim promotion.
- Stop if a secret value appears in a source file, test, PR body, Linear comment, A2A payload, or log.
- Stop if Page-Agent-inspired code would execute real browser mutations automatically.
- Stop if OpenWiki-inspired code is presented as graph truth or runtime proof.

## Self-Review

- Spec coverage: The plan covers OpenWiki triangulation, Page Agent triangulation, WDC/BOM/A2A governance, Gemini App frontend cockpit visibility, Linear/LIN-953 linkage, and Vercel pause boundary.
- Placeholder scan: No TBD/TODO/fill-in placeholders are used. `<message-id>` is intentionally a runtime value created by WDC A2A after execution.
- Type consistency: `ProofBoundary`, `ToolboxPattern`, `KnowledgePackManifest`, and `GuidedActionCandidate` are defined before they are consumed.
