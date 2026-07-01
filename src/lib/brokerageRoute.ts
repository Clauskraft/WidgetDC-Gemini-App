import type { WorkModeId } from "@/lib/workModes";
import {
  getWidgetFoundrySourceReadback,
  getRecommendedWidgetSlots,
  type WidgetFoundrySourceReadback,
  type WidgetFoundrySlotCandidate,
} from "@/lib/widgetFoundryBridge";

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
  widget_family: WidgetFoundrySlotCandidate["widget_family"];
  artifact_types: string[];
  embed_strategy: string;
  input_contract: string;
  required_competences: string[];
  provided_competences: string[];
  source_fit_score: number;
  extraction_contract: WidgetFoundrySlotCandidate["extraction_contract"];
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
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
  foundry_source_readback: WidgetFoundrySourceReadback;
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

const widgetSlots: WidgetSlot[] = getRecommendedWidgetSlots().map((slot) => ({
  slot_id: slot.slot_id,
  source_ref: slot.source_ref,
  widget_family: slot.widget_family,
  artifact_types: slot.artifact_types,
  embed_strategy: slot.embed_strategy,
  input_contract: slot.input_contract,
  required_competences: slot.required_competences,
  provided_competences: slot.provided_competences,
  source_fit_score: slot.source_fit_score,
  extraction_contract: slot.extraction_contract,
  candidate_only: true,
  projection_only: true,
  graph_write_allowed: false,
  proof_eligible: false,
}));

export function buildBrokerageRouteCard(mode: WorkModeId): BrokerageRouteCard {
  const candidateCount = candidateSystems.length + widgetSlots.length;
  const foundrySourceReadback = getWidgetFoundrySourceReadback();
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
    foundry_source_readback: foundrySourceReadback,
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
        "Provider/tool/agent candidates and WidgetSlots are planned rendering surfaces only until approval.gated.execution exists. Foundry candidate counts are not mapped graph coverage.",
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
