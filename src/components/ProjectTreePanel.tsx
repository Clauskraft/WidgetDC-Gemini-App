import { GitBranch } from "lucide-react";
import type { ProjectTreeRef } from "@/lib/agentOfficeProductionLoop";

export type ProjectTreePanelProps = {
  refs: ProjectTreeRef[];
  phase: "activity_start" | "activity_closeout";
};

export function ProjectTreePanel({ refs, phase }: ProjectTreePanelProps) {
  return (
    <section className="agent-office-project-tree" aria-label="ProjectTree">
      <div className="agent-office-panel-head">
        <div>
          <div className="agent-office-workstrip-label">ProjectTree</div>
          <strong>{phase === "activity_start" ? "Start frame" : "Closeout frame"}</strong>
        </div>
        <span>candidate-only</span>
      </div>
      <div className="agent-office-ref-list">
        {refs.map((item) => (
          <div key={item.ref} className="agent-office-ref-row">
            <code>{item.ref}</code>
            <span>{item.label}</span>
            <small>{item.phase}</small>
          </div>
        ))}
      </div>
      <p className="agent-office-boundary-copy">
        ProjectTree frames work. It does not prove runtime behavior or promote claims.
      </p>
      <GitBranch className="agent-office-watermark-icon" aria-hidden="true" />
    </section>
  );
}
