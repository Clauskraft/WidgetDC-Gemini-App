export type FoundryCapabilityDomain =
  | "consulting"
  | "strategy"
  | "cyber"
  | "osint"
  | "app-building"
  | "devops"
  | "document"
  | "visual"
  | "governance";

export type WidgetFoundryExtractionContract = {
  extraction_mode: "read_only_widget_foundry_inventory";
  validation_status: "candidate_only";
  source_repo: "widgetdc-consulting-frontend";
  required_fields: ["source_fit_score", "extraction_contract"];
};

export type WidgetFoundryParityStatus = "stats_parity_required" | "graph_readback_aligned";

export type WidgetFoundrySourceReadback = {
  source_repo: "widgetdc-consulting-frontend";
  source_doc_ref: string;
  inventory_contract_ref: string;
  registry_source_ref: string;
  graph_registry_ref: string;
  unsafe_write_surface_ref: string;
  local_component_registry_count: number;
  local_standalone_count: number;
  local_pptx_ready_count: number;
  local_html_embeddable_count: number;
  recommended_slot_candidate_count: number;
  graph_widget_nodes: number;
  graph_ui_component_nodes: number;
  graph_harvested_component_nodes: number;
  mapped_count: number;
  mapped_count_source: "graph_readback_only";
  parity_status: WidgetFoundryParityStatus;
  parity_reason: string;
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
  provider_executions: 0;
};

export type WidgetFoundrySlotCandidate = {
  slot_id: string;
  label: string;
  domain: FoundryCapabilityDomain;
  description: string;
  source_ref: string;
  widget_family:
    | "artifact.canvas"
    | "proof_boundary.data_display"
    | "agent_office.ui_primitive"
    | "visualization.chart"
    | "consulting.marketing_visual";
  artifact_types: string[];
  embed_strategy: string;
  input_contract: string;
  required_competences: string[];
  provided_competences: string[];
  source_fit_score: number;
  extraction_contract: WidgetFoundryExtractionContract;
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
};

const boundary = {
  candidate_only: true,
  projection_only: true,
  graph_write_allowed: false,
  proof_eligible: false,
} as const;

const extraction_contract: WidgetFoundryExtractionContract = {
  extraction_mode: "read_only_widget_foundry_inventory",
  validation_status: "candidate_only",
  source_repo: "widgetdc-consulting-frontend",
  required_fields: ["source_fit_score", "extraction_contract"],
};

export const WIDGET_FOUNDRY_SOURCE_READBACK: WidgetFoundrySourceReadback = {
  source_repo: "widgetdc-consulting-frontend",
  source_doc_ref: "widgetdc-consulting-frontend/docs/WIDGET_FOUNDRY_INVENTORY.md",
  inventory_contract_ref: "widgetdc-consulting-frontend/src/registry/widgetFoundryInventory.ts",
  registry_source_ref: "widgetdc-consulting-frontend/src/registry/componentRegistry.ts",
  graph_registry_ref: "widgetdc-consulting-frontend/src/hooks/useWidgetRegistry.ts",
  unsafe_write_surface_ref: "widgetdc-consulting-frontend/src/registry/harvestComponents.ts",
  local_component_registry_count: 22,
  local_standalone_count: 19,
  local_pptx_ready_count: 15,
  local_html_embeddable_count: 20,
  recommended_slot_candidate_count: 12,
  graph_widget_nodes: 52,
  graph_ui_component_nodes: 2273,
  graph_harvested_component_nodes: 0,
  mapped_count: 0,
  mapped_count_source: "graph_readback_only",
  parity_status: "stats_parity_required",
  parity_reason:
    "Consulting Foundry local registry, Widget registry and graph UIComponent counts are not the same evidence surface; curated component-registry-harvest readback is 0 until governed materialization.",
  provider_executions: 0,
  ...boundary,
};

