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
    expect(html).toContain("Resizable workspace");
    expect(html).toContain("Resize right workspace panel");
    expect(html).toContain("Mission Control v2: Demand-to-Route Composer");
    expect(html).toContain("Demand-to-Route Composer");
    expect(html).toContain("Provider Package Drawer");
    expect(html).toContain("Multi-provider prototype builder contracts");
    expect(html).toContain("Selected graph object");
    expect(html).toContain("Chat state contract");
    expect(html).toContain("pending");
    expect(html).toContain("streaming");
    expect(html).toContain("complete");
    expect(html).toContain("error");
    expect(html).toContain("Capability Library and recipe composer");
    expect(html).toContain("Capability Library");
    expect(html).toContain("Compose");
    expect(html).toContain("Activate blocked");
    expect(html).toContain("ApprovalGatePanel");
    expect(html).toContain("candidate-only");
    expect(html).toContain("System status");
    expect(html).toContain("Boot");
    expect(html).toContain("Session");
    expect(html).toContain("Proof");
    expect(html).toContain("Not runtime proof");
    expect(html).toContain("Open Agent Office command palette");
    expect(html).toContain("Readable process cards");
    expect(html).toContain("BrokerageRouteCard");
    expect(html).toContain("WidgetSlot");
    expect(html).toContain("approval.gated.execution");
    expect(html).toContain("graph_write_allowed=false");
    expect(html).toContain("ProjectTree");
    expect(html).toContain("Start frame");
    expect(html).toContain("Closeout frame");
    expect(html).toContain("Object inspector");
    expect(html).toContain("candidate_recipe");
    expect(html).toContain("Next safe action");
    expect(html).toContain("World-class contract");
    expect(html).toContain("not_world_class");
    expect(html).toContain("P0 defects 0");
    expect(html).toContain("ProofGate");
    expect(html).toContain("no raw JSON default");
    expect(html).toContain("Chat surface");
  });
});
