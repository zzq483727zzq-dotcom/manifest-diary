import type { AchievementSummary } from '@/types/life';

export function AchievementCard({ achievements }: { achievements: AchievementSummary }) {
  const items = [['连续记录', `${achievements.recordingStreak} 天`], ['专注投入', `${achievements.focusHours} 小时`], ['有记录的日子', `${achievements.recordedDays} / 7`]];
  return <article className="life-card achievement-card"><div className="eyebrow">微小但真实的进步</div><h2>你正在建立自己的节奏</h2><div className="achievement-list">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></article>;
}
