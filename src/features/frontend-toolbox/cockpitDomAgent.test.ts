import { describe, expect, it } from "vitest";
import { createGuidedActionCandidate } from "./cockpitDomAgent";

describe("createGuidedActionCandidate", () => {
  it("creates disabled candidate-only UI actions", () => {
    const action = createGuidedActionCandidate({
      elementIndex: 3,
      elementLabel: "Open Audit Factory",
      action: "focus",
      plan: "Move keyboard focus to the Audit Factory navigation item.",
      critique:
        "This is safe because it is a local focus proposal with no graph or network mutation.",
    });

    expect(action.boundary).toBe("candidate");
    expect(action.disabledByDefault).toBe(true);
    expect(action.requiresApproval).toBe(true);
    expect(action.mutations).toEqual([]);
  });

  it("rejects action candidates without plan and critique", () => {
    expect(() =>
      createGuidedActionCandidate({
        elementIndex: 1,
        elementLabel: "Run",
        action: "click",
        plan: "",
        critique: "",
      }),
    ).toThrow("Guided actions require both plan and critique text.");
  });
});
