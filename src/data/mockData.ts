import type { BomRun, CanvasMode, ClaimState, EventSpineEvent, PlatformMetric, PlatformService, ToolDefinition } from '../types/widgetdc';

export const canvasModes: CanvasMode[] = [
  { id: 'mission', label: 'Mission Control', description: 'Runtime truth, gates, health, and operator view.' },
  { id: 'chat', label: 'Captain Chat', description: 'Gemini/WidgeTDC conversational control surface.' },
  { id: 'phantom', label: 'Phantom BOM', description: 'Decision BOM, BOMItems, WorkArtifacts and lineage.' },
  { id: 'events', label: 'EventSpine', description: 'Replayable audit and correlation trail.' },
  { id: 'claims', label: 'Claims', description: 'Evidence-gated claim maturity and holds.' },
  { id: 'connectors', label: 'Connectors', description: 'MCP, GraphRAG, NotebookLM and backend adapter status.' }
];

export const platformMetrics: PlatformMetric[] = [
  { label: 'Governance mode', value: 'observe / gated', delta: 'enforce requires canary proof', state: 'warn' },
  { label: 'Tool surface', value: 'multi-protocol', delta: 'REST · MCP · OpenAI · WS', state: 'good' },
  { label: 'Write posture', value: 'plan required', delta: 'staged/prod locked', state: 'good' },
  { label: 'Claim posture', value: 'evidence gated', delta: 'L3 requires 3x canary', state: 'hold' }
];

export const services: PlatformService[] = [
  { id: 'neural-bridge', name: 'Neural Bridge / MCP', role: 'Governed ingress', status: 'unknown', evidence: 'Connect runtime to resolve health.' },
  { id: 'backend', name: 'Backend MCP', role: 'Tool execution and typed wrappers', status: 'unknown', evidence: 'Read-only checks only from browser.' },
  { id: 'hyperagent', name: 'HyperAgent', role: 'Plan / approval / execution governor', status: 'pending', evidence: 'Used for staged/prod writes.' },
  { id: 'eventspine', name: 'EventSpine', role: 'Durable audit and replay', status: 'pending', evidence: 'correlation_id required.' },
  { id: 'neo4j', name: 'Neo4j graph', role: 'Semantic / lineage / capability truth', status: 'pending', evidence: 'No raw graph writes from UI.' },
  { id: 'postgres', name: 'Postgres', role: 'Audit, cost, evaluation memory', status: 'pending', evidence: 'Event replay source of truth.' }
];

export const tools: ToolDefinition[] = [
  {
    name: 'graph.integrity_check',
    label: 'Graph integrity',
    namespace: 'graph',
    description: 'Read-only graph consistency check.',
    status: 'available',
    recommended: true,
    governance: { risk_level: 'read_only', requires_plan: false, requires_approval: false, cost_tier: 'low', audit_category: 'graph.read' }
  },
  {
    name: 'graph.get_lineage',
    label: 'Lineage lookup',
    namespace: 'graph',
    description: 'Fetch lineage for WorkArtifact, capability or plan.',
    status: 'available',
    recommended: true,
    governance: { risk_level: 'read_only', requires_plan: false, requires_approval: false, cost_tier: 'low', audit_category: 'graph.read' }
  },
  {
    name: 'workflow_cost_trace',
    label: 'Workflow cost trace',
    namespace: 'workflow',
    description: 'Read workflow cost, fan-out and premium escalation trace.',
    status: 'available',
    governance: { risk_level: 'read_only', requires_plan: false, requires_approval: false, cost_tier: 'low', audit_category: 'cost.read' }
  },
  {
    name: 'eventspine.replay',
    label: 'Event replay',
    namespace: 'governance',
    description: 'Replay durable decision trail by correlation_id.',
    status: 'available',
    recommended: true,
    governance: { risk_level: 'read_only', requires_plan: false, requires_approval: false, cost_tier: 'low', audit_category: 'event.read' }
  },
  {
    name: 'graph.link_execution_lineage',
    label: 'Link execution lineage',
    namespace: 'graph',
    description: 'Typed lineage write; requires plan and evidence.',
    status: 'blocked',
    governance: { risk_level: 'staged_write', requires_plan: true, requires_approval: true, cost_tier: 'standard', audit_category: 'graph.write' }
  },
  {
    name: 'railway.deploy',
    label: 'Railway deploy',
    namespace: 'railway',
    description: 'Production-affecting deployment action.',
    status: 'blocked',
    governance: { risk_level: 'production_write', requires_plan: true, requires_approval: true, cost_tier: 'standard', audit_category: 'deploy.write' }
  }
];

