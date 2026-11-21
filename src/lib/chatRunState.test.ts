import { describe, expect, it } from "vitest";
import { chatRunStatePresentation, deriveChatRunState, isActiveChatRunState } from "./chatRunState";

describe("chatRunState", () => {
  it("starts idle before any prompt is submitted", () => {
    expect(
      deriveChatRunState({
        transportStatus: "ready",
        hasSubmittedPrompt: false,
        assistantTextLength: 0,
      }),
    ).toBe("idle");
  });

  it("uses a local sending state before the transport accepts the turn", () => {
    expect(
      deriveChatRunState({
        transportStatus: "ready",
        hasSubmittedPrompt: true,
        assistantTextLength: 0,
        isSending: true,
      }),
    ).toBe("sending");
  });

  it("waits for the first token while submitted or streaming with no assistant text", () => {
    expect(
      deriveChatRunState({
        transportStatus: "submitted",
        hasSubmittedPrompt: true,
        assistantTextLength: 0,
      }),
    ).toBe("waiting_for_first_token");

    expect(
      deriveChatRunState({
        transportStatus: "streaming",
        hasSubmittedPrompt: true,
        assistantTextLength: 0,
      }),
    ).toBe("waiting_for_first_token");
  });

  it("marks the run as streaming after assistant text arrives", () => {
    const state = deriveChatRunState({
      transportStatus: "streaming",
      hasSubmittedPrompt: true,
      assistantTextLength: 24,
    });

    expect(state).toBe("streaming");
    expect(isActiveChatRunState(state)).toBe(true);
  });

  it("surfaces tool work before generic transport states", () => {
    expect(
      deriveChatRunState({
        transportStatus: "submitted",
        hasSubmittedPrompt: true,
        assistantTextLength: 0,
        isToolWorking: true,
      }),
    ).toBe("tool_working");
  });

  it("keeps completed, cancelled and error states distinct", () => {
    expect(
      deriveChatRunState({
        transportStatus: "ready",
        hasSubmittedPrompt: true,
        assistantTextLength: 0,
      }),
    ).toBe("completed");

    expect(
      deriveChatRunState({
        transportStatus: "ready",
        hasSubmittedPrompt: true,
        assistantTextLength: 0,
        wasCancelled: true,
      }),
    ).toBe("cancelled");

    expect(
      deriveChatRunState({
        transportStatus: "error",
        hasSubmittedPrompt: true,
        assistantTextLength: 0,
      }),
    ).toBe("errored");
  });

  it("provides user-facing copy for visible chat status", () => {
    expect(chatRunStatePresentation("waiting_for_first_token")).toMatchObject({
      label: "Venter på første svar",
    });
    expect(chatRunStatePresentation("streaming")).toMatchObject({
      label: "WDC svarer",
      tone: "active",
    });
    expect(chatRunStatePresentation("completed")).toMatchObject({
      label: "Færdig",
    });
    expect(chatRunStatePresentation("cancelled")).toMatchObject({
      detail: "Kørslen blev stoppet.",
    });
    expect(chatRunStatePresentation("errored")).toMatchObject({
      label: "Fejl",
      tone: "danger",
    });
  });
});
