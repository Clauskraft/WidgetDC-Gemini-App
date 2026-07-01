import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildBrokerageRouteCard } from "@/lib/brokerageRoute";
import { BrokerageRouteCard } from "./BrokerageRouteCard";

describe("BrokerageRouteCard", () => {
  it("renders the demand-to-proof route chain, counts and hard proof stop", () => {
    const html = renderToString(<BrokerageRouteCard card={buildBrokerageRouteCard("operate")} />);

    for (const label of [
      "Demand",
      "Capability",
      "Competence",
      "BOM",
      "RouteOperation",
      "CandidateSystem",
      "WidgetSlot",
      "ProofBoundary",
      "LearningCandidate",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("candidate_count");
    expect(html).toContain("mapped_count");
    expect(html).toContain("graph_readback_only");
    expect(html).toContain("Foundry parity");
    expect(html).toContain("stats_parity_required");
    expect(html).toContain("Widget Foundry source readback");
    expect(html).toContain("candidate_count only");
    expect(html).toContain("candidate_only=true");
    expect(html).toContain("projection_only=true");
    expect(html).toContain("graph_write_allowed=false");
    expect(html).toContain("proof_eligible=false");
    expect(html).toContain("approval.gated.execution");
  });
});
