import { describe, expect, it } from "vitest";
import { mermaidToDrawio } from "./mermaidToDrawio";

describe("mermaidToDrawio", () => {
  it("konverterer simpelt flowchart med noder + edges", () => {
    const { xml, nodeCount, edgeCount, warning } = mermaidToDrawio(
      `graph TD\nA[Start]-->B{Decision}\nB-->|yes|C((End))\nB-.->D`,
    );
    expect(warning).toBeUndefined();
    expect(nodeCount).toBe(4);
    expect(edgeCount).toBe(3);
    expect(xml).toContain("<mxfile");
    expect(xml).toContain('value="Start"');
    expect(xml).toContain("rhombus"); // Decision
    expect(xml).toContain("ellipse");  // End
    expect(xml).toContain("dashed=1"); // -.-> edge
    expect(xml).toContain('value="yes"'); // edge label
  });

  it("escaper specialtegn i labels", () => {
    const { xml } = mermaidToDrawio(`graph LR\nA["She said <hi>"]-->B`);
    expect(xml).toContain("&lt;hi&gt;");
    expect(xml).toContain("&quot;");
  });

  it("eksporterer placeholder for ikke-flowchart-typer med advarsel", () => {
    const { xml, warning, nodeCount } = mermaidToDrawio(
      `sequenceDiagram\nAlice->>Bob: hej`,
    );
    expect(warning).toMatch(/sequence/);
    expect(nodeCount).toBe(1);
    expect(xml).toContain("<mxfile");
  });

  it("respekterer LR-direction header", () => {
    const { xml } = mermaidToDrawio(`graph LR\nA-->B-->C`);
    expect(xml).toContain("<mxfile");
    // LR betyder noder vandret — første node skal være på x=PAD og næste videre
    expect(xml).toMatch(/x="40"[^>]*y="40"/);
  });
});
