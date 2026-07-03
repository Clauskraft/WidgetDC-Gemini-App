# Lovable Cockpit Prototype Prompts

These prompts produce candidate-only examples. They are not direct production
instructions, and they do not authorize backend, graph, Railway, or claim
mutation.

## Prompt 1: Agent Office Mission Cockpit

```text
Build a high-fidelity WidgeTDC Gemini App cockpit for an Agent Office mission.

Input envelope:
- Product: WidgeTDC Gemini App
- Surface: frontend_candidate
- Authority: candidate_only
- Allowed data: metadata_only
- Canonical logo: /wdc-logo.png
- Prohibited actions: backend_write, graph_write, railway_mutation,
  claim_promotion, secret_request, runtime_proof_claim

Visual direction:
- Dark graphite workspace with warm paper panels.
- Use the WDC logo as a small system mark in the top-left.
- Avoid generic SaaS purple gradients.
- Make the cockpit feel like an operations room, not a dashboard template.

Required areas:
- Mission header with objective, branch, session, and current claim boundary.
- Demand ingress strip that shows where the demand came from.
- Capability resolver lane that lists required capabilities before tools.
- Left rail with toolboxes: Brand, Lovable Lab, Graph Integrity, Runtime Proof,
  Deployment Readback, Review.
- Center canvas with capability cards and dependency links.
- Right inspector with selected capability, candidate providers, provider
  scoring, evidence status, risks, and next action.
- Bottom evidence strip with route, A2A, WorkBOM, and readback events.

Required output:
- Component map.
- Required capability matrix.
- Candidate provider matrix.
- Provider scoring matrix.
- State model.
- Data contract.
- Acceptance checks.
- Porting notes for TanStack/Vite/React.
```

## Prompt 2: Data Integrity Visualizer

```text
Create a WidgeTDC frontend prototype that explains data integrity from candidate
idea to runtime proof.

Input envelope:
- Product: WidgeTDC Gemini App
- Surface: frontend_candidate
- Authority: candidate_only
- Allowed data: metadata_only
- Canonical logo: /wdc-logo.png
- Prohibited actions: backend_write, graph_write, railway_mutation,
  claim_promotion, secret_request, runtime_proof_claim

Required flow:
- Candidate generation.
- CapabilityResolver.
- RequiredCapabilities.
- CandidateProviders.
- ProviderScoring.
- Intake envelope.
- Local port.
- WDC CLI route validation.
- Work claim.
- PR review.
- Deploy SHA readback.
- Runtime evidence.
- Claim boundary.

Design constraints:
- Use explicit "candidate", "diagnostic", and "runtime" badges.
- Never imply runtime proof for candidate content.
- Include a risk ledger that shows blocked, accepted, and deferred items.

Required output:
- Component map.
- Required capability matrix.
- Candidate provider matrix.
- Provider scoring matrix.
- State model.
- Data contract.
- Acceptance checks.
- Porting notes.
```

## Prompt 3: Capability Toolbox Library

```text
Design a WidgeTDC capability toolbox library for Gemini App.

Input envelope:
- Product: WidgeTDC Gemini App
- Surface: frontend_candidate
- Authority: candidate_only
- Allowed data: metadata_only
- Canonical logo: /wdc-logo.png
- Prohibited actions: backend_write, graph_write, railway_mutation,
  claim_promotion, secret_request, runtime_proof_claim

Toolboxes:
- Capability Resolver.
- Provider Scoring.
- Brand System.
- Lovable Candidate Lab.
- Vercel Deployment Readback.
- Claude Review Input.
- Codex Implementation.
- Graph Integrity.
- Runtime Proof.
- Claim Boundary.

Each toolbox card must show:
- Purpose.
- Allowed inputs.
- Prohibited actions.
- Evidence emitted.
- Owner lane.
- Acceptance gate.
- Failure mode.
- Whether it is candidate, diagnostic, runtime, or claim evidence.

Required output:
- Component map.
- Required capability matrix.
- Candidate provider matrix.
- Provider scoring matrix.
- State model.
- Data contract.
- Acceptance checks.
- Porting notes.
```
