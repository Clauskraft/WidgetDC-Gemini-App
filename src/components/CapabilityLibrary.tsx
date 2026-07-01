import {
  filterCapabilityLibrary,
  type CapabilityLibraryEntry,
  type CapabilityLibraryFilters,
} from "@/lib/capabilityLibrary";

export function CapabilityLibrary({
  entries,
  filters,
  selectedIds,
  onToggle,
}: {
  entries: CapabilityLibraryEntry[];
  filters: CapabilityLibraryFilters;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const visible = filterCapabilityLibrary(entries, filters);

  return (
    <section className="capability-library" aria-label="Capability Library">
      <div className="agent-office-panel-head">
        <div>
          <div className="agent-office-workstrip-label">Capability Library</div>
          <strong>
            {visible.length} {filters.kind.replace(/_/g, " ")} candidates
          </strong>
        </div>
        <span>{filters.evidence === "all" ? "candidate-only" : filters.evidence}</span>
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
            <small>{entry.domain}</small>
            <small>{entry.readiness}</small>
            <small>{entry.evidence}</small>
            <small>{`graph write: ${entry.graph_write_allowed ? "allowed" : "blocked"}`}</small>
            <small>{`proof: ${entry.proof_eligible ? "eligible" : "blocked"}`}</small>
          </button>
        ))}
        {visible.length === 0 ? (
          <div className="capability-library-empty">No matching capability candidates.</div>
        ) : null}
      </div>
    </section>
  );
}
