'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ProjectSummary, TaskWithMeta } from '@/types/project';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/types/project';
import {
  endOfMonth,
  formatMinutes,
  localDateString,
  startOfMonth,
  startOfWeek,
} from '@/lib/project/date';
import type { TodayGroups, WeekStats } from '@/types/project';
import { mutate, useStore } from '@/lib/store/useStore';
import { getReviewStats, updateTask } from '@/lib/store/repository';
import {
  safeStorageGetItem,
  safeStorageRemoveItem,
  safeStorageSetItem,
} from '@/lib/browser/safeStorage';
import { ReviewRangePicker, type ReviewRangePreset } from '@/components/dashboard/ReviewRangePicker';
import { ReviewSummary } from '@/components/dashboard/ReviewSummary';
import { ReviewDetails } from '@/components/dashboard/ReviewDetails';

const REVIEW_RANGE_STORAGE_KEY = 'clarity-review-range';

const GROUPS: Array<{
  key: keyof TodayGroups;
  title: string;
  empty: string;
  tone: 'danger' | 'accent' | 'neutral';
}> = [
  { key: 'overdue', title: '已逾期', empty: '没有逾期任务，节奏不错。', tone: 'danger' },
  { key: 'dueToday', title: '今天到期', empty: '今天没有硬截止。', tone: 'accent' },
  { key: 'highSoon', title: '未来 3 天高优', empty: '近期没有高优任务。', tone: 'neutral' },
  { key: 'inProgress', title: '进行中', empty: '还没有进行中的任务。', tone: 'neutral' },
];

