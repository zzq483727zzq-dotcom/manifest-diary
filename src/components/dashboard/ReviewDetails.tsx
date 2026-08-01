'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { formatMinutes } from '@/lib/project/date';
import { safeStorageGetItem, safeStorageSetItem } from '@/lib/browser/safeStorage';
import type { ReviewStats, TaskWithMeta } from '@/types/project';

const STORAGE_KEY = 'clarity-review-details-open';
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function detailLabel(task: TaskWithMeta) {
  return `${task.project_name} · ${task.title}`;
}

function ListSection({
  title,
  empty,
  tasks,
}: {
  title: string;
  empty: string;
  tasks: TaskWithMeta[];
}) {
  return (
    <section className="review-detail-list">
      <h3>{title}</h3>
      {tasks.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.title}</strong>
              <span>{detailLabel(task)}{task.due_date ? ` · 截止 ${task.due_date}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ReviewDetails({ stats }: { stats: ReviewStats }) {
  const [open, setOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const saved = safeStorageGetItem(STORAGE_KEY);
    setOpen(saved == null ? !window.matchMedia('(max-width: 767px)').matches : saved === 'true');
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    safeStorageSetItem(STORAGE_KEY, String(open));
  }, [initialized, open]);

  const variance = stats.estimateVarianceMinutes;
  const varianceText = variance === 0
    ? '预计与实际持平'
    : variance > 0
      ? `比实际多估 ${formatMinutes(variance)}`
      : `比实际少估 ${formatMinutes(Math.abs(variance))}`;

  return (
    <section className="review-details" aria-label="复盘详情">
      <button
        className="review-details-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="review-details-content"
        onClick={() => setOpen((current) => !current)}
      >
        <span>复盘详情</span>
        <span aria-hidden>{open ? '收起' : '展开'}</span>
      </button>
      {open ? (
        <div className="review-details-content" id="review-details-content">
          <div className="review-detail-highlights">
            <div>
              <span>预计与实际</span>
              <strong>{varianceText}</strong>
              <small>预计 {formatMinutes(stats.estimateMinutes)} · 实际 {formatMinutes(stats.actualTaskMinutes)}</small>
            </div>
            <div>
              <span>平均完成周期</span>
              <strong>{stats.completedCount > 0 ? formatMinutes(stats.averageCompletionCycleMinutes) : '暂无完成记录'}</strong>
              <small>{stats.completedCount > 0 ? `基于 ${stats.completedCount} 条完成任务` : '完成任务后显示周期'}</small>
            </div>
          </div>
          <div className="review-detail-grid">
            <ListSection title="逾期任务" empty="所选范围内没有逾期任务。" tasks={stats.overdueTasks} />
            <ListSection title="阻塞任务" empty="所选范围内没有阻塞任务。" tasks={stats.blockedTasks} />
            <section className="review-detail-list">
              <h3>依赖绕过</h3>
              {stats.bypasses.length === 0 ? (
                <p>所选范围内没有依赖绕过记录。</p>
              ) : (
                <ul>
                  {stats.bypasses.map((bypass) => (
                    <li key={bypass.id}>
                      <strong>任务 {bypass.task_id}</strong>
                      <span>{bypass.reason || '未填写原因'} · {bypass.created_at.slice(0, 10)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}
