import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import {
  buildExternalFrontendReviewPlan,
  summarizeExternalFrontendReviewReadiness,
} from "@/lib/externalFrontendReview";
import type { WorldClassAssessment as WorldClassAssessmentModel } from "@/lib/worldClassContract";
import { summarizeWorldClassKpiMatrix } from "@/lib/worldClassKpiMatrix";

export function WorldClassAssessment({ assessment }: { assessment: WorldClassAssessmentModel }) {
  const StatusIcon = assessment.worldClassSatisfied ? CheckCircle2 : AlertTriangle;
  const topBlockers = assessment.blockers.slice(0, 4);
  const kpiSummary = summarizeWorldClassKpiMatrix(assessment.kpis);
  const externalReview = buildExternalFrontendReviewPlan();
  const externalReviewReadiness = summarizeExternalFrontendReviewReadiness(externalReview);

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

      <div className="world-class-proof-harness">
        <span>{assessment.proofHarness.evidence_level}</span>
        <span>{`visual ${assessment.proofHarness.visual_status}`}</span>
        <span>{`keyboard ${assessment.proofHarness.accessibility_status}`}</span>
        <span>{`p95 ${assessment.proofHarness.max_interaction_p95_ms ?? "missing"}ms`}</span>
        <span>{`runtime ${assessment.proofHarness.runtime_status}`}</span>
      </div>

      <div className="agent-office-ref-list" aria-label="World-class evidence gates">
        <div className="agent-office-ref-row">
          <code>{`Evidence gates ${assessment.evidenceGatePassCount}/${assessment.evidenceGateTotal}`}</code>
          <span>Proof readiness</span>
          <small>diagnostic, user and runtime proof remain separate gates</small>
        </div>
        {assessment.evidenceGates.map((gate) => (
          <div key={gate.id} className="agent-office-ref-row" data-state={gate.passed ? "pass" : "stop"}>
            <code>{gate.passed ? "pass" : "blocked"}</code>
            <span title={gate.evidence}>{gate.label}</span>
            <small>{`requires ${gate.required_level}; observed ${gate.observed_level}`}</small>
          </div>
        ))}
      </div>

      <div className="world-class-proof-harness">
        <span>{`${kpiSummary.total} KPI targets`}</span>
        <span>{`${kpiSummary.met} met`}</span>
        <span>{`${kpiSummary.proofReady} proof-ready`}</span>
        <span>{`${kpiSummary.proofPending} proof-pending`}</span>
        <span>{`${kpiSummary.missingEvidence} missing evidence`}</span>
        <span>{`${kpiSummary.belowTarget} below target`}</span>
        <span>{`coverage ${kpiSummary.objectiveCoverage.toFixed(2)}`}</span>
      </div>

      {assessment.uxEvidence && (
        <div className="world-class-proof-harness">
          <span>UX diagnostic evidence</span>
          <span>{`search ${assessment.uxEvidence.library_search.successful_queries}/${assessment.uxEvidence.library_search.query_tests}`}</span>
          <span>{`recipes ${assessment.uxEvidence.recipe_validation.valid_recipes}/${assessment.uxEvidence.recipe_validation.recipe_attempts}`}</span>
          <span>{`inspectors ${assessment.uxEvidence.inspector.objects_with_inspector}/${assessment.uxEvidence.inspector.selectable_objects}`}</span>
          <span>{`stops ${assessment.uxEvidence.stop_harvest.harvested_stops}/${assessment.uxEvidence.stop_harvest.expected_stops}`}</span>
        </div>
      )}

      <div className="agent-office-ref-list" aria-label="External frontend review readiness">
        <div className="agent-office-ref-row">
          <code>{`External review readiness ${externalReviewReadiness.apps_ready}/${externalReviewReadiness.apps_total}`}</code>
          <span>candidate_only external inputs</span>
          <small>{`${externalReviewReadiness.provider_executions} provider executions; governed review execution required`}</small>
        </div>
        {externalReview.apps.map((app) => (
          <div
            key={app.id}
            className="agent-office-ref-row"
            data-state={app.access_status === "ready" ? "pass" : "stop"}
          >
            <code>{app.access_status}</code>
            <span title={app.review_prompt}>{app.label}</span>
            <small>{`${app.role}; ${app.import_back_contract.candidate_only ? "candidate_only" : "blocked"}`}</small>
          </div>
        ))}
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
        {assessment.kpis.map((kpi) => (
          <div key={kpi.id} className="agent-office-ref-row">
            <code>{kpi.proof_ready ? "proof-ready" : "proof-pending"}</code>
            <span title={kpi.formula}>{kpi.label}</span>
            <small
              title={`requires ${kpi.required_level}; observed ${kpi.observed_level}; evidence ${kpi.evidence_ref}`}
            >
              {`${kpi.status}: ${kpi.value} / ${kpi.target} · requires ${kpi.required_level}`}
            </small>
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
