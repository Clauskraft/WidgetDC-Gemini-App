import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import type { WorldClassAssessment as WorldClassAssessmentModel } from "@/lib/worldClassContract";

export function WorldClassAssessment({ assessment }: { assessment: WorldClassAssessmentModel }) {
  const StatusIcon = assessment.worldClassSatisfied ? CheckCircle2 : AlertTriangle;
  const topBlockers = assessment.blockers.slice(0, 4);

  return (
    <section className="world-class-assessment" aria-label="World-class contract">
      <div className="agent-office-panel-head">
        <div>
          <div className="agent-office-workstrip-label">World-class contract</div>
          <strong>{assessment.status}</strong>
        </div>
        <span>{`WCI ${assessment.worldClassIndex.toFixed(4)}`}</span>
      </div>

      <div className="world-class-scoreline">
        <div className="world-class-score">
          <StatusIcon className="h-4 w-4" />
          <span>{`Hard gates ${assessment.hardGatePassCount}/${assessment.hardGateTotal}`}</span>
        </div>
        <div className="world-class-score">
          <ShieldCheck className="h-4 w-4" />
          <span>{`min category ${assessment.minCategoryScore.toFixed(2)}`}</span>
        </div>
        <div className="world-class-score">
          <span>{`P0 defects ${assessment.criticalP0Defects}`}</span>
        </div>
      </div>

      <p className="agent-office-boundary-copy">
        WorldClassSatisfied = all(HardGates) and WCI at least 0.95 and every category at least 0.90
        and P0 defects equal 0.
      </p>

      <div className="world-class-grid">
        {assessment.hardGates.map((gate) => (
          <div key={gate.id} className="world-class-row" data-state={gate.passed ? "pass" : "stop"}>
            <code>{gate.passed ? "pass" : "stop"}</code>
            <span title={gate.evidence}>{gate.label}</span>
          </div>
        ))}
      </div>

      <div className="world-class-category-grid">
        {assessment.categories.map((category) => (
          <div key={category.id} className="world-class-category">
            <span>{category.label}</span>
            <strong>{category.score.toFixed(2)}</strong>
            <small>{`weight ${category.weight.toFixed(2)}`}</small>
          </div>
        ))}
      </div>

      <div className="agent-office-ref-list">
        {assessment.kpis.slice(0, 8).map((kpi) => (
          <div key={kpi.id} className="agent-office-ref-row">
            <code>{kpi.status}</code>
            <span title={kpi.formula}>{kpi.label}</span>
            <small>{`${kpi.value} / ${kpi.target}`}</small>
          </div>
        ))}
      </div>

      <div className="world-class-blockers">
        {topBlockers.map((blocker) => (
          <span key={blocker}>{blocker}</span>
        ))}
      </div>
    </section>
  );
}
