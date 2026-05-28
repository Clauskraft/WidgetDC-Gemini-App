import type { ClaimState } from '../types/widgetdc';

export function ClaimsPanel({ claims }: { claims: ClaimState[] }) {
  return (
    <section className="panel claims-panel">
      <div className="panel-header">
        <div>
          <div className="section-kicker">Claims registry</div>
          <h2>Evidence-gated claim maturity</h2>
        </div>
        <span className="pill">PR merge ≠ runtime proof</span>
      </div>
      <div className="claim-list">
        {claims.map((claim) => (
          <article className="claim-card" key={claim.claim_id}>
            <div className="claim-head">
              <div>
                <span className="section-kicker">{claim.claim_id}</span>
                <h3>{claim.title}</h3>
              </div>
              <span className={`level-badge level-${claim.level.toLowerCase()}`}>{claim.level}</span>
            </div>
            <div className="claim-status-row">
              <span className={`pill claim-${claim.status.toLowerCase()}`}>{claim.status}</span>
              <span>{claim.canary_pass_streak}x canary streak</span>
              <span>last: {claim.last_canary_status}</span>
            </div>
            {claim.blockers.length > 0 && (
              <ul className="blocker-list">
                {claim.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
