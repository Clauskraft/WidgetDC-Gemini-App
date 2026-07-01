import { AlertTriangle, Boxes, GitBranch, LayoutGrid, ShieldCheck } from "lucide-react";
import type { BrokerageRouteCard as BrokerageRouteCardModel } from "@/lib/brokerageRoute";

export function BrokerageRouteCard({ card }: { card: BrokerageRouteCardModel }) {
  return (
    <section className="brokerage-route-card" aria-label="BrokerageRouteCard">
      <div className="brokerage-route-head">
        <div>
          <div className="agent-office-workstrip-label">BrokerageRouteCard</div>
          <h2>{card.title}</h2>
        </div>
        <div className="brokerage-route-flags">
          <span>candidate_only=true</span>
          <span>projection_only=true</span>
          <span>graph_write_allowed=false</span>
          <span>proof_eligible=false</span>
        </div>
      </div>

      <ol className="brokerage-route-chain" aria-label="Demand to proof brokerage route chain">
        {card.route_chain.map((step, index) => (
          <li key={step}>
            <small>{String(index + 1).padStart(2, "0")}</small>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div className="brokerage-route-metrics">
        <div>
          <span>candidate_count</span>
          <strong>{card.candidate_count}</strong>
        </div>
        <div>
          <span>mapped_count</span>
          <strong>{card.mapped_count}</strong>
          <small>{card.mapped_count_source}</small>
        </div>
        <div>
          <span>PatternProfitProjection</span>
          <strong>{card.pattern_profit_projection.label}</strong>
          <small>candidate only</small>
        </div>
      </div>

      <div className="brokerage-route-stop" role="status">
        <AlertTriangle className="h-4 w-4" />
        <span>
          Missing <strong>{card.proof_boundary.missing_competence}</strong>:{" "}
          {card.route_operation.next_action}
        </span>
      </div>

      <div className="brokerage-route-grid">
        <section>
          <div className="brokerage-route-subhead">
            <GitBranch className="h-3.5 w-3.5" />
            CandidateSystem
          </div>
          {card.candidate_systems.map((system) => (
            <article key={system.id} className="brokerage-route-row">
              <code>{system.kind}</code>
              <span>{system.label}</span>
              <small>{system.role}</small>
            </article>
          ))}
        </section>

        <section>
          <div className="brokerage-route-subhead">
            <LayoutGrid className="h-3.5 w-3.5" />
            WidgetSlot
          </div>
          {card.widget_slots.map((slot) => (
            <article key={slot.slot_id} className="brokerage-route-row">
              <code>{slot.widget_family}</code>
              <span>{slot.slot_id}</span>
              <small>
                {slot.source_ref} · required {slot.required_competences.join(", ")}
              </small>
            </article>
          ))}
        </section>
      </div>

      <div className="brokerage-route-boundary">
        <ShieldCheck className="h-4 w-4" />
        <p>{card.proof_boundary.hard_stop}</p>
      </div>

      <details className="brokerage-route-details">
        <summary>
          <Boxes className="h-3.5 w-3.5" />
          Show WidgetSlot contracts
        </summary>
        <div>
          {card.widget_slots.map((slot) => (
            <div key={slot.slot_id} className="brokerage-route-contract">
              <strong>{slot.slot_id}</strong>
              <span>{slot.input_contract}</span>
              <small>
                provides {slot.provided_competences.join(", ")} · artifacts{" "}
                {slot.artifact_types.join(", ")}
              </small>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