export const events: EventSpineEvent[] = [
  {
    id: 'evt-001',
    type: 'tool_called',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    source: 'widgetdc-ui',
    correlation_id: 'wdc-ui-demo-01',
    workflow_id: 'workflow-demo',
    actor_id: 'captain-ui',
    risk_level: 'read_only',
    status: 'completed',
    summary: 'graph.integrity_check returned without write attempt.'
  },
  {
    id: 'evt-002',
    type: 'governance_rejection',
    timestamp: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
    source: 'governance-gate',
    correlation_id: 'wdc-ui-demo-02',
    workflow_id: 'workflow-demo',
    actor_id: 'captain-ui',
    risk_level: 'production_write',
    status: 'rejected',
    summary: 'railway.deploy requires HyperAgent plan, approval and policy profile.'
  },
  {
    id: 'evt-003',
    type: 'claim_hold_applied',
    timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    source: 'claims-registry',
    correlation_id: 'wdc-ui-demo-03',
    workflow_id: 'workflow-phantom',
    status: 'pending',
    summary: 'Phantom BOM claim held pending PRODUCES coverage and 3x runtime canary.'
  }
];

export const claims: ClaimState[] = [
  {
    claim_id: 'claim:tool-governance-classified-surface',
    title: 'Tool governance classified surface',
    level: 'L2',
    status: 'test_backed',
    evidence_refs: ['tool-registry-risk-metadata', 'frontend-safe-surface'],
    canary_pass_streak: 0,
    last_canary_status: 'unknown',
    blockers: ['Runtime surface canary not attached in this UI package.']
  },
  {
    claim_id: 'claim:phantom-bom-composition',
    title: 'Phantom BOM composition lineage',
    level: 'L2',
    status: 'HOLD',
    evidence_refs: ['A6-v2 lineage policy'],
    canary_pass_streak: 0,
    last_canary_status: 'unknown',
    blockers: ['Needs PRODUCES edge coverage ≥99% for new runs.', 'Needs 3 consecutive runtime canary passes.']
  },
  {
    claim_id: 'claim:decision-bom-end-to-end',
    title: 'Decision BOM end-to-end consulting runtime',
    level: 'L1',
    status: 'draft',
    evidence_refs: ['frontend-workartifact-draft'],
    canary_pass_streak: 0,
    last_canary_status: 'unknown',
    blockers: ['Human review required.', 'Typed lineage execution not proven from frontend.']
  }
];

export const phantomRun: BomRun = {
  bom_run_id: 'pbr-demo-aurora-001',
  title: 'Governed Frontend Composition Run',
  status: 'review_required',
  risk_level: 'staged_write',
  claim_scope: ['claim:tool-governance-classified-surface', 'claim:phantom-bom-composition'],
  coverage: 0.94,
  workartifact_id: 'wa-widgetdc-aurora-ui',
  items: [
    {
      bom_item_id: 'bomitem-001',
      title: 'Mission Control shell',
      item_type: 'artifact_section',
      method_selected: 'LLM',
      policy_requirement: 'human_review',
      validation_status: 'review_required',
      evidence_refs: ['stitch:lumina_mission_control_interface', 'repo:WidgetDC-Gemini-App']
    },
    {
      bom_item_id: 'bomitem-002',
      title: 'Governed tool registry panel',
      item_type: 'control',
      method_selected: 'MCP',
      policy_requirement: 'HyperAgent_plan',
      validation_status: 'validated',
      evidence_refs: ['GRAPH-TOOLS-SPEC', 'FDD-Neural-Bridge-Consolidation-v2']
    },
    {
      bom_item_id: 'bomitem-003',
      title: 'EventSpine replay view',
      item_type: 'review_task',
      method_selected: 'RAG',
      policy_requirement: 'read_only',
      validation_status: 'validated',
      evidence_refs: ['EVENT-SCHEMAS']
    },
    {
      bom_item_id: 'bomitem-004',
      title: 'PRODUCES lineage monitor',
      item_type: 'claim_candidate',
      method_selected: 'Folding',
      policy_requirement: 'claim_gate',
      validation_status: 'lineage_gap',
      evidence_refs: ['A6-v2 lineage policy']
    }
  ]
};
