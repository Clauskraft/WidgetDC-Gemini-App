import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { resolveAgentOfficeProductionLoop } from "@/lib/agentOfficeProductionLoop";
import { buildAgentOfficeStatus } from "@/lib/agentOfficeStatus";
import { WORK_MODES } from "@/lib/workModes";
import { AgentOfficeCommandPalette } from "./AgentOfficeCommandPalette";

describe("AgentOfficeCommandPalette", () => {
  it("server-renders mode and workspace commands when opened", () => {
    const html = renderToString(
      <AgentOfficeCommandPalette
        modes={WORK_MODES}
        activeModeId="general"
        status={buildAgentOfficeStatus(resolveAgentOfficeProductionLoop("general"))}
        onSelectMode={vi.fn()}
        onCopyPrompt={vi.fn()}
        defaultOpen
      />,
    );

    expect(html).toContain("Agent Office command palette");
    expect(html).toContain("Build App");
    expect(html).toContain("Write Book");
    expect(html).toContain("Focus canvas");
    expect(html).toContain("Show WDC objects");
    expect(html).toContain("Proof");
    expect(html).toContain("Not runtime proof");
  });
});
