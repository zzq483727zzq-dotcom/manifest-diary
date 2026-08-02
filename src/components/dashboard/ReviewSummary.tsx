'use client';

import { formatMinutes } from '@/lib/project/date';
import type { ReviewStats } from '@/types/project';
import { useCountUp } from '@/lib/ui/useCountUp';

// 整数统计项挂 count-up（mount 时滚动），时长格式化项保持静态——
// 后者滚动需要逆向 parse 字符串、收益低、反倒干扰阅读。
export function ReviewSummary({ stats }: { stats: ReviewStats }) {
  const completed = useCountUp(stats.completedCount);
  const overdue = useCountUp(stats.overdueCount);
  const blocked = useCountUp(stats.blockedCount);
  const metrics = [
    { label: '任务专注', value: formatMinutes(stats.taskMinutes) },
    { label: '项目整体专注', value: formatMinutes(stats.projectMinutes) },
    { label: '总专注', value: formatMinutes(stats.totalMinutes) },
    { label: '已完成', value: `${Math.round(completed)} 条` },
    { label: '逾期', value: `${Math.round(overdue)} 条` },
    { label: '阻塞', value: `${Math.round(blocked)} 条` },
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
