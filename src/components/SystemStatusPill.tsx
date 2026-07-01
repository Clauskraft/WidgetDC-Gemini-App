import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import type { AgentOfficeStatusState, AgentOfficeStatusSummary } from "@/lib/agentOfficeStatus";

const statusIcon = {
  ok: CheckCircle2,
  attention: CircleDashed,
  blocked: AlertTriangle,
} satisfies Record<AgentOfficeStatusState, typeof CheckCircle2>;

export function SystemStatusPill({ status }: { status: AgentOfficeStatusSummary }) {
  return (
    <div
      className={`system-status-pill system-status-pill-${status.overall}`}
      aria-label={`System status: ${status.items
        .map((item) => `${item.label} ${item.value}`)
        .join(", ")}`}
      title={status.proofBoundary}
    >
      {status.items.map((item) => {
        const Icon = statusIcon[item.state];
        return (
          <span
            key={item.id}
            className={`system-status-pill-item system-status-pill-item-${item.state}`}
            title={item.detail}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </span>
        );
      })}
    </div>
  );
}
