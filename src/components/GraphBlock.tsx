import { GraphCanvas } from "@/components/GraphCanvas";
import type { GraphSpec } from "@/lib/figureBlocks";

/**
 * GraphBlock — robust, dependency-light renderer til ```graph fences.
 * Ingen SSR-følsomme canvas/webgl/layout-imports; alt layout beregnes deterministisk i React.
 */
export function GraphBlock({
  spec,
  onNodeActivate,
}: {
  spec: GraphSpec;
  onNodeActivate?: (nodeId: string, label?: string) => void;
}) {
  return <GraphCanvas spec={spec} variant="graph" onNodeActivate={onNodeActivate} />;
}
