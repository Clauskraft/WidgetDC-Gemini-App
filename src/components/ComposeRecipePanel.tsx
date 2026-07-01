import type { CapabilityRecipe } from "@/lib/capabilityRecipe";

export function ComposeRecipePanel({ recipe }: { recipe: CapabilityRecipe }) {
  return (
    <section className="compose-recipe-panel" aria-label="Compose candidate recipe">
      <div className="agent-office-panel-head">
        <div>
          <div className="agent-office-workstrip-label">Compose</div>
          <strong>{recipe.intent}</strong>
        </div>
        <span>{recipe.activation.status}</span>
      </div>
      <div className="agent-office-ref-list">
        {recipe.entries.map((entry) => (
          <div key={entry.id} className="agent-office-ref-row">
            <code>{entry.kind}</code>
            <span>{entry.label}</span>
            <small>{entry.readiness}</small>
          </div>
        ))}
      </div>
      <p>
        {`candidates ${recipe.candidate_count} / mapped ${recipe.mapped_count} from ${recipe.mapped_count_source}`}
      </p>
      <div className="agent-office-ref-list" aria-label="Approval readiness">
        <div className="agent-office-ref-row">
          <code>Approval readiness</code>
          <span>{recipe.approval_readiness.status}</span>
          <small>{recipe.approval_readiness.source}</small>
        </div>
        <div className="agent-office-ref-row">
          <code>allowed</code>
          <span>{recipe.approval_readiness.allowed_actions.join(", ")}</span>
          <small>read-only</small>
        </div>
        <div className="agent-office-ref-row">
          <code>blocked</code>
          <span>{recipe.approval_readiness.blocked_actions.join(", ")}</span>
          <small>{`provider executions ${recipe.approval_readiness.provider_executions}`}</small>
        </div>
      </div>
      <button type="button" disabled title={recipe.activation.next_action}>
        {`Activate blocked: ${recipe.activation.missing_competence}`}
      </button>
    </section>
  );
}
