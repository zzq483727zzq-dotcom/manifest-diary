import type { DailyTrendPoint } from '@/types/life';

export function TrendChart({ points }: { points: DailyTrendPoint[] }) {
  const values = points.map((point) => point.focusMinutes == null ? null : Math.min(120, point.focusMinutes));
  const present = values.filter((value): value is number => value != null);
  const max = Math.max(60, ...present);
  const path = values.map((value, index) => value == null ? '' : `${index === 0 ? 'M' : 'L'} ${24 + index * 52} ${112 - (value / max) * 82}`).filter(Boolean).join(' ');
  return <article className="life-card trend-card"><div className="card-heading"><div><div className="eyebrow">专注节奏 · 近 7 天</div><h2>把注意力还给重要的事</h2></div><span className="trend-total">{present.length ? `${Math.round(present.reduce((a, b) => a + b, 0) / 60 * 10) / 10}h` : '—'}</span></div>
    {present.length ? <svg className="trend-svg" viewBox="0 0 336 138" role="img" aria-label={`近七天专注趋势，共 ${present.reduce((a, b) => a + b, 0)} 分钟`}><path className="trend-grid" d="M24 30H336M24 71H336M24 112H336" /><path className="trend-line" d={path} /><path className="trend-fill" d={`${path} L 336 112 L 24 112 Z`} />{values.map((value, i) => value != null && <circle key={i} cx={24 + i * 52} cy={112 - (value / max) * 82} r="4" className="trend-dot" />)}{points.map((point, i) => <text key={point.date} x={24 + i * 52} y="132" textAnchor="middle">{point.label}</text>)}</svg> : <div className="empty-chart">记录几次专注时段后，这里会出现你的节奏。</div>}
  </article>;
}
