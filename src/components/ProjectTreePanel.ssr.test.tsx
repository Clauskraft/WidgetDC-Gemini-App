import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectTreePanel } from "@/components/ProjectTreePanel";
import { agentOfficeProductionLoop } from "@/lib/agentOfficeProductionLoop";

describe("ProjectTreePanel", () => {
  it("renders required start and closeout refs", () => {
    const html = renderToString(
      <ProjectTreePanel refs={agentOfficeProductionLoop.projectTreeRefs} phase="activity_start" />,
    );

    expect(html).toContain("ProjectTree");
    expect(html).toContain("CFG-010");
    expect(html).toContain("BOM-020");
    expect(html).toContain("OP-030");
    expect(html).toContain("GATE-040");
    expect(html).toContain("candidate-only");
  });
});
