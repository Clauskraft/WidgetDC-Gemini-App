import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentOfficeShell } from "./AgentOfficeShell";

describe("AgentOfficeShell", () => {
  it("server-renders the required WorkModeSwitcher and object palette", () => {
    const html = renderToString(
      <AgentOfficeShell>
        <div>Chat surface</div>
      </AgentOfficeShell>,
    );

    for (const label of ["General", "Build App", "Write Book", "Investigate", "Operate WDC"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Object palette");
    expect(html).toContain("Capability Library");
    expect(html).toContain("Compose");
    expect(html).toContain("Activate blocked");
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
    expect(html).toContain("ProofGate");
    expect(html).toContain("no raw JSON default");
    expect(html).toContain("Chat surface");
  });
});
