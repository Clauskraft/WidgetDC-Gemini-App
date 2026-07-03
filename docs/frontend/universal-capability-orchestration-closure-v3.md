# WDC Universal Capability Orchestration Closure v3

## Executive Verdict

The frontend architecture must shift from tool-first routing to
capability-first orchestration.

The correct chain is:

```text
DemandIngress
-> CapabilityResolver
-> RequiredCapabilities
-> CandidateProviders
-> ProviderScoring
-> Adaptive BOM / WorkBOM / TaskBOM
-> Route / ProjectTree
-> Execution Surface
-> ProofReceipt / EventSpine / Graph Readback
-> CapabilityRegistry update
```

Gemini App is a demand and proof-visibility surface. It must not be treated as
the orchestration authority, graph truth authority, or claim-promotion surface.

## Current Runtime Readback

Observed through WDC CLI during this slice:

- `wdc health --json`: platform health returned `ok: true`.
- Capability count is intentionally not a static frontend claim; refresh through
  `wdc status --json` before citing.
- Railway backend commit readback: `3b3621527c8733cbfa701bfb6d32b5fa20cf9ec8`.
- `wdc route-validate`: route was valid, fallback LLM path for the broad
  triangulation prompt.
- `wdc call adaptive_bom.compose`: returned staging-only BOM,
  `claim_maturity_ceiling: L1`, `graph_promoted: false`,
  `claims_mutated: false`.
- `adaptive_bom.compose` correlation id:
  `corr:adaptive-bom:18b657cb90b3`.
- `adaptive_bom.compose` workflow id:
  `workflow:adaptive-bom:18b657cb90b3`.
- `wdc call reason_deeply`: quality gate passed with score `0.882`.
- `wdc orbit universal-capability-ingress-readback-v1 --json`: returned
  read-only activation with `graph_writes: 0`, `claim_promotion: false`, and
  `runtime_write_allowed: false`.

If older notes cite different counts or commits, this WDC CLI readback wins for
this slice.

## Demand Ingress Matrix

| Surface | Role | First gate | Evidence class | Privileged |
| --- | --- | --- | --- | --- |
| WDC CLI | Authoritative command and route execution surface | CapabilityResolver | diagnostic | no |
| WDC CLI Chat | Interactive demand capture and review | CapabilityResolver | candidate | no |
| Gemini App | UX for demand, capability visibility, and proof readback | CapabilityResolver | candidate | no |
| Orbit | Runtime surface when WDC readback proves gates | CapabilityResolver | runtime | no |
| Lovable | Candidate-only design generation | CapabilityResolver | candidate | no |
| A2A | Typed coordination and handoff | CapabilityResolver | diagnostic | no |
| API/MCP route | Programmatic demand surface | CapabilityResolver | diagnostic/runtime | no |
| DeskSmith/PageSmith | Future interaction surfaces | CapabilityResolver | candidate/runtime if proven | no |

## Demand-To-Capability Matrix

| Demand | Required capabilities | Candidate providers | Required proof |
| --- | --- | --- | --- |
| Write a business letter | text generation, document formatting, tone control, user review | WDC CLI Chat, Gemini App, DeskSmith | user review, document contract |
| Analyze a repo and suggest harvest candidates | repo read, classification, pattern extraction, HarvestLine admission, PatternFactory generation | WDC CLI, Orbit, PatternFactory, HarvestLine | ProjectRootAdmissionGate, PatternFactoryRuntimeGate, HarvestLine state |
| Run multi-repo subagent orchestration | repo admission, session/claim coordination, subagent dispatch, A2A readback, project tree | Orbit, WDC Agent Office, WDC CLI | ProjectRootAdmissionGate, session claims, A2A readback |
| Turn a source into graph truth | candidate validation, preview, exact approval, materializer apply, EventSpine replay, graph readback | HarvestLine materializer, competence graph materializer | preview, approval, EventSpine replay, graph readback |
| Generate frontend cockpit prototypes | prototype generation, brand rendering, UI porting, evidence boundary rendering | Lovable, Gemini App, Codex | candidate envelope, component map, porting notes |

## Required Capability Set

The Gemini App frontend now needs these visible capabilities:

- `CapabilityResolver`: resolves demand before route selection.
- `RequiredCapabilities`: displays the capability set needed for the demand.
- `CandidateProviders`: lists possible providers without privileging surfaces.
- `ProviderScoring`: scores fit, proof, cost, latency, risk, and compliance.
- `BOMRoutePreview`: shows Adaptive BOM / WorkBOM / TaskBOM before execution.
- `ProofLedger`: separates candidate, diagnostic, runtime, and claim evidence.
- `ClaimBoundary`: prevents UI copy from overstating proof level.
- `ProviderAdmission`: shows blocked, admitted, or preservation-required state.

