import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveAgentOfficeProductionLoop } from "@/lib/agentOfficeProductionLoop";
import { buildAgentOfficeStatus } from "@/lib/agentOfficeStatus";
import { SystemStatusPill } from "./SystemStatusPill";

describe("SystemStatusPill", () => {
  it("renders boot, session and proof states as a compact status pill", () => {
    const html = renderToString(
      <SystemStatusPill
        status={buildAgentOfficeStatus(resolveAgentOfficeProductionLoop("operate"))}
      />,
    );

    expect(html).toContain("Boot");
    expect(html).toContain("Ready");
    expect(html).toContain("Session");
    expect(html).toContain("Claim gated");
    expect(html).toContain("Proof");
    expect(html).toContain("Not runtime proof");
  });
});
