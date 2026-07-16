/**
 * GF-PR4: shared (client-safe) whitelist for UI interaction receipts.
 *
 * The adoption flywheel only accepts what this file names. Interactions are
 * the two feedback-eligible kinds from the backend contract
 * (uiInteractionContract.ts — tool_launch/cockpit_view are observability-only
 * and never cross the browser wire). Producing tools are capped to the two
 * runtime-verified intent pairs; the hint is DERIVED from the tool on the
 * server, never taken from the client.
 */

export const UI_RECEIPT_INTERACTIONS = ["card_drilldown", "fold_out"] as const;
export type UiReceiptInteraction = (typeof UI_RECEIPT_INTERACTIONS)[number];

/** tool → runtime-verified intent hint (the only pairs the surface may claim). */
export const RECEIPT_TOOL_HINTS: Readonly<Record<string, string>> = {
  "kg_rag.query": "intelligence stack",
  "graph.read_cypher": "read from the graph",
};

export interface UiReceiptRequest {
  interaction: UiReceiptInteraction;
  entity_id: string;
  producing_tool: keyof typeof RECEIPT_TOOL_HINTS | string;
  session_id?: string;
}
