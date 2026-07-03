import type { ProofBoundary } from "./toolboxCatalog";

export type GuidedDomAction = "focus" | "click" | "input" | "scroll";

export interface GuidedActionCandidateInput {
  elementIndex: number;
  elementLabel: string;
  action: GuidedDomAction;
  plan: string;
  critique: string;
}

export interface GuidedActionCandidate {
  id: string;
  boundary: Extract<ProofBoundary, "candidate">;
  elementIndex: number;
  elementLabel: string;
  action: GuidedDomAction;
  plan: string;
  critique: string;
  disabledByDefault: true;
  requiresApproval: true;
  mutations: [];
}

export function createGuidedActionCandidate(
  input: GuidedActionCandidateInput,
): GuidedActionCandidate {
  if (input.plan.trim().length === 0 || input.critique.trim().length === 0) {
    throw new Error("Guided actions require both plan and critique text.");
  }

  return {
    id: `guided-action:${input.elementIndex}:${input.action}`,
    boundary: "candidate",
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
