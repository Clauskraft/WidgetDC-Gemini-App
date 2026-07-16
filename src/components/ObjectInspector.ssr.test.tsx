import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ObjectInspector } from "@/components/ObjectInspector";

// GF-PR1 decoupled ObjectInspector from the deleted synthetic canvas document;
// the generic `item` contract is the only API (GF-PR3 re-homes the component
// inside the unified answer-driven canvas drawer).
describe("ObjectInspector", () => {
  it("renders selected object details and proof boundary", () => {
    const html = renderToString(
      <ObjectInspector
        item={{
          title: "AssemblyBlock 1042",
          type: "graph_node",
          summary: "Typed building block from the knowledge graph.",
          proofBoundary: "Read-back projection — not runtime proof.",
          meta: [
            { label: "canvas", value: "answer-driven" },
            { label: "persistence", value: "local-thread" },
          ],
        }}
      />,
    );

    expect(html).toContain("Object inspector");
    expect(html).toContain("AssemblyBlock 1042");
    expect(html).toContain("graph_node");
    expect(html).toContain("Read-back projection — not runtime proof.");
    expect(html).toContain("local-thread");
  });

  it("renders generic objects with metadata and next safe action", () => {
    const html = renderToString(
      <ObjectInspector
        item={{
          title: "Runtime Truth",
          type: "pattern",
          summary: "Verify claims through live readback.",
          proofBoundary: "Candidate/projection only.",
          nextAction: "Dry-run through WDC Agent Office.",
          meta: [
            { label: "repo", value: "WidgeTDC" },
            { label: "mapped", value: "graph_readback_only" },
          ],
          sections: [
            { label: "requires", value: "proof.boundary" },
            { label: "cost", value: "provider executions=0" },
          ],
        }}
      />,
    );

    expect(html).toContain("Runtime Truth");
    expect(html).toContain("pattern");
    expect(html).toContain("Candidate/projection only.");
    expect(html).toContain("Next safe action");
    expect(html).toContain("graph_readback_only");
    expect(html).toContain("provider executions=0");
  });
});
