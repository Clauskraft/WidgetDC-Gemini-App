import type { PlatformMetric } from '../types/widgetdc';

export function MetricCard({ metric }: { metric: PlatformMetric }) {
  return (
    <article className={`metric-card state-${metric.state}`}>
      <span className="metric-label">{metric.label}</span>
      <strong>{metric.value}</strong>
      {metric.delta && <small>{metric.delta}</small>}
    </article>
  );
}
