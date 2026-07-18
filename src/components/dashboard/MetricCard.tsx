export function MetricCard({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint: string }) {
  return <article className="life-card metric-card"><div className="eyebrow">{label}</div><div className="metric-value">{value}<small>{unit}</small></div><div className="metric-hint">{hint}</div></article>;
}
