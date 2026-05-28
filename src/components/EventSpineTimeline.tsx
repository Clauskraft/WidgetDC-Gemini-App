import type { EventSpineEvent } from '../types/widgetdc';
import { formatTime } from '../utils/ids';

export function EventSpineTimeline({ events }: { events: EventSpineEvent[] }) {
  return (
    <section className="panel event-panel">
      <div className="panel-header">
        <div>
          <div className="section-kicker">EventSpine</div>
          <h2>Replayable evidence timeline</h2>
        </div>
        <span className="pill">correlation_id first</span>
      </div>
      <div className="timeline">
        {events.map((event) => (
          <article className={`timeline-event ${event.status}`} key={event.id}>
            <div className="timeline-marker" />
            <div className="timeline-body">
              <div className="timeline-topline">
                <strong>{event.type}</strong>
                <span>{formatTime(event.timestamp)}</span>
              </div>
              <p>{event.summary}</p>
              <div className="event-meta-grid">
                <code>{event.correlation_id}</code>
                {event.plan_id && <code>{event.plan_id}</code>}
                {event.risk_level && <span className="pill subtle">{event.risk_level}</span>}
                <span className={`pill state-${event.status}`}>{event.status}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
