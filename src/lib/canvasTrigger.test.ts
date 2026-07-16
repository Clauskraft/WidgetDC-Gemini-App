import { describe, expect, it } from "vitest";
import { shouldAutoOpenCanvas, structuredBlockCount } from "./canvasTrigger";

/**
 * GF-PR3 trigger contract (P2: canvas is the answer's shadow): auto-open when
 * the completed assistant message contains ≥1 non-text figure block, judged by
 * the SAME parser that renders (parseBlocks) — detection can never disagree
 * with rendering.
 */
describe("canvasTrigger", () => {
  it("plain prose never opens the canvas", () => {
    expect(shouldAutoOpenCanvas("Bare et almindeligt svar med tekst.")).toBe(false);
    expect(structuredBlockCount("tekst")).toBe(0);
  });

  it("a mermaid fence opens the canvas", () => {
    const text = "Her er processen:\n```mermaid\ngraph TD; A-->B;\n```\nFærdig.";
    expect(shouldAutoOpenCanvas(text)).toBe(true);
    expect(structuredBlockCount(text)).toBe(1);
  });

  it("chart, flow, graph and knowledge-graph fences all open the canvas", () => {
    expect(
      shouldAutoOpenCanvas(
        '```chart\n{"type":"bar","data":{"labels":["a"],"datasets":[{"data":[1]}]}}\n```',
      ),
    ).toBe(true);
    expect(shouldAutoOpenCanvas("```flow\nA -> B\n```")).toBe(true);
    expect(
      shouldAutoOpenCanvas('```graph\n{"nodes":[{"id":"a","label":"A"}],"edges":[]}\n```'),
    ).toBe(true);
  });

  it("inline code and normal fences do NOT open the canvas", () => {
    expect(shouldAutoOpenCanvas("Brug `npm test` og:\n```bash\nnpm run dev\n```")).toBe(false);
    expect(shouldAutoOpenCanvas("```ts\nconst a = 1;\n```")).toBe(false);
  });

  it("graph-error blocks count as structure (the error UI is worth surfacing)", () => {
    const text = '```graph\n{"nodes": "ugyldigt"}\n```';
    expect(shouldAutoOpenCanvas(text)).toBe(true);
  });
});
