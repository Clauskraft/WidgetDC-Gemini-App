import type { CSSProperties } from 'react';
import type { BomRun } from '../types/widgetdc';

export function PhantomBomPanel({ run }: { run: BomRun }) {
  const coveragePercent = Math.round(run.coverage * 100);

  return (
    <section className="panel phantom-panel">
      <div className="panel-header">
        <div>
          <div className="section-kicker">Phantom BOM</div>
          <h2>{run.title}</h2>
        </div>
        <span className="pill">{run.status}</span>
      </div>

      <div className="bom-hero">
        <div>
          <span className="section-kicker">Lineage coverage</span>
          <strong>{coveragePercent}%</strong>
          <small>Target for new runs: ≥99%</small>
        </div>
        <div className="coverage-ring" style={{ '--coverage': `${coveragePercent}%` } as CSSProperties}>
          <span>{coveragePercent}</span>
        </div>
      </div>

      <div className="bom-chain">
        <span>Request</span>
        <span>Decomposition</span>
        <span>BOMItems</span>
        <span>WorkArtifact</span>
        <span>PRODUCES</span>
        <span>Canary</span>
      </div>

      <div className="bom-items">
        {run.items.map((item) => (
          <article className={`bom-item ${item.validation_status}`} key={item.bom_item_id}>
            <div>
              <span className="section-kicker">{item.bom_item_id} · {item.item_type}</span>
              <h3>{item.title}</h3>
            </div>
            <div className="bom-item-grid">
              <span><strong>Method</strong>{item.method_selected}</span>
              <span><strong>Policy</strong>{item.policy_requirement}</span>
              <span><strong>Status</strong>{item.validation_status}</span>
            </div>
            <div className="evidence-chips">
              {item.evidence_refs.map((ref) => <code key={ref}>{ref}</code>)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
