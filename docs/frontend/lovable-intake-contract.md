# Lovable Intake Contract

## Purpose

Lovable is a candidate-generation surface for complete frontend examples. It is
not the authority for WDC graph truth, runtime proof, claims, approvals, secrets,
or deployment state.

Use Lovable for:

- High-fidelity cockpit prototypes.
- Interaction pattern exploration.
- Visual variants for capability cards, route evidence, inspector panels, and
  graph readback experiences.
- Component structure ideas that can be manually ported into the Gemini App.

Do not use Lovable for:

- Backend writes.
- Graph writes.
- Railway mutation.
- Claim promotion.
- Secret handling.
- Runtime proof.

## Required Input Envelope

Every Lovable prompt should include this envelope:

```json
{
  "product": "WidgeTDC Gemini App",
  "surface": "frontend_candidate",
  "authority": "candidate_only",
  "allowed_data": "metadata_only",
  "canonical_logo": "/wdc-logo.png",
  "capability_first_flow": [
    "DemandIngress",
    "CapabilityResolver",
    "RequiredCapabilities",
    "CandidateProviders",
    "ProviderScoring",
    "BOM/Route",
    "ExecutionSurface",
    "Proof"
  ],
  "prohibited_actions": [
    "backend_write",
    "graph_write",
    "railway_mutation",
    "claim_promotion",
    "secret_request",
    "runtime_proof_claim"
  ],
  "required_output": [
    "required_capabilities",
    "candidate_providers",
    "provider_scoring",
    "component_map",
    "state_model",
    "data_contract",
    "acceptance_checks",
    "porting_notes"
  ]
}
```

## Required Output Envelope

Lovable output is acceptable only when it can be folded back into this structure:

```json
{
  "candidate_id": "lovable-candidate-<date>-<slug>",
  "source": "lovable",
  "claim_level": "candidate_only",
  "asset_inputs": ["/wdc-logo.png"],
  "required_capabilities": [],
  "candidate_providers": [],
  "provider_scoring": [],
  "component_map": [],
  "state_model": {},
  "data_contract": {},
  "acceptance_checks": [],
  "porting_notes": [],
  "open_risks": []
}
```

## Data Integrity Rules

- Candidate UI may display example counts only as fixture data.
- Production counts must come from WDC CLI, governed APIs, or graph readback.
- Candidate IDs must be deterministic and traceable.
- Generated code must be reviewed before entering the Gemini App.
- Generated copy must not upgrade claim level.
- Lovable must not choose tools directly; it proposes candidate providers after
  RequiredCapabilities are explicit.
- Provider scoring must include capability fit, proof history, cost, latency,
  risk, and compliance.

## Sustainable Sequence

1. Prepare a candidate prompt with the input envelope.
2. Generate the Lovable example.
3. Export component map, state model, data contract, and acceptance checks.
4. Export required capabilities, candidate providers, and provider scoring.
5. Port only the selected pattern into Gemini App.
6. Keep provenance in a frontend doc or fixture manifest.
7. Verify through the Gemini App's normal test and review surfaces when the
   implementation slice is ready for validation.
