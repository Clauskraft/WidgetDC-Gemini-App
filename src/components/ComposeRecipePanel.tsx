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
      <button type="button" disabled title={recipe.activation.next_action}>
        {`Activate blocked: ${recipe.activation.missing_competence}`}
      </button>
    </section>
  );
}
