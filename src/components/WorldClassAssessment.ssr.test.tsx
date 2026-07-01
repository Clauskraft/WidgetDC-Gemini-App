import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorldClassAssessment } from "@/components/WorldClassAssessment";
import { resolveAgentOfficeProductionLoop } from "@/lib/agentOfficeProductionLoop";
import { buildBrokerageRouteCard } from "@/lib/brokerageRoute";
import { buildCapabilityLibrary } from "@/lib/capabilityLibrary";
import { buildCapabilityRecipe } from "@/lib/capabilityRecipe";
import { buildWorldClassAssessment } from "@/lib/worldClassContract";

describe("WorldClassAssessment", () => {
  it("renders the mathematical contract without claiming world-class prematurely", () => {
    const capabilityEntries = buildCapabilityLibrary();
    const recipe = buildCapabilityRecipe("World-class capability cockpit", capabilityEntries);
    const routeCard = buildBrokerageRouteCard("general");
    const productionLoop = resolveAgentOfficeProductionLoop("general");
    const assessment = buildWorldClassAssessment({
      capabilityEntries,
      recipe,
      routeCard,
      projectTreeRefs: productionLoop.projectTreeRefs,
    });

    const html = renderToString(<WorldClassAssessment assessment={assessment} />);

    expect(html).toContain("World-class contract");
    expect(html).toContain("not_world_class");
    expect(html).toContain("WCI");
    expect(html).toContain("Hard gates");
    expect(html).toContain("P0 defects 0");
    expect(html).toContain("Candidate/mapped separation");
    expect(html).toContain("diagnostic_only");
    expect(html).toContain("visual passed");
    expect(html).toContain("runtime missing_evidence");
    expect(html).toContain("25 KPI targets");
    expect(html).toContain("First useful route");
    expect(html).toContain("Stop harvest");
  });
});
