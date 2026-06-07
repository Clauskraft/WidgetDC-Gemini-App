import { GraphCanvas } from "@/components/GraphCanvas";
import type { KnowledgeGraphSpec } from "@/lib/figureBlocks";

/**
 * KnowledgeGraphBlock — stabil renderer til ```knowledge-graph fences.
 * Erstatter Cytoscape-runtime layout med deterministisk radial/layered layout,
 * så ugyldige CSS-farver/plugins ikke kan vælte renderingen.
 */
export function KnowledgeGraphBlock({ spec }: { spec: KnowledgeGraphSpec }) {
  return <GraphCanvas spec={spec} variant="knowledge" />;
}