## Candidate Provider Matrix

| Provider | Fit | Risk | Runtime status | Frontend role |
| --- | --- | --- | --- | --- |
| WDC CLI | route, boot, Agent Office, readback | read-only to gated write | runtime read-only/apply gated | authoritative readback source |
| WDC CLI Chat | user demand and review | draft | candidate | demand surface |
| Gemini App | UX and proof visibility | draft | candidate | non-privileged cockpit |
| Orbit | runtime route surface | read-only | runtime read-only | route/readback source |
| Lovable | prototype generation | draft | candidate | candidate lab |
| Claude review | critique and review | draft | candidate/review evidence | non-blocking unless restored |
| Vercel | deploy/readback UX patterns | diagnostic | runtime if verified | deployment evidence pattern source |
| PatternFactory | pattern candidates | read-only | runtime read-only if gate passes | pattern source |
| HarvestLine | source admission/materializer preview | staged write | apply gated | source-to-candidate path |
| Governed materializer | graph apply | production write | apply gated | never frontend-owned |

## Provider Scoring

Default frontend scoring weights:

| Dimension | Weight |
| --- | --- |
| Capability fit | `0.32` |
| Proof history | `0.22` |
| Compliance | `0.18` |
| Risk | `0.14` |
| Latency | `0.08` |
| Cost | `0.06` |

This favors capability fit and proof history over convenience. Cost matters,
but it cannot override governance or proof.

## Surface-To-Route Mapping

| Surface | Route behavior |
| --- | --- |
| Gemini App | Capture demand, render resolver output, show proof boundary |
| Lovable | Generate candidate components only through intake envelope |
| WDC CLI | Execute boot, route, BOM, readback, and governed writes |
| Orbit | Read-only runtime activation and route visibility unless apply gates prove otherwise |
| A2A | Coordination, blockers, handoffs, review, signoff |
| Materializers | Apply only after preview, exact approval, EventSpine, graph readback |

## Gemini UX Contract

Gemini App must render:

- Demand ingress.
- Capability resolver.
- Required capability list.
- Candidate provider matrix.
- Provider scoring.
- BOM/route preview.
- Execution surface boundary.
- Proof ledger.
- Claim boundary.

Gemini App must not:

- Promote claims.
- Perform graph writes.
- Treat Lovable candidates as runtime proof.
- Treat review signoff as deploy proof.
- Treat deploy readback as graph proof.
- Treat graph readback as claim promotion.

## Gaps Found

- The earlier frontend toolbox plan was route-aware but not sufficiently
  capability-first.
- Lovable intake lacked explicit `RequiredCapabilities` and `ProviderScoring`.
- Gemini App lacked a typed frontend model for provider scoring.
- Proof UX had not yet separated candidate, diagnostic, runtime, and claim
  evidence as first-class concepts.
- Orbit was referenced as a runtime surface but needed explicit read-only
  boundary language.

## Innovations Added

- Typed capability orchestration model in
  `src/lib/capabilityOrchestration.ts`.
- Capability-first resolver panel in
  `src/components/CapabilityResolverPanel.tsx`.
- Provider scoring weights that favor fit and proof over convenience.
- UX contract that makes Gemini App a cockpit, not an authority.
- Lovable candidate boundary aligned with RequiredCapabilities and proof class.
- Explicit stop conditions for dirty/unadmitted repos, missing capability
  mapping, missing approval, and claim ceiling violations.

## Materializer Boundary

Materializer apply remains outside the frontend.

Frontend may show:

- Preview status.
- Approval requirements.
- EventSpine replay status.
- Graph readback status.

Frontend may not execute:

- Production graph writes.
- Claim promotion.
- Railway mutation.
- Secret handling.

## Claims Boundary

This slice remains `L1` candidate/code-level work until normal PR, CI, merge,
deploy, runtime readback, and proof gates are completed. No claim promotion is
part of this slice.

## Next Executable Slice

Build a visible route in Gemini App that renders `CapabilityResolverPanel` with
fixture-only data, then wire live WDC readback in a separate governed slice.

Acceptance:

- The panel is visible in the app shell or a dedicated cockpit route.
- Evidence badges are visible for candidate, diagnostic, runtime, and claim.
- No live write path exists.
- No claim promotion exists.
- The Lovable candidate import path requires capability and provider metadata.

## A2A Handoff

Handoff boundary:

- Target repo:
  `C:\Users\claus\Projetcs\WidgetDC-Gemini-App-frontend-toolbox-orbit`
- Branch: `codex/lin-953-gemini-frontend-toolbox-orbit`
- Active session: `session:cb2ca2b371a7`
- Active claims: `claim:2b06c2f6d466`, `claim:1bdb4de43217`
- No graph writes.
- No claim promotion.
- No Railway mutation.
