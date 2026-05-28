import type { ToolDefinition } from '../types/widgetdc';

export function canExecuteFromBrowser(tool: ToolDefinition): boolean {
  return tool.governance.risk_level === 'read_only' && !tool.governance.requires_plan && !tool.governance.requires_approval;
}

export function buildRejection(tool: ToolDefinition, correlationId: string): string {
  if (tool.governance.risk_level === 'read_only') {
    return 'Read-only tool can execute through the server-side governed proxy.';
  }

  const requirement = tool.governance.risk_level === 'production_write'
    ? 'HyperAgent plan + approval + policy profile + durable EventSpine evidence'
    : 'HyperAgent plan + approval + evidence_ref';

  return [
    `Governance rejection for ${tool.name}`,
    `Risk: ${tool.governance.risk_level}`,
    `Requirement: ${requirement}`,
    `Next step: create or attach a plan_id before execution.`,
    `correlation_id: ${correlationId}`
  ].join('\n');
}

export function riskTone(risk: ToolDefinition['governance']['risk_level']): 'good' | 'warn' | 'bad' {
  if (risk === 'read_only') return 'good';
  if (risk === 'staged_write') return 'warn';
  return 'bad';
}
