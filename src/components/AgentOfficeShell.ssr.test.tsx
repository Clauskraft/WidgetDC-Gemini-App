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
    expect(html).toContain("Readable process cards");
    expect(html).toContain("ProjectTree");
    expect(html).toContain("ProofGate");
    expect(html).toContain("no raw JSON default");
    expect(html).toContain("Chat surface");
  });
});
