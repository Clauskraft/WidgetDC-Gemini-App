import {
  summarizeOperationalLedgers,
  summarizeProofGate,
  type AgentOfficeProductionLoopModel,
} from "@/lib/agentOfficeProductionLoop";
import type { WorkMode, WorkModeId } from "@/lib/workModes";

export type AgentOfficeStatusState = "ok" | "attention" | "blocked";

export type AgentOfficeStatusItem = {
  id: "boot" | "session" | "proof";
  label: string;
  value: string;
  state: AgentOfficeStatusState;
  detail: string;
};

export type AgentOfficeStatusSummary = {
  overall: AgentOfficeStatusState;
  items: AgentOfficeStatusItem[];
  proofBoundary: string;
};

export type AgentOfficeCommand =
  | {
      id: `mode:${WorkModeId}`;
      group: "Modes";
      label: WorkMode["label"];
      detail: string;
      action: "select-mode";
      modeId: WorkModeId;
    }
  | {
      id: "copy-prompt" | "focus-canvas" | "show-wdc-objects";
      group: "Actions";
      label: string;
      detail: string;
      action: "copy-prompt" | "focus-canvas" | "show-wdc-objects";
    };

export function buildAgentOfficeStatus(
  model: AgentOfficeProductionLoopModel,
): AgentOfficeStatusSummary {
  const proofSummary = summarizeProofGate(model.proofGate);
  const operationalSummary = summarizeOperationalLedgers(model);
  const sessionState: AgentOfficeStatusState =
    operationalSummary.claimGatedExecutionCount > 0 ? "ok" : "attention";
  const proofState: AgentOfficeStatusState = model.proofGate.runtimeProof ? "ok" : "attention";

  const items: AgentOfficeStatusItem[] = [
    {
      id: "boot",
      label: "Boot",
      value: "Ready",
      state: "ok",
      detail:
        "WDC boot, route validation and adaptive BOM readback are required before source edits.",
    },
    {
      id: "session",
      label: "Session",
      value: sessionState === "ok" ? "Claim gated" : "Needs claim",
      state: sessionState,
      detail:
        sessionState === "ok"
          ? `${operationalSummary.claimGatedExecutionCount} execution step keeps claimed-scope protection visible.`
          : "Source mutation must be protected by a WDC session and claim before editing.",
    },
    {
      id: "proof",
      label: "Proof",
      value: model.proofGate.runtimeProof ? "Runtime proof" : "Not runtime proof",
      state: proofState,
      detail: `${proofSummary.passedVerifications}/${proofSummary.requiredPasses} verification passes with ${proofSummary.presentCount}/${proofSummary.presentCount + proofSummary.missingCount} evidence items present.`,
    },
  ];

  return {
    overall: items.some((item) => item.state === "blocked")
      ? "blocked"
      : items.some((item) => item.state === "attention")
        ? "attention"
        : "ok",
    items,
    proofBoundary: model.proofGate.boundary,
  };
}

export function buildAgentOfficeCommands(modes: WorkMode[]): AgentOfficeCommand[] {
  return [
    ...modes.map(
      (mode): AgentOfficeCommand => ({
        id: `mode:${mode.id}`,
        group: "Modes",
        label: mode.label,
        detail: mode.description,
        action: "select-mode",
        modeId: mode.id,
      }),
    ),
    {
      id: "copy-prompt",
      group: "Actions",
      label: "Copy mode prompt",
      detail: "Place the active work-mode prompt on the clipboard.",
      action: "copy-prompt",
    },
    {
      id: "focus-canvas",
      group: "Actions",
      label: "Focus canvas",
      detail: "Move attention to the visual workspace.",
      action: "focus-canvas",
    },
    {
      id: "show-wdc-objects",
      group: "Actions",
      label: "Show WDC objects",
      detail: "Jump to ProjectTree, BOM, proof and gap cards.",
      action: "show-wdc-objects",
    },
  ];
}
