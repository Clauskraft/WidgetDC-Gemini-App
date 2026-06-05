import type { PlatformMetric, PlatformService, ToolDefinition } from '../types/widgetdc';
import { MetricCard } from './MetricCard';

export function MissionControl({ metrics, services, tools }: { metrics: PlatformMetric[]; services: PlatformService[]; tools: ToolDefinition[] }) {
  const readOnly = tools.filter((tool) => tool.governance.risk_level === 'read_only').length;
  const guarded = tools.length - readOnly;

  return (
    <section className="mission-grid">
      <div className="hero-card glass-panel">
        <div className="section-kicker">WidgeTDC governed frontend</div>
        <h1>One UI for runtime truth, EventSpine evidence and Phantom BOM work.</h1>
        <p>
          This shell combines the runtime app surface, Lumina Aurora visual language, and WidgeTDC control-plane rules.
          It keeps writes behind server-side governed paths and treats UI as an operating surface, not a source of truth.
        </p>
        <div className="hero-actions">
          <a className="primary-action" href="#chat">Start governed chat</a>
          <a className="secondary-action" href="#phantom">Inspect Phantom BOM</a>
        </div>
      </div>

      <div className="metrics-grid">
        {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </div>

      <article className="panel compact-panel">
        <div className="panel-header">
          <div>
            <div className="section-kicker">Tool inventory sample</div>
            <h2>Safe surface split</h2>
          </div>
        </div>
        <div className="split-stat">
          <div><strong>{readOnly}</strong><span>read-only tools</span></div>
          <div><strong>{guarded}</strong><span>guarded writes</span></div>
        </div>
      </article>

      <article className="panel compact-panel">
        <div className="panel-header">
          <div>
            <div className="section-kicker">Service posture</div>
            <h2>Control-plane chain</h2>
          </div>
        </div>
        <div className="service-list">
          {services.slice(0, 4).map((service) => (
            <div className="service-row" key={service.id}>
              <span className={`status-dot ${service.status}`} />
              <div>
                <strong>{service.name}</strong>
                <small>{service.role}</small>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
