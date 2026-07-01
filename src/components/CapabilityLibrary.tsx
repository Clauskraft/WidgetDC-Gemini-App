import type { CapabilityKind, CapabilityLibraryEntry } from "@/lib/capabilityLibrary";

export function CapabilityLibrary({
  entries,
  activeKind,
  selectedIds,
  onToggle,
}: {
  entries: CapabilityLibraryEntry[];
  activeKind: CapabilityKind;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const visible = entries.filter((entry) => entry.kind === activeKind);

  return (
    <section className="capability-library" aria-label="Capability Library">
      <div className="agent-office-panel-head">
        <div>
          <div className="agent-office-workstrip-label">Capability Library</div>
          <strong>
            {visible.length} {activeKind.replace("_", " ")} candidates
          </strong>
        </div>
        <span>candidate-only</span>
      </div>
      <div className="capability-library-grid">
        {visible.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            className="capability-library-card"
            aria-pressed={selectedIds.includes(entry.id)}
            aria-label={`${selectedIds.includes(entry.id) ? "Remove" : "Select"} ${entry.kind} capability ${index + 1}`}
            onClick={() => onToggle(entry.id)}
          >
            <span>{entry.kind === "widget" ? "Widget" : entry.kind}</span>
            <strong>{entry.label}</strong>
            <p>{entry.description}</p>
            <small>{entry.readiness}</small>
            <small>{`graph write: ${entry.graph_write_allowed ? "allowed" : "blocked"}`}</small>
            <small>{`proof: ${entry.proof_eligible ? "eligible" : "blocked"}`}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
