import type { WorkModeId } from "@/lib/workModes";

export type RouteChainStep =
  | "Demand"
  | "Capability"
  | "Competence"
  | "BOM"
  | "RouteOperation"
  | "CandidateSystem"
  | "Provider/Tool/Agent candidates"
  | "WidgetSlot"
  | "ProofBoundary"
  | "LearningCandidate";

export type WidgetSlot = {
  slot_id: string;
  source_ref: string;
  widget_family: "canvas" | "approval" | "cost" | "message" | "observability" | "graph";
  artifact_types: string[];
  embed_strategy: string;
  input_contract: string;
  required_competences: string[];
  provided_competences: string[];
  candidate_only: true;
  projection_only: true;
};

export type ProofBoundary = {
  status: "candidate_projection_not_runtime_proof";
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
  missing_competence: "approval.gated.execution";
  hard_stop: string;
};

export type CandidateSystem = {
  id: string;
  kind: "provider" | "tool" | "agent";
  label: string;
  role: string;
  candidate_only: true;
  projection_only: true;
  proof_eligible: false;
};

export type RouteOperation = {
  operation_id: string;
  label: string;
  method: "read-only resolver projection";
  status: "expected_stop";
  missing_competence: "approval.gated.execution";
  next_action: string;
};

export type PatternProfitProjection = {
  projection_id: string;
  label: string;
  candidate_count: number;
  mapped_count: number;
  mapped_count_source: "graph_readback_only";
  candidate_only: true;
  projection_only: true;
  proof_eligible: false;
};

export type BrokerageRouteCard = {
  id: string;
  title: string;
  mode: WorkModeId;
  route_chain: RouteChainStep[];
  route_operation: RouteOperation;
  candidate_systems: CandidateSystem[];
  widget_slots: WidgetSlot[];
  pattern_profit_projection: PatternProfitProjection;
  proof_boundary: ProofBoundary;
  candidate_count: number;
  mapped_count: number;
  mapped_count_source: "graph_readback_only";
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
  learning_candidate: string;
};

const routeChain: RouteChainStep[] = [
  "Demand",
  "Capability",
  "Competence",
  "BOM",
  "RouteOperation",
  "CandidateSystem",
  "Provider/Tool/Agent candidates",
  "WidgetSlot",
  "ProofBoundary",
  "LearningCandidate",
];

const candidateSystems: CandidateSystem[] = [
  {
    id: "candidate:provider:wdc-resolver",
    kind: "provider",
    label: "Provider candidates",
    role: "Projected provider options only; no provider call is executed.",
    candidate_only: true,
    projection_only: true,
    proof_eligible: false,
  },
  {
    id: "candidate:tool:wdc-cli-readback",
    kind: "tool",
    label: "WDC CLI readback tools",
    role: "Route, BOM, proof and graph-readback surfaces rendered as cards.",
    candidate_only: true,
    projection_only: true,
    proof_eligible: false,
  },
  {
    id: "candidate:agent:foreman",
    kind: "agent",
    label: "ForemanAgent candidate",
    role: "Coordinates demand-to-proof visibility without autonomous execution.",
    candidate_only: true,
    projection_only: true,
    proof_eligible: false,
  },
];

const widgetSlots: WidgetSlot[] = [
  {
    slot_id: "slot:canvas-route-map",
    source_ref: "src/components/CanvasPanel.tsx",
    widget_family: "canvas",
    artifact_types: ["route-chain", "system-map", "proof-boundary"],
    embed_strategy: "right-panel visual canvas projection",
    input_contract: "widgetdc.bridge.v1 candidate artifact envelope",
    required_competences: ["canvas.rendering", "route.visibility"],
    provided_competences: ["visual.workspace", "artifact.preview"],
    candidate_only: true,
    projection_only: true,
  },
  {
    slot_id: "slot:approval-hard-stop",
    source_ref: "src/components/ApprovalQueuePanel.tsx",
    widget_family: "approval",
    artifact_types: ["approval-gap", "expected-stop", "operator-action"],
    embed_strategy: "disabled approval surface until competence exists",
    input_contract: "approval.gated.execution missing-competence marker",
    required_competences: ["approval.gated.execution"],
    provided_competences: ["approval.surface.readback"],
    candidate_only: true,
    projection_only: true,
  },
  {
    slot_id: "slot:message-explanation",
    source_ref: "src/components/MessageContent.tsx",
    widget_family: "message",
    artifact_types: ["human-readable-proof-boundary", "route-explanation"],
    embed_strategy: "chat-adjacent rendered explanation",
    input_contract: "markdown route summary without raw JSON default",
    required_competences: ["message.rendering", "proof.boundary.copy"],
    provided_competences: ["human-readable.route"],
    candidate_only: true,
    projection_only: true,
  },
  {
    slot_id: "slot:observability-readback",
    source_ref: "src/routes/observability.tsx",
    widget_family: "observability",
    artifact_types: ["readback", "candidate-count", "mapped-count"],
    embed_strategy: "library readback surface",
    input_contract: "graph-readback-only mapped_count evidence",
    required_competences: ["readback.rendering", "count.separation"],
    provided_competences: ["candidate.count.visibility", "mapped.count.visibility"],
    candidate_only: true,
    projection_only: true,
  },
];

export function buildBrokerageRouteCard(mode: WorkModeId): BrokerageRouteCard {
  const candidateCount = candidateSystems.length + widgetSlots.length;
  return {
    id: `brokerage-route:${mode}`,
    title: "WDC AI Brokerage route visibility",
    mode,
    route_chain: routeChain,
    route_operation: {
      operation_id: "route-operation:approval-gated-execution",
      label: "Approval-gated execution",
      method: "read-only resolver projection",
      status: "expected_stop",
      missing_competence: "approval.gated.execution",
      next_action: "Expose the approval surface before any provider execution can be offered.",
    },
    candidate_systems: candidateSystems,
    widget_slots: widgetSlots,
    pattern_profit_projection: {
      projection_id: "projection:pattern-profit:route-visibility",
      label: "PatternProfitProjection",
      candidate_count: candidateCount,
      mapped_count: 0,
      mapped_count_source: "graph_readback_only",
      candidate_only: true,
      projection_only: true,
      proof_eligible: false,
    },
    proof_boundary: {
      status: "candidate_projection_not_runtime_proof",
      candidate_only: true,
      projection_only: true,
      graph_write_allowed: false,
      proof_eligible: false,
      missing_competence: "approval.gated.execution",
      hard_stop:
        "Provider/tool/agent candidates and WidgetSlots are planned rendering surfaces only until approval.gated.execution exists.",
    },
    candidate_count: candidateCount,
    mapped_count: 0,
    mapped_count_source: "graph_readback_only",
    candidate_only: true,
    projection_only: true,
    graph_write_allowed: false,
    proof_eligible: false,
    learning_candidate:
      "Brokerage route cards should make demand-to-proof route options visible without turning candidates into proof.",
  };
}
