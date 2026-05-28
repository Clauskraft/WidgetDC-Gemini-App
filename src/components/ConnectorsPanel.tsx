import type { PlatformService, ToolDefinition } from '../types/widgetdc';

export function ConnectorsPanel({ services, tools }: { services: PlatformService[]; tools: ToolDefinition[] }) {
  const namespaces = Array.from(new Set(tools.map((tool) => tool.namespace)));
  return (
    <section className="panel connectors-panel">
      <div className="panel-header">
        <div>
          <div className="section-kicker">Connectors</div>
          <h2>MCP, evidence and runtime adapters</h2>
        </div>
        <span className="pill">read-first inventory</span>
      </div>

      <div className="connector-grid">
        {services.map((service) => (
          <article className="connector-card" key={service.id}>
            <div className="connector-topline">
              <span className={`status-dot ${service.status}`} />
              <strong>{service.name}</strong>
            </div>
            <p>{service.role}</p>
            <small>{service.evidence}</small>
          </article>
        ))}
      </div>

      <div className="namespace-strip">
        {namespaces.map((namespace) => <span key={namespace}>{namespace}</span>)}
      </div>
    </section>
  );
}
