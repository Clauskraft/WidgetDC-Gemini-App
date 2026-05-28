import type { ToolDefinition } from '../types/widgetdc';
import { canExecuteFromBrowser, riskTone } from '../utils/governance';

interface GovernancePanelProps {
  tools: ToolDefinition[];
  selectedTool: ToolDefinition;
  onSelectTool: (tool: ToolDefinition) => void;
  onRunTool: (tool: ToolDefinition) => void;
  toolOutput?: string;
}

export function GovernancePanel({ tools, selectedTool, onSelectTool, onRunTool, toolOutput }: GovernancePanelProps) {
  return (
    <section className="panel governance-panel">
      <div className="panel-header">
        <div>
          <div className="section-kicker">Universal gate</div>
          <h2>Governed tool surface</h2>
        </div>
        <span className="pill">server-side proxy only</span>
      </div>

      <div className="tool-grid">
        {tools.map((tool) => (
          <button
            className={`tool-card ${selectedTool.name === tool.name ? 'active' : ''}`}
            key={tool.name}
            onClick={() => onSelectTool(tool)}
          >
            <span className="tool-namespace">{tool.namespace}</span>
            <strong>{tool.label}</strong>
            <small>{tool.description}</small>
            <span className={`risk-badge ${riskTone(tool.governance.risk_level)}`}>{tool.governance.risk_level}</span>
          </button>
        ))}
      </div>

      <div className="detail-card">
        <div className="detail-topline">
          <div>
            <div className="section-kicker">Selected tool</div>
            <h3>{selectedTool.name}</h3>
          </div>
          <button className="primary-action" onClick={() => onRunTool(selectedTool)}>
            {canExecuteFromBrowser(selectedTool) ? 'Run read-only check' : 'Show required path'}
          </button>
        </div>

        <dl className="governance-list">
          <div><dt>Risk</dt><dd>{selectedTool.governance.risk_level}</dd></div>
          <div><dt>Plan</dt><dd>{selectedTool.governance.requires_plan ? 'required' : 'not required'}</dd></div>
          <div><dt>Approval</dt><dd>{selectedTool.governance.requires_approval ? 'required' : 'not required'}</dd></div>
          <div><dt>Cost</dt><dd>{selectedTool.governance.cost_tier}</dd></div>
          <div><dt>Audit</dt><dd>{selectedTool.governance.audit_category}</dd></div>
        </dl>

        <pre className="output-console">{toolOutput ?? 'No execution yet. Read-only tools can be called. Staged/prod writes render structured rejection guidance.'}</pre>
      </div>
    </section>
  );
}
