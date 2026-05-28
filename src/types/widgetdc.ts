export type RiskLevel = 'read_only' | 'staged_write' | 'production_write';
export type CostTier = 'low' | 'standard' | 'premium';
export type ClaimLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export type ToolStatus = 'available' | 'degraded' | 'blocked' | 'unknown';

export interface GovernanceMetadata {
  risk_level: RiskLevel;
  requires_plan: boolean;
  requires_approval: boolean;
  cost_tier: CostTier;
  audit_category: string;
}

export interface GovernanceContext {
  tenant_id: string;
  actor_id: string;
  workflow_id?: string;
  plan_id?: string;
  approval_id?: string;
  correlation_id: string;
  evidence_ref?: string;
}

export interface ToolDefinition {
  name: string;
  label: string;
  namespace: string;
  description: string;
  status: ToolStatus;
  governance: GovernanceMetadata;
  recommended?: boolean;
}

export interface PlatformService {
  id: string;
  name: string;
  role: string;
  status: 'healthy' | 'degraded' | 'pending' | 'unknown';
  latencyMs?: number;
  evidence?: string;
}

export interface PlatformMetric {
  label: string;
  value: string;
  delta?: string;
  state: 'good' | 'warn' | 'hold' | 'bad';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    tool?: string;
    correlation_id?: string;
    risk_level?: RiskLevel;
  };
}

export interface WidgeToolRequest {
  tool: string;
  payload: Record<string, unknown>;
  governance?: Partial<GovernanceContext>;
}

export interface WidgeToolResponse<T = unknown> {
  success?: boolean;
  result?: T;
  intent?: string;
  text?: string;
  error?: string;
  _simulated_tools?: string;
  _target_tool?: string;
  _intent_confidence?: number;
  groundingSources?: Array<{
    source: string;
    title: string;
    snippet: string;
    link?: string;
  }>;
}

export interface EventSpineEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  correlation_id: string;
  workflow_id?: string;
  plan_id?: string;
  actor_id?: string;
  risk_level?: RiskLevel;
  status: 'accepted' | 'rejected' | 'completed' | 'pending' | 'failed';
  summary: string;
}

export interface ClaimState {
  claim_id: string;
  title: string;
  level: ClaimLevel;
  status: 'HOLD' | 'draft' | 'test_backed' | 'runtime_verified' | 'external_verified';
  evidence_refs: string[];
  canary_pass_streak: number;
  last_canary_status: 'passed' | 'failed' | 'unknown';
  blockers: string[];
}

export interface BomItem {
  bom_item_id: string;
  title: string;
  item_type: string;
  method_selected: 'RLM' | 'RAG' | 'Folding' | 'MCP' | 'LLM' | 'HumanReview';
  policy_requirement: 'read_only' | 'human_review' | 'HyperAgent_plan' | 'approval_required' | 'claim_gate';
  validation_status: 'validated' | 'review_required' | 'lineage_gap' | 'unvalidated';
  evidence_refs: string[];
}

export interface BomRun {
  bom_run_id: string;
  title: string;
  status: 'draft' | 'running' | 'validation_required' | 'review_required' | 'completed' | 'lineage_gap';
  risk_level: RiskLevel;
  claim_scope: string[];
  coverage: number;
  workartifact_id?: string;
  items: BomItem[];
}

export interface CanvasMode {
  id: 'mission' | 'chat' | 'phantom' | 'events' | 'claims' | 'connectors';
  label: string;
  description: string;
}
