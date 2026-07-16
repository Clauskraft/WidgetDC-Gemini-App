/**
 * GF-PR3 canvas trigger contract (P2: canvas is the answer's shadow).
 *
 * Auto-open is decided by the SAME parser that renders (parseBlocks in
 * figureBlocks.ts), so detection can never disagree with what the canvas
 * would actually show. Evaluated ONCE per run on the streaming→completed
 * transition — never per-token. graph-error blocks count as structure: the
 * validation UI is exactly what the user should see on the canvas.
 */
import { parseBlocks } from "./figureBlocks";

const STRUCTURED_TYPES = new Set([
  "chart",
  "flow",
  "mermaid",
  "mindmap",
  "svg",
  "figure",
  "graph",
  "knowledge-graph",
  "graph-error",
]);

export function structuredBlockCount(text: string): number {
  if (!text || !text.includes("```")) return 0;
  try {
    return parseBlocks(text).filter((b) => STRUCTURED_TYPES.has(b.type)).length;
  } catch {
    return 0;
  }
}

export function shouldAutoOpenCanvas(text: string): boolean {
  return structuredBlockCount(text) > 0;
}
