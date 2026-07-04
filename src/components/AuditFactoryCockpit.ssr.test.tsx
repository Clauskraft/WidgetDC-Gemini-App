import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuditFactoryCockpit } from "@/components/AuditFactoryCockpit";

describe("AuditFactoryCockpit", () => {
  it("renders the audit factory cockpit without hiding proof boundaries", () => {
    const html = renderToString(<AuditFactoryCockpit />);

    expect(html).toContain("Audit Factory Cockpit");
    expect(html).toContain("Current WDC status");
    expect(html).toContain("3353db0e901c");
    expect(html).toContain("431 active");
    expect(html).toContain("1 unstable");
    expect(html).toContain("Recent sample also observed: 432 active");
    expect(html).toContain("AuditForeman handoff a2a:fbf97570bfb5");
    expect(html).toContain("SentinelQA request a2a:5df2194e3801");
    expect(html).toContain("DemandIngress");
    expect(html).toContain("RequiredCapabilities");
    expect(html).toContain("CandidateProviders");
    expect(html).toContain("Audit Factory Dashboard");
    expect(html).toContain("Project Root Admission View");
    expect(html).toContain("Graph Hygiene View");
    expect(html).toContain("Local Tool Capability View");
    expect(html).toContain("SentinelQA Verdict Panel");
    expect(html).toContain("FrontendGapBlock list");
    expect(html).toContain("CockpitReadbackCandidate list");
    expect(html).toContain("UXProofBlock list");
    expect(html).toContain("Next safe action:");
    expect(html).toContain("WDC CLI and Agent Office remain the authority");
    expect(html).toContain("Candidate rows are projection/inventory only.");
    expect(html).toContain("Release of session:f05e736480c0 failed");
  });
});
