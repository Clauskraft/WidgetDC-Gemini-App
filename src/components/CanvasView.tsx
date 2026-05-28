import type { BomRun, ClaimState, EventSpineEvent } from '../types/widgetdc';

export function CanvasView({ run, claims, events }: { run: BomRun; claims: ClaimState[]; events: EventSpineEvent[] }) {
  const heldClaims = claims.filter((claim) => claim.status === 'HOLD').length;

  return (
    <section className="panel canvas-panel">
      <div className="canvas-toolbar">
        <div>
          <div className="section-kicker">WorkArtifactDraft</div>
          <h2>Governed frontend synthesis</h2>
        </div>
        <div className="toolbar-actions">
          <span className="pill">draft · review required</span>
          <span className="pill subtle">{heldClaims} held claims</span>
        </div>
      </div>

      <article className="document-card">
        <p className="document-eyebrow">WidgeTDC Aurora UI · WorkArtifactDraft</p>
        <h1>Frontend composition for the governed agent control plane</h1>
        <p className="lead">
          The interface combines a split chat/canvas workspace, mission-control dashboard, governed tool cards,
          EventSpine replay, Phantom BOM lineage and claim maturity controls. It is designed to sit on top of the
          existing Express BFF routes rather than exposing credentials or raw graph mutation in the browser.
        </p>

        <h2>Operating contract</h2>
        <p>
          Read-only checks can be initiated from the UI through the server-side proxy. Staged and production writes are
          displayed with their required path: HyperAgent plan, approval, policy context and durable event evidence.
        </p>

        <div className="document-callout">
          <strong>Current lineage sample</strong>
          <span>{run.bom_run_id} → {run.workartifact_id ?? 'pending WorkArtifact'} · coverage {Math.round(run.coverage * 100)}%</span>
        </div>

        <h2>Evidence trail preview</h2>
        <ul className="document-list">
          {events.map((event) => (
            <li key={event.id}><code>{event.correlation_id}</code> {event.summary}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
