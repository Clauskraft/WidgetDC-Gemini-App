import { describe, expect, it } from "vitest";
import { resolveAgentOfficeProductionLoop } from "@/lib/agentOfficeProductionLoop";
import { buildAgentOfficeCommands, buildAgentOfficeStatus } from "@/lib/agentOfficeStatus";
import { WORK_MODES } from "@/lib/workModes";

describe("agentOfficeStatus", () => {
  it("separates boot, session and proof states without overclaiming runtime proof", () => {
    const status = buildAgentOfficeStatus(resolveAgentOfficeProductionLoop("operate"));

    expect(status.items.map((item) => item.id)).toEqual(["boot", "session", "proof"]);
    expect(status.items.find((item) => item.id === "boot")).toMatchObject({
      label: "Boot",
      value: "Ready",
      state: "ok",
    });
    expect(status.items.find((item) => item.id === "session")).toMatchObject({
      label: "Session",
      value: "Claim gated",
    });
    expect(status.items.find((item) => item.id === "proof")).toMatchObject({
      label: "Proof",
      value: "Not runtime proof",
      state: "attention",
    });
    expect(status.proofBoundary).toContain("not runtime proof");
  });

  it("builds mode and workspace commands for the Agent Office palette", () => {
    const commands = buildAgentOfficeCommands(WORK_MODES);

    expect(commands.map((command) => command.id)).toEqual(
      expect.arrayContaining([
        "mode:general",
        "mode:app",
        "mode:book",
        "mode:investigation",
        "mode:operate",
        "copy-prompt",
        "focus-canvas",
        "show-wdc-objects",
      ]),
    );
  });
});
