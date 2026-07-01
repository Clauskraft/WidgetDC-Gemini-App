import { describe, expect, it } from "vitest";
import { resolveAgentOfficeProductionLoop } from "./agentOfficeProductionLoop";
import { buildWDCObjectCards } from "./wdcObjectCards";

describe("wdcObjectCards", () => {
  it("builds the required WDC visual cards", () => {
    const cards = buildWDCObjectCards(resolveAgentOfficeProductionLoop("operate"));

    expect(cards.map((card) => card.kind)).toEqual(
      expect.arrayContaining([
        "ProjectTreeCard",
        "WorkBOMCard",
        "RouteCard",
        "CapabilityGapCard",
        "AgentTeamCard",
        "ProofGateCard",
        "A2ACard",
        "EvidenceCard",
        "SessionCard",
        "NextActionCard",
      ]),
    );
  });

  it("keeps candidate count and mapped count visually separate", () => {
    const cards = buildWDCObjectCards(resolveAgentOfficeProductionLoop("general"));
    const route = cards.find((card) => card.kind === "RouteCard");
    const agentTeam = cards.find((card) => card.kind === "AgentTeamCard");

    expect(route?.metrics.map((metric) => metric.label)).toEqual(
      expect.arrayContaining(["Candidates", "Mapped edges"]),
    );
    expect(agentTeam?.metrics.map((metric) => metric.label)).toEqual(
      expect.arrayContaining(["Candidates", "Mapped", "Debt"]),
    );
  });

  it("does not overclaim runtime proof", () => {
    const cards = buildWDCObjectCards(resolveAgentOfficeProductionLoop("app"));
    const proof = cards.find((card) => card.kind === "ProofGateCard");
    const a2a = cards.find((card) => card.kind === "A2ACard");

    expect(proof?.status).toBe("not runtime proof");
    expect(proof?.proofBoundary).toContain("not runtime proof");
    expect(a2a?.status).toBe("candidate");
  });
});
