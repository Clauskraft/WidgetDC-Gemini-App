# OpenWiki and Page Agent Frontend Toolbox

## Status

Candidate/L1 only. This document is not runtime proof, graph truth, deployment proof, adoption proof, or claim promotion evidence.

## Current Context

- PR #103 has been merged into Gemini App main.
- `/audit-factory` exists as the cockpit route for audit/toolbox visibility.
- Lovable project `1170ae84-4e85-4138-95dd-c9c3312b530b` is candidate-only.
- Vercel deploy and login are paused.
- WDC BOM readback for this slice is `taskbom:adaptive:f308fc99e504`.
- WDC A2A handoff for the plan is `a2a:32e8903f0703`.

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
| Controller/brain/UI split | CockpitDomAgent contracts | No cockpit command authority |
| Reflection before action | Plan/critique/action proposal | No automatic mutation |
| Visible mask | Candidate action overlay | User-visible only |

## Combined Toolbox Model

| Toolbox | Purpose | Authority |
|---|---|---|
| KnowledgePackFactory | Maintains agent-readable repo knowledge packs from anchored evidence windows | Diagnostic knowledge |
| CockpitDOMAgent | Presents indexed guided action candidates inside the cockpit | Candidate UI assist |
| CandidatePrototypeLab | Folds Lovable/v0/Figma prototypes into demand and provider scoring | Candidate design input |
| EvidenceBoundaryLedger | Labels every visible state as candidate, diagnostic, runtime, or claim | WDC boundary control |
| AgentOfficeA2A | Coordinates handoff, review, blocker, and signoff messages | WDC process control |

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

## Stop Conditions

- Stop if WDC boot fails.
- Stop if worktree is dirty before a task starts.
- Stop if WDC work claim reports conflicts.
- Stop if any implementation requires graph write, Railway mutation, Vercel deploy, or claim promotion.
- Stop if a secret value appears in source, tests, PR body, Linear, A2A, or logs.
- Stop if Page-Agent-inspired code would execute real browser mutations automatically.
- Stop if OpenWiki-inspired code is presented as graph truth or runtime proof.

