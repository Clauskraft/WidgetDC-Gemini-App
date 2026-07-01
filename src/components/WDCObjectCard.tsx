import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Info,
  XCircle,
} from "lucide-react";
import type { WDCObjectCardModel, WDCObjectCardTone } from "@/lib/wdcObjectCards";
import { cn } from "@/lib/utils";

const toneIcon = {
  neutral: CircleDashed,
  ok: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
} satisfies Record<WDCObjectCardTone, typeof CircleDashed>;

export function WDCObjectCard({ card }: { card: WDCObjectCardModel }) {
  const Icon = toneIcon[card.tone];

  return (
    <article className={cn("wdc-object-card", `wdc-object-card-${card.tone}`)}>
      <div className="wdc-object-card-head">
        <div>
          <div className="wdc-object-card-eyebrow">{card.eyebrow}</div>
          <h3>{card.title}</h3>
        </div>
        <div className="wdc-object-card-status">
          <Icon className="h-3.5 w-3.5" />
          <span>{card.status}</span>
        </div>
      </div>

      <p>{card.summary}</p>

      <div className="wdc-object-card-metrics" aria-label={`${card.eyebrow} metrics`}>
        {card.metrics.map((metric) => (
          <div
            key={`${metric.label}:${metric.value}`}
            className={cn(metric.tone && `wdc-object-card-metric-${metric.tone}`)}
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      <div className="wdc-object-card-boundary">
        <span>Proof boundary</span>
        <p>{card.proofBoundary}</p>
      </div>

      <details className="wdc-object-card-details">
        <summary>
          <span>{card.detailsLabel}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </summary>
        <div>
          {card.items.map((item) => (
            <div key={`${item.label}:${item.meta}`} className="wdc-object-card-row">
              <span>{item.label}</span>
              <small>{item.meta}</small>
              {item.state && <code>{item.state}</code>}
            </div>
          ))}
        </div>
      </details>
    </article>
  );
}
