import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { chatRunStatePresentation } from "@/lib/chatRunState";
import { IntelligenceStrip } from "./IntelligenceStrip";

/**
 * GF-PR2 P1/P5: ONE calm status line. Collapsed by default; segments appear as
 * data arrives; expandable to routing candidates + run detail; at most one
 * contextual action.
 */
describe("IntelligenceStrip", () => {
  it("collapsed line shows run state and nothing else when no intelligence has arrived", () => {
    const html = renderToString(
      <IntelligenceStrip
        state="streaming"
        presentation={chatRunStatePresentation("streaming")}
        reasoning={null}
        sourceCount={0}
        canvasReady={false}
      />,
    );
    expect(html).toContain('data-testid="intelligence-strip"');
    expect(html).toContain(chatRunStatePresentation("streaming").label);
    expect(html).not.toContain("routing to");
    expect(html).not.toContain("sources");
  });

  it("keeps routing internals out of the calm summary", () => {
    const html = renderToString(
      <IntelligenceStrip
        state="completed"
        presentation={chatRunStatePresentation("completed")}
        reasoning={{
          intentTool: "kg_rag.query",
          intentScore: 0.82,
          intentCandidates: ["kg_rag.query", "srag.query"],
        }}
        sourceCount={4}
        canvasReady={true}
      />,
    );
    expect(html).not.toContain("routing to");
    expect(html).not.toContain("kg_rag.query");
    expect(html).not.toContain("0.82");
    expect(html).toMatch(/4<!-- --> kilder|4 kilder/);
    expect(html).toContain("canvas klar");
    expect(html).toContain("Rute");
    expect(html).not.toContain("Evidens");
  });

  it("does not present route-only metadata as evidence", () => {
    const html = renderToString(
      <IntelligenceStrip
        state="completed"
        presentation={chatRunStatePresentation("completed")}
        reasoning={{ intentCandidates: ["kg_rag.query"] }}
        sourceCount={0}
        canvasReady={false}
      />,
    );

    expect(html).toContain("Rute");
    expect(html).not.toContain("Evidens");
    expect(html).not.toContain("kilder");
  });

  it("expanded route detail exposes routing candidates and run detail", () => {
    const html = renderToString(
      <IntelligenceStrip
        state="completed"
        presentation={chatRunStatePresentation("completed")}
        reasoning={{
          intentTool: "kg_rag.query",
          intentScore: 0.82,
          intentCandidates: ["kg_rag.query", "srag.query", "graph.read_cypher"],
        }}
        sourceCount={0}
        canvasReady={false}
        defaultExpanded
      />,
    );
    expect(html).toContain("Rute");
    expect(html).toContain("srag.query");
    expect(html).toContain("graph.read_cypher");
    expect(html).toContain("Intern score");
    expect(html).toContain(chatRunStatePresentation("completed").detail);
  });

  it("renders at most ONE contextual action in the strip (P5)", () => {
    const html = renderToString(
      <IntelligenceStrip
        state="completed"
        presentation={chatRunStatePresentation("completed")}
        reasoning={null}
        sourceCount={0}
        canvasReady={true}
        action={{ label: "Open canvas", onClick: () => {} }}
      />,
    );
    expect(html).toContain("Open canvas");
    const buttonCount = (html.match(/data-testid="strip-action"/g) ?? []).length;
    expect(buttonCount).toBe(1);
  });
});
