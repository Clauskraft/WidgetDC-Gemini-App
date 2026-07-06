import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentOfficeShell } from "./AgentOfficeShell";

describe("AgentOfficeShell", () => {
  it("server-renders a chat-first shell with secondary workspace panels", () => {
    const html = renderToString(
      <AgentOfficeShell>
        <div>Chat surface</div>
      </AgentOfficeShell>,
    );

    for (const label of ["General", "Build App", "Write Book", "Investigate", "Operate WDC"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Figma Product Surface v1 synced");
    expect(html).toContain("Figma Product Surface v1");
    expect(html).toContain("https://www.figma.com/design/mlnm4xnjrO0aEgVJ7erb6d");
    expect(html).toContain("Desktop node 2:2");
    expect(html).toContain("Mobile node 2:139");
    expect(html).toContain("WDC CLI toolbox");
    expect(html).toContain("wdc boot session");
    expect(html).toContain("adaptive_bom.compose");
    expect(html).toContain("proof boundary readback");
    expect(html).toContain("no Railway mutation");
    expect(html).toContain("Vercel paused");
    expect(html).toContain("WDC CLI Chat workspace");
    expect(html).toContain("Chat-first operating cockpit");
    expect(html).toContain("Type the demand. WDC resolves the route behind the chat.");
    expect(html).toContain("capability:frontend.chat_first_control_surface.v1");
    expect(html).toContain("Claim ceiling");
    expect(html).toContain("Next safe action");
    expect(html).toContain("Proof boundary and next safe action");
    expect(html).toContain("state_type");
    expect(html).toContain("claim_ceiling");
    expect(html).toContain("next_safe_action");
    expect(html).toContain("recommended_wdc_command");
    expect(html).toContain("evidence_refs");
    expect(html).toContain("deployed_sha pending");
    expect(html).toContain("Design source, WDC toolbox and boundary signals");
    expect(html).toContain("Open canvas");
    expect(html).not.toContain("Optional resizable canvas");
    expect(html).not.toContain("Resize right workspace panel");
    expect(html).not.toContain("Mission Control v2: Demand-to-Route Composer");
    expect(html).not.toContain("Provider Package Drawer");
    expect(html).not.toContain("Selected graph object");
    expect(html).toContain("Chat state contract");
    expect(html).toContain("pending");
    expect(html).toContain("streaming");
    expect(html).toContain("complete");
    expect(html).toContain("error");
    expect(html).not.toContain("Capability Library and recipe composer");
    expect(html).not.toContain("ApprovalGatePanel");
    expect(html).toContain("candidate-only");
    expect(html).toContain("System status");
    expect(html).toContain("Boot");
    expect(html).toContain("Session");
    expect(html).toContain("Proof");
    expect(html).toContain("Not runtime proof");
    expect(html).toContain("Open Agent Office command palette");
    expect(html).toContain("no raw JSON default");
    expect(html).toContain("Chat surface");
  });
});
