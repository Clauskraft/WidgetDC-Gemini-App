import type { CapabilityKind } from "@/lib/capabilityLibrary";

const labels: Array<{ kind: CapabilityKind; label: string }> = [
  { kind: "skill", label: "Skills" },
  { kind: "agent", label: "Agents" },
  { kind: "pattern", label: "Patterns" },
  { kind: "widget", label: "Widgets" },
  { kind: "route", label: "Routes" },
  { kind: "proof_gate", label: "Proof gates" },
  { kind: "work_mode", label: "Work modes" },
];

export function LibraryNav({
  activeKind,
  onSelectKind,
}: {
  activeKind: CapabilityKind;
  onSelectKind: (kind: CapabilityKind) => void;
}) {
  return (
    <nav className="capability-library-nav" aria-label="Capability library">
      {labels.map((item) => (
        <button
          key={item.kind}
          type="button"
          aria-pressed={item.kind === activeKind}
          onClick={() => onSelectKind(item.kind)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
