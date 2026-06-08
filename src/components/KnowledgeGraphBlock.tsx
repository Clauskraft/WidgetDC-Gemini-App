import { GraphCanvas } from "@/components/GraphCanvas";
import type { KnowledgeGraphSpec } from "@/lib/figureBlocks";

/**
 * KnowledgeGraphBlock — stabil renderer til ```knowledge-graph fences.
 * Erstatter Cytoscape-runtime layout med deterministisk radial/layered layout,
 * så ugyldige CSS-farver/plugins ikke kan vælte renderingen.
 */
export function KnowledgeGraphBlock({
  spec,
  onNodeActivate,
}: {
  spec: KnowledgeGraphSpec;
  onNodeActivate?: (nodeId: string, label?: string) => void;
}) {
  return <GraphCanvas spec={spec} variant="knowledge" onNodeActivate={onNodeActivate} />;
}