function dateLine(d: Date) {
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${week}`;
}

export function getReviewRangeForPreset(
  preset: Exclude<ReviewRangePreset, 'custom'>,
  now = new Date(),
) {
  const today = localDateString(now);
  const current = new Date(`${today}T12:00:00`);
  if (preset === 'today') return { start: today, end: today };
  if (preset === 'week') return { start: startOfWeek(today), end: today };
  return {
    start: startOfMonth(current.getFullYear(), current.getMonth() + 1),
    end: endOfMonth(current.getFullYear(), current.getMonth() + 1),
  };
}

function isReviewPreset(value: unknown): value is ReviewRangePreset {
  return value === 'today' || value === 'week' || value === 'month' || value === 'custom';
}

function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDateString(date) === value;
}

export function TodayDesk({
  groups,
  stats,
  projects,
}: {
  groups: TodayGroups;
  stats: WeekStats;
  projects: ProjectSummary[];
}) {
  const db = useStore();
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [todayLabel, setTodayLabel] = useState<string | null>(null);
  const [reviewPreset, setReviewPreset] = useState<ReviewRangePreset>('week');
  const [reviewRange, setReviewRange] = useState<{ start: string; end: string } | null>(null);
  const [reviewRangeLoaded, setReviewRangeLoaded] = useState(false);

  useEffect(() => {
    setTodayLabel(dateLine(new Date()));

    const stored = safeStorageGetItem(REVIEW_RANGE_STORAGE_KEY);
    if (stored != null) {
      try {
        const parsed: unknown = JSON.parse(stored);
        if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) {
          throw new Error('Invalid review range storage');
        }

        const { preset, start, end } = parsed as {
          preset?: unknown;
          start?: unknown;
          end?: unknown;
        };
        if (!isReviewPreset(preset)) throw new Error('Invalid review preset');

        if (preset === 'custom') {
          if (!isLocalDate(start) || !isLocalDate(end) || start > end) {
            throw new Error('Invalid custom review range');
          }
          setReviewRange({ start, end });
        } else {
          if (start != null || end != null) {
            safeStorageRemoveItem(REVIEW_RANGE_STORAGE_KEY);
          }
          setReviewRange(getReviewRangeForPreset(preset));
        }
        setReviewPreset(preset);
      } catch {
        safeStorageRemoveItem(REVIEW_RANGE_STORAGE_KEY);
        setReviewRange(getReviewRangeForPreset('week'));
      }
    } else {
      setReviewRange(getReviewRangeForPreset('week'));
    }
    setReviewRangeLoaded(true);
  }, []);

  useEffect(() => {
    if (!reviewRangeLoaded || !reviewRange) return;
    const storedRange = reviewPreset === 'custom'
      ? { preset: reviewPreset, ...reviewRange }
      : { preset: reviewPreset };
    safeStorageSetItem(REVIEW_RANGE_STORAGE_KEY, JSON.stringify(storedRange));
  }, [reviewPreset, reviewRange, reviewRangeLoaded]);

  const reviewStats = useMemo(
    () => reviewRange == null ? null : getReviewStats(db, reviewRange),
    [db, reviewRange],
  );

  function selectReviewPreset(preset: ReviewRangePreset) {
    setReviewPreset(preset);
    if (preset !== 'custom') setReviewRange(getReviewRangeForPreset(preset));
  }

  function completeTask(task: TaskWithMeta) {
    if (busyTaskId) return;
    setBusyTaskId(task.id);
    try {
      mutate((draft) => {
        updateTask(draft, task.id, {
          title: task.title,
          description: task.description,
          status: task.status === 'completed' ? 'todo' : 'completed',
          priority: task.priority,
          due_date: task.due_date,
          project_id: task.project_id,
        });
      });
    } catch {
      window.alert('任务更新失败，请稍后重试。');
    } finally {
      setBusyTaskId(null);
    }
  }

  const overdueN = groups.overdue.length;
  const dueN = groups.dueToday.length;
  const urgent = overdueN + dueN;
  const total = urgent + groups.highSoon.length + groups.inProgress.length;

  const lead =
    projects.length === 0
      ? '从第一个项目开始，把想完成的事拆成可执行的任务。'
      : total === 0
        ? '没有紧急任务。去项目里补下一步，或记录一点投入。'
        : urgent > 0
          ? `有 ${overdueN} 条逾期、${dueN} 条今日到期。先清紧急，再看高优与进行中。`
          : `有 ${total} 条值得关注的任务，从最紧急的一组开始。`;

  const metrics = [
    { label: '本周完成', value: String(stats.completedThisWeek) },
    { label: '进行中项目', value: String(stats.activeProjects) },
    { label: '完成率', value: `${Math.round(stats.completionRate * 100)}%` },
    { label: '本周投入', value: formatMinutes(stats.minutesThisWeek) },
  ];

  return (
    <div className="td">
      <header className="td-hero">
        <p className="td-date">{todayLabel ?? '今日行动'}</p>
        <div className="td-hero-row">
          <div className="td-hero-text">
            <h1>今天先推进最重要的事</h1>
            <p className="td-lead">{lead}</p>
            <p className="td-data-note">演示数据 · 可直接在任务行完成或打开详情</p>
          </div>
          {urgent > 0 ? (
            <div className="td-urgent-chip" aria-label={`紧急 ${urgent} 条`}>
              <span className="td-urgent-dot" />
              紧急 {urgent}
            </div>
          ) : null}
        </div>
      </header>

      <section className="td-stats" aria-label="本周概览">
        {metrics.map((metric) => (
          <span className="td-stat" key={metric.label}>
            <span className="td-stat-value">{metric.value}</span>
            <span className="td-stat-label">{metric.label}</span>
          </span>
        ))}
      </section>

      {projects.length === 0 ? (
        <article className="td-empty">
          <div className="td-empty-scene" aria-hidden>
            <span className="td-empty-stack" />
            <span className="td-empty-mark" />
            <span className="td-empty-rail" />
            <span className="td-empty-rail is-tall" />
          </div>
          <div className="td-empty-body">
            <h2>还没有进行中的项目</h2>
            <p>Clarity 以项目为中心：任务必须归属项目，首页只强调今天要推进的事。先建一个项目，再把想完成的事拆成可执行的下一步。</p>
            <Link className="primary-button" href="/projects">
              创建第一个项目
            </Link>
          </div>
        </article>
      ) : (
        <>
          <section className="td-board" aria-label="今日行动分组">
            <p className="td-board-note">按紧急程度自上而下，先清顶部一组再往下。</p>
            <div className="td-board-grid">
              {GROUPS.map((group) => {
                const items = groups[group.key];
                const visible = items.slice(0, 5);
                const urgentPanel = group.tone === 'danger' && items.length > 0;
                return (
                  <section
                    key={group.key}
                    className={`td-panel tone-${group.tone}${urgentPanel ? ' is-hot' : ''}`}
                  >
                    <header className="td-panel-h">
                      <h2>
                        <i className={`td-pip tone-${group.tone}`} aria-hidden />
                        {group.title}
                      </h2>
                      <span className="td-count">{items.length}</span>
                    </header>

                    {visible.length === 0 ? (
                      <p className="td-panel-empty">{group.empty}</p>
                    ) : (
                      <ul className="td-list">
                        {visible.map((task) => (
                          <li key={task.id}>
                            <TaskRow
                              task={task}
                              hot={group.key === 'overdue'}
                              busy={busyTaskId === task.id}
                              onComplete={() => completeTask(task)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}

                    {items.length > 5 ? (
                      <Link href="/projects" className="td-more-link">
                        还有 {items.length - 5} 条，查看全部
                      </Link>
                    ) : null}
                  </section>
                );
              })}
            </div>
          </section>

          <section className="td-projects" aria-label="进行中项目">
            <header className="td-sec-h">
              <h2>进行中项目</h2>
              <Link className="primary-link" href="/projects">
                全部项目
              </Link>
            </header>
            <div className="td-proj-grid">
              {projects.slice(0, 4).map((project) => (
                <Link key={project.id} href={`/projects/detail?id=${project.id}`} className="td-proj">
                  <div className="td-proj-top">
                    <span className="td-swatch" style={{ background: project.color }} aria-hidden />
                    <strong>{project.name}</strong>
                    <em>{Math.round(project.progress * 100)}%</em>
                  </div>
                  <p>
                    {project.task_completed}/{project.task_total} 已完成
                    {project.nearest_due_date ? ` · 最近 ${project.nearest_due_date}` : ''}
                    {project.minutes_total > 0 ? ` · ${formatMinutes(project.minutes_total)}` : ''}
                  </p>
                  <div className="td-bar" aria-hidden>
                    <div style={{ width: `${Math.round(project.progress * 100)}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {reviewRange != null && reviewStats != null ? (
        <section className="td-review" aria-label="执行复盘">
          <header className="td-sec-h review-heading">
            <div>
              <h2>执行复盘</h2>
              <p>{reviewStats.range.start} 至 {reviewStats.range.end}</p>
            </div>
            <ReviewRangePicker
              preset={reviewPreset}
              value={reviewRange}
              onPresetChange={selectReviewPreset}
              onRangeChange={(range) => {
                setReviewPreset('custom');
                setReviewRange(range.start <= range.end ? range : { start: range.end, end: range.end });
              }}
            />
          </header>
          <ReviewSummary stats={reviewStats} />
          <ReviewDetails stats={reviewStats} />
        </section>
      ) : null}
    </div>
  );
}