export const WIDGET_FOUNDRY_SLOT_CANDIDATES: WidgetFoundrySlotCandidate[] = [
  {
    slot_id: "widget.slot.vibe-canvas",
    label: "Vibe canvas",
    domain: "visual",
    description: "Spatial canvas slot for visual thinking, route maps and composed artifacts.",
    source_ref: "widgetdc-consulting-frontend/src/registry/widgetFoundryInventory.ts",
    widget_family: "artifact.canvas",
    artifact_types: ["canvas", "html", "react"],
    embed_strategy: "agent-office-canvas-slot",
    input_contract: "widgetdc.foundry.artifact_slot.v0",
    required_competences: ["canvas.rendering", "artifact.composition"],
    provided_competences: ["widget.vibe_canvas", "visual.workspace"],
    source_fit_score: 0.92,
    extraction_contract,
    ...boundary,
  },
  {
    slot_id: "widget.slot.citation-bar",
    label: "Citation bar",
    domain: "document",
    description: "Compact source and evidence strip for consulting or intelligence artifacts.",
    source_ref: "widgetdc-consulting-frontend/src/registry/componentRegistry.ts",
    widget_family: "proof_boundary.data_display",
    artifact_types: ["report", "html", "pptx"],
    embed_strategy: "artifact-footer-citation-strip",
    input_contract: "widgetdc.foundry.evidence_ref_list.v0",
    required_competences: ["evidence.display", "citation.rendering"],
    provided_competences: ["widget.citation_bar", "source.visibility"],
    source_fit_score: 0.9,
    extraction_contract,
    ...boundary,
  },
  {
    slot_id: "widget.slot.confidence-badge",
    label: "Confidence badge",
    domain: "governance",
    description: "Small visual status element for confidence, readiness and proof boundary.",
    source_ref: "widgetdc-consulting-frontend/src/registry/widgetFoundryInventory.ts",
    widget_family: "proof_boundary.data_display",
    artifact_types: ["badge", "status", "report"],
    embed_strategy: "inline-proof-boundary-badge",
    input_contract: "widgetdc.foundry.confidence_marker.v0",
    required_competences: ["confidence.display", "proof.boundary.copy"],
    provided_competences: ["widget.confidence_badge", "proof_boundary.visibility"],
    source_fit_score: 0.91,
    extraction_contract,
    ...boundary,
  },
  {
    slot_id: "widget.slot.source-footer",
    label: "Source footer",
    domain: "document",
    description: "Report footer for source classes, source refs and projection boundaries.",
    source_ref: "widgetdc-consulting-frontend/docs/WIDGET_FOUNDRY_INVENTORY.md",
    widget_family: "proof_boundary.data_display",
    artifact_types: ["report", "brief", "pptx"],
    embed_strategy: "document-source-footer",
    input_contract: "widgetdc.foundry.source_footer.v0",
    required_competences: ["source.ledger", "document.rendering"],
    provided_competences: ["widget.source_footer", "evidence.boundary"],
    source_fit_score: 0.87,
    extraction_contract,
    ...boundary,
  },
  {
    slot_id: "widget.slot.streaming-renderer",
    label: "Streaming renderer",
    domain: "app-building",
    description: "Agent Office primitive for streaming status and progressive artifact rendering.",
    source_ref: "widgetdc-consulting-frontend/src/registry/componentRegistry.ts",
    widget_family: "agent_office.ui_primitive",
    artifact_types: ["react", "stream", "status"],
    embed_strategy: "chat-adjacent-progressive-renderer",
    input_contract: "widgetdc.foundry.stream_chunk.v0",
    required_competences: ["stream.rendering", "agent.status"],
    provided_competences: ["widget.streaming_renderer", "agent_office.feedback"],
    source_fit_score: 0.88,
    extraction_contract,
    ...boundary,
  },
  {
    slot_id: "widget.slot.stat-box",
    label: "Stat box",
    domain: "consulting",
    description: "Executive metric box for size-of-prize, risk and route readiness signals.",
    source_ref: "widgetdc-consulting-frontend/src/registry/widgetFoundryInventory.ts",
    widget_family: "visualization.chart",
    artifact_types: ["metric", "dashboard", "pptx"],
    embed_strategy: "executive-metric-tile",
    input_contract: "widgetdc.foundry.metric_card.v0",
    required_competences: ["metric.rendering", "executive.summary"],
    provided_competences: ["widget.stat_box", "kpi.visibility"],
    source_fit_score: 0.89,
    extraction_contract,
    ...boundary,
  },
  {
    slot_id: "widget.slot.progress-bar",
    label: "Progress bar",
    domain: "governance",
    description: "Simple completion indicator for ProjectTree and proof-gate progress.",
    source_ref: "widgetdc-consulting-frontend/src/registry/componentRegistry.ts",
    widget_family: "agent_office.ui_primitive",
    artifact_types: ["status", "workflow", "progress"],
    embed_strategy: "project-tree-progress-indicator",
    input_contract: "widgetdc.foundry.progress_state.v0",
    required_competences: ["state.rendering", "workflow.visibility"],
    provided_competences: ["widget.progress_bar", "project_tree.feedback"],
    source_fit_score: 0.86,
    extraction_contract,
    ...boundary,
  },
  {
    slot_id: "widget.slot.tracker",
    label: "Tracker",
    domain: "governance",
    description: "Ledger-oriented tracker for blockers, expected stops and closeout items.",
    source_ref: "widgetdc-consulting-frontend/docs/WIDGET_FOUNDRY_INVENTORY.md",
    widget_family: "agent_office.ui_primitive",
    artifact_types: ["ledger", "workflow", "status"],
    embed_strategy: "compact-ledger-tracker",
    input_contract: "widgetdc.foundry.ledger_rows.v0",
    required_competences: ["ledger.rendering", "stop_condition.visibility"],
    provided_competences: ["widget.tracker", "closeout.visibility"],
    source_fit_score: 0.88,
    extraction_contract,
    ...boundary,
  },
  {
    slot_id: "widget.slot.bar-chart",
    label: "Bar chart",
    domain: "visual",
    description: "Simple comparative chart for capability coverage and KPI readback.",
    source_ref: "widgetdc-consulting-frontend/src/registry/componentRegistry.ts",
    widget_family: "visualization.chart",
    artifact_types: ["chart", "dashboard", "report"],
    embed_strategy: "responsive-chart-panel",
    input_contract: "widgetdc.foundry.series_comparison.v0",
    required_competences: ["chart.rendering", "comparison.analysis"],
    provided_competences: ["widget.bar_chart", "comparison.visibility"],
    source_fit_score: 0.87,
    extraction_contract,
    ...boundary,
  },
  {
    slot_id: "widget.slot.donut-chart",
    label: "Donut chart",
    domain: "visual",
    description: "Share-of-total visual for evidence composition and capability mix.",
    source_ref: "widgetdc-consulting-frontend/src/registry/componentRegistry.ts",
    widget_family: "visualization.chart",
    artifact_types: ["chart", "dashboard", "brief"],
    embed_strategy: "compact-share-chart",
    input_contract: "widgetdc.foundry.share_series.v0",
    required_competences: ["chart.rendering", "portfolio.summary"],
    provided_competences: ["widget.donut_chart", "mix.visibility"],
    source_fit_score: 0.85,
    extraction_contract,
    ...boundary,
  },
  {
    slot_id: "widget.slot.customer-journey-map",
    label: "Customer journey map",
    domain: "consulting",
    description: "Consulting artifact for customer stages, pain points and opportunities.",
    source_ref: "widgetdc-consulting-frontend/docs/WIDGET_FOUNDRY_INVENTORY.md",
    widget_family: "consulting.marketing_visual",
    artifact_types: ["canvas", "report", "pptx"],
    embed_strategy: "journey-map-artifact",
    input_contract: "widgetdc.foundry.journey_map.v0",
    required_competences: ["journey.mapping", "consulting.synthesis"],
    provided_competences: ["widget.customer_journey_map", "strategy.visualization"],
    source_fit_score: 0.9,
    extraction_contract,
    ...boundary,
  },
  {
    slot_id: "widget.slot.brand-architecture-map",
    label: "Brand architecture map",
    domain: "strategy",
    description: "Portfolio and brand relationship map for strategy work.",
    source_ref: "widgetdc-consulting-frontend/docs/WIDGET_FOUNDRY_INVENTORY.md",
    widget_family: "consulting.marketing_visual",
    artifact_types: ["canvas", "report", "pptx"],
    embed_strategy: "brand-architecture-map-artifact",
    input_contract: "widgetdc.foundry.brand_architecture.v0",
    required_competences: ["strategy.visualization", "portfolio.mapping"],
    provided_competences: ["widget.brand_architecture_map", "brand.system.visibility"],
    source_fit_score: 0.89,
    extraction_contract,
    ...boundary,
  },
];

export function getRecommendedWidgetSlots() {
  return WIDGET_FOUNDRY_SLOT_CANDIDATES;
}

export function getWidgetFoundrySourceReadback(): WidgetFoundrySourceReadback {
  return {
    ...WIDGET_FOUNDRY_SOURCE_READBACK,
    recommended_slot_candidate_count: WIDGET_FOUNDRY_SLOT_CANDIDATES.length,
  };
}

export function getWidgetFoundryReuseRatio() {
  const readback = getWidgetFoundrySourceReadback();
  return readback.recommended_slot_candidate_count > 0
    ? WIDGET_FOUNDRY_SLOT_CANDIDATES.length / readback.recommended_slot_candidate_count
    : 0;
}
