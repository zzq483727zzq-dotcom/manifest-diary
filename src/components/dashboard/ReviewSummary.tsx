import { formatMinutes } from '@/lib/project/date';
import type { ReviewStats } from '@/types/project';

export function ReviewSummary({ stats }: { stats: ReviewStats }) {
  const metrics = [
    { label: '任务专注', value: formatMinutes(stats.taskMinutes) },
    { label: '项目整体专注', value: formatMinutes(stats.projectMinutes) },
    { label: '总专注', value: formatMinutes(stats.totalMinutes) },
    { label: '已完成', value: `${stats.completedCount} 条` },
    { label: '逾期', value: `${stats.overdueCount} 条` },
    { label: '阻塞', value: `${stats.blockedCount} 条` },
  ];

  return (
    <section className="review-summary" aria-label="执行摘要">
      {metrics.map((metric) => (
        <div className="review-metric" key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </div>
      ))}
    </section>
  );
}
