export type ChatRunState =
  | "idle"
  | "sending"
  | "waiting_for_first_token"
  | "streaming"
  | "tool_working"
  | "completed"
  | "errored"
  | "cancelled";

export type ChatTransportStatus = "ready" | "submitted" | "streaming" | "error" | string;

export interface ChatRunStateInput {
  transportStatus: ChatTransportStatus;
  hasSubmittedPrompt: boolean;
  assistantTextLength: number;
  isSending?: boolean;
  isToolWorking?: boolean;
  wasCancelled?: boolean;
  error?: unknown;
}

export interface ChatRunStatePresentation {
  label: string;
  detail: string;
  tone: "neutral" | "active" | "success" | "warning" | "danger";
}

export function deriveChatRunState(input: ChatRunStateInput): ChatRunState {
  if (input.error || input.transportStatus === "error") return "errored";
  if (input.wasCancelled) return "cancelled";
  if (input.isToolWorking) return "tool_working";
  if (input.isSending) return "sending";

  if (input.transportStatus === "submitted") return "waiting_for_first_token";

  if (input.transportStatus === "streaming") {
    return input.assistantTextLength > 0 ? "streaming" : "waiting_for_first_token";
  }

  if (input.transportStatus === "ready" && input.hasSubmittedPrompt) return "completed";

  return "idle";
}

export function isActiveChatRunState(state: ChatRunState): boolean {
  return (
    state === "sending" ||
    state === "waiting_for_first_token" ||
    state === "streaming" ||
    state === "tool_working"
  );
}

export function chatRunStatePresentation(
  state: ChatRunState,
  toolDetail = "WDC arbejder med den aktuelle opgave.",
): ChatRunStatePresentation {
  switch (state) {
    case "sending":
      return {
        label: "Sender",
        detail: "Din besked sendes til WDC Chat.",
        tone: "active",
      };
    case "waiting_for_first_token":
      return {
        label: "Venter på første svar",
        detail: "WDC har modtaget opgaven og bygger svaret.",
        tone: "active",
      };
    case "streaming":
      return {
        label: "WDC svarer",
        detail: "Svaret streamer ind.",
        tone: "active",
      };
    case "tool_working":
      return {
        label: "WDC arbejder",
        detail: toolDetail,
        tone: "warning",
      };
    case "completed":
      return {
        label: "Færdig",
        detail: "Sidste svar er afsluttet.",
        tone: "success",
      };
    case "errored":
      return {
        label: "Fejl",
        detail: "WDC Chat stoppede med en fejl.",
        tone: "danger",
      };
    case "cancelled":
      return {
        label: "Stoppet",
        detail: "Kørslen blev stoppet.",
        tone: "neutral",
      };
    case "idle":
    default:
      return {
        label: "Klar",
        detail: "WDC Chat er klar.",
        tone: "neutral",
      };
  }
}
