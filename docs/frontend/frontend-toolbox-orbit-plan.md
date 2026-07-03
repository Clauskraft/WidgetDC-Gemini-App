# Frontend Toolbox Orbit Plan

## Scope

Target repo: `C:\Users\claus\Projetcs\WidgetDC-Gemini-App`

Isolated worktree:
`C:\Users\claus\Projetcs\WidgetDC-Gemini-App-frontend-toolbox-orbit`

Branch: `codex/lin-953-gemini-frontend-toolbox-orbit`

Base observed for this isolated worktree: `origin/main` at `c001d682bf87`.

## Hard Guiding Objectives

- Do not disturb the active frontend checkout.
- Use WDC CLI /orbit and Agent Office process gates for coordination.
- Keep Lovable, Claude, Vercel, and Codex outputs as bounded toolboxes.
- Resolve demand into capabilities before choosing routes or tools.
- Preserve data integrity by separating candidate, diagnostic, runtime, and
  claim-grade evidence.
- Make the provided image the canonical WDC frontend logo.
- Add complete examples and contracts before live data wiring.
- Do not perform backend writes, graph writes, Railway mutation, cleanup
  authorization, or claim promotion in this slice.

## Quantitative Stretch Goals

- `100%` of external prototype examples include input and output envelopes.
- `100%` of generated UI candidates carry source and authority metadata.
- `0` backend mutations from frontend prototype generation.
- `0` graph writes from frontend prototype generation.
- `0` claim promotions from frontend prototype generation.
- `4` explicit evidence classes in the UI model: candidate, diagnostic,
  runtime, claim.
- `8` toolbox boundaries documented before live wiring.
- `1` canonical logo source of truth for the frontend.
- `100%` of route recommendations must reference explicit required
  capabilities first.
- `100%` of provider recommendations must include capability fit, proof
  history, cost, latency, risk, and compliance.
- `0` direct Lovable-to-tool execution paths.

## Implemented In This Slice

- Canonical WDC logo asset at `public/wdc-logo.png`.
- Brand constants in `src/lib/wdcBrand.ts`.
- Reusable logo component in `src/components/WdcLogo.tsx`.
- Lovable intake contract in `docs/frontend/lovable-intake-contract.md`.
- Lovable cockpit prototype prompts in
  `docs/frontend/lovable-cockpit-prototype-prompts.md`.
- Toolbox architecture in `docs/frontend/toolbox-architecture.md`.
- Brand contract in `docs/frontend/wdc-brand-contract.md`.
- Universal capability orchestration closure in
  `docs/frontend/universal-capability-orchestration-closure-v3.md`.
- Typed capability orchestration model in
  `src/lib/capabilityOrchestration.ts`.
- Capability resolver panel in
  `src/components/CapabilityResolverPanel.tsx`.

## Next Implementation Slice

Add a visible toolbox registry panel inside the existing Gemini App shell:

- Mount `CapabilityResolverPanel` in a dedicated route or cockpit tab.
- Register toolboxes as typed frontend data.
- Render toolbox cards with authority, allowed inputs, prohibited actions, and
  evidence class.
- Add badges for candidate, diagnostic, runtime, and claim evidence.
- Add fixture-only Lovable candidate cards.
- Keep live graph/deploy readback disabled until a separate WDC-governed slice.

## Stop Conditions

- Existing checkout becomes dirty from this work.
- WDC work claim reports a conflict.
- A tool asks for secrets or backend mutation.
- A candidate tries to present itself as runtime proof.
- A generated artifact cannot be traced back to source and authority metadata.