function TaskRow({
  task,
  hot,
  busy,
  onComplete,
}: {
  task: TaskWithMeta;
  hot?: boolean;
  busy?: boolean;
  onComplete: () => void;
}) {
  return (
    <div className={`td-row${hot ? ' hot' : ''}`}>
      <button
        className={`td-check${task.status === 'completed' ? ' checked' : ''}`}
        type="button"
        aria-label={task.status === 'completed' ? `重新打开：${task.title}` : `完成：${task.title}`}
        aria-busy={busy}
        disabled={busy}
        onClick={onComplete}
      >
        {task.status === 'completed' ? '✓' : ''}
      </button>
      <Link href={`/projects/detail?id=${task.project_id}&task=${task.id}`} className="td-row-link">
        <strong>{task.title}</strong>
        <small>
          <span className="td-swatch sm" style={{ background: task.project_color }} aria-hidden />
          {task.project_name}
          <span>·</span>
          {TASK_PRIORITY_LABELS[task.priority]}
          <span>·</span>
          {TASK_STATUS_LABELS[task.status]}
          {task.due_date ? (
            <>
              <span>·</span>
              {task.due_date}
            </>
          ) : null}
        </small>
      </Link>
      <div className="td-row-actions">
        <time className="td-mins">
          {task.minutes_total > 0 ? formatMinutes(task.minutes_total) : '—'}
        </time>
        <Link
          href={`/projects/detail?id=${task.project_id}&task=${task.id}`}
          className="td-open"
          aria-label={`打开任务：${task.title}`}
        >
          打开
        </Link>
      </div>
    </div>
  );
}
