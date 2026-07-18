import { fetchLifeLogs } from '@/lib/supabase/life';
import { buildDashboardSummary } from '@/lib/life/aggregate';
import { computeEntryDate, APP_TIMEZONE } from '@/lib/date';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { AchievementCard } from '@/components/dashboard/AchievementCard';
import { QuickLogSheet } from '@/components/dashboard/QuickLogSheet';
import { LifeInsightCard } from '@/components/dashboard/LifeInsightCard';
import type { LifeLog } from '@/types/life';

function shiftDate(date: string, days: number) { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }

export default async function HomePage() {
  const today = computeEntryDate(new Date(), APP_TIMEZONE);
  let logs: LifeLog[] = [];
  try { logs = await fetchLifeLogs('local', shiftDate(today, -6), today); } catch { logs = []; }
  const summary = buildDashboardSummary(logs, today);
  return <div className="dashboard-home">
    <header className="dashboard-topbar"><div><div className="eyebrow">{today.replaceAll('-', '.')} · 个人状态中心</div><h1>今天，先照顾好自己的节奏。</h1></div><QuickLogSheet /></header>
    <div className="dashboard-columns"><main className="dashboard-main"><section className="metrics-grid">
      <MetricCard label="昨夜睡眠" value={summary.today.sleepHours?.toFixed(1) ?? '—'} unit={summary.today.sleepHours == null ? '' : 'h'} hint={summary.today.sleepHours == null ? '记录后建立睡眠基线' : '你的恢复时间'} />
      <MetricCard label="今日专注" value={String(summary.today.focusMinutes ?? '—')} unit={summary.today.focusMinutes == null ? '' : 'min'} hint="投入比忙碌更重要" />
      <MetricCard label="当前能量" value={String(summary.today.energy ?? '—')} unit={summary.today.energy == null ? '' : '/5'} hint="允许状态有起伏" />
      <MetricCard label="今日记录" value={`${Math.round(summary.today.completionRate * 100)}`} unit="%" hint="睡眠 · 专注 · 能量 · 行动" />
    </section><TrendChart points={summary.trend} /><AchievementCard achievements={summary.achievements} /></main><LifeInsightCard coverageDays={summary.coverageDays} /></div>
  </div>;
}
