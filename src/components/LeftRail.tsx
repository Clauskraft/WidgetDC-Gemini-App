import type { CanvasMode, PlatformService } from '../types/widgetdc';

interface LeftRailProps {
  modes: CanvasMode[];
  activeMode: CanvasMode['id'];
  services: PlatformService[];
  onModeChange: (mode: CanvasMode['id']) => void;
}

export function LeftRail({ modes, activeMode, services, onModeChange }: LeftRailProps) {
  return (
    <aside className="left-rail glass-panel">
      <section className="rail-section">
        <div className="section-kicker">Workspace</div>
        <div className="rail-stack">
          {modes.map((mode) => (
            <button
              className={`rail-link ${activeMode === mode.id ? 'active' : ''}`}
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
            >
              <span>{mode.label}</span>
              <small>{mode.description}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="rail-section">
        <div className="section-kicker">System of record</div>
        <div className="record-stack">
          <div><strong>Linear</strong><span>work item truth</span></div>
          <div><strong>Git / CI</strong><span>code truth</span></div>
          <div><strong>Postgres</strong><span>audit / cost truth</span></div>
          <div><strong>Neo4j</strong><span>promoted lineage truth</span></div>
          <div><strong>Redis</strong><span>working pointer only</span></div>
        </div>
      </section>

      <section className="rail-section">
        <div className="section-kicker">Service posture</div>
        <div className="service-list compact">
          {services.map((service) => (
            <div className="service-row" key={service.id}>
              <span className={`status-dot ${service.status}`} />
              <div>
                <strong>{service.name}</strong>
                <small>{service.role}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
