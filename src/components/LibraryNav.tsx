import {
  CAPABILITY_DOMAINS,
  CAPABILITY_EVIDENCE,
  CAPABILITY_KIND_LABELS,
  CAPABILITY_READINESS,
  type CapabilityDomain,
  type CapabilityEvidence,
  type CapabilityLibraryFilters,
  type CapabilityReadiness,
} from "@/lib/capabilityLibrary";

export function LibraryNav({
  filters,
  onChange,
}: {
  filters: CapabilityLibraryFilters;
  onChange: (filters: CapabilityLibraryFilters) => void;
}) {
  const update = (next: Partial<CapabilityLibraryFilters>) => onChange({ ...filters, ...next });

  return (
    <nav className="capability-library-nav" aria-label="Capability library">
      <div className="capability-library-kind-strip">
        {CAPABILITY_KIND_LABELS.map((item) => (
          <button
            key={item.kind}
            type="button"
            aria-pressed={item.kind === filters.kind}
            onClick={() => update({ kind: item.kind })}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="capability-library-filters">
        <label className="capability-library-filter">
          <span>Search</span>
          <input
            aria-label="Search capabilities"
            value={filters.query}
            onChange={(event) => update({ query: event.currentTarget.value })}
            placeholder="skill, agent, OSINT, visual..."
          />
        </label>
        <label className="capability-library-filter">
          <span>Domain</span>
          <select
            aria-label="Filter capability domain"
            value={filters.domain}
            onChange={(event) =>
              update({ domain: event.currentTarget.value as CapabilityDomain | "all" })
            }
          >
            <option value="all">All domains</option>
            {CAPABILITY_DOMAINS.map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>
        </label>
        <label className="capability-library-filter">
          <span>Readiness</span>
          <select
            aria-label="Filter capability readiness"
            value={filters.readiness}
            onChange={(event) =>
              update({ readiness: event.currentTarget.value as CapabilityReadiness | "all" })
            }
          >
            <option value="all">All readiness</option>
            {CAPABILITY_READINESS.map((readiness) => (
              <option key={readiness} value={readiness}>
                {readiness}
              </option>
            ))}
          </select>
        </label>
        <label className="capability-library-filter">
          <span>Evidence</span>
          <select
            aria-label="Filter capability evidence"
            value={filters.evidence}
            onChange={(event) =>
              update({ evidence: event.currentTarget.value as CapabilityEvidence | "all" })
            }
          >
            <option value="all">All evidence</option>
            {CAPABILITY_EVIDENCE.map((evidence) => (
              <option key={evidence} value={evidence}>
                {evidence}
              </option>
            ))}
          </select>
        </label>
      </div>
    </nav>
  );
}
