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
    expect(html).toContain("UX diagnostic evidence");
    expect(html).toContain("User evidence pending");
    expect(html).toContain("reviewers 0");
    expect(html).toContain("external 0/3");
    expect(html).toContain("boundary defects 0");
    expect(html).toMatch(/search \d+\/\d+/);
    expect(html).toContain("recipes 3/3");
    expect(html).toContain("stops 1/1");
    expect(html).toContain("proof-ready");
    expect(html).toContain("proof-pending");
    expect(html).toContain("requires user_evidence");
    expect(html).toContain("requires runtime_proof");
    expect(html).toContain("Evidence gates 1/3");
    expect(html).toContain("Human task success");
    expect(html).toContain("Runtime proof readback");
    expect(html).toContain("observed diagnostic_only");
    expect(html).toContain("External review readiness 1/3");
    expect(html).toContain("Claude Design");
    expect(html).toContain("v0 by Vercel");
    expect(html).toContain("Figma Make");
    expect(html).toContain("candidate_only external inputs");
    expect(html).toContain("login_required");
  });
});
