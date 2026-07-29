'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProjectSummary, TaskWithMeta } from '@/types/project';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/types/project';
import { formatMinutes } from '@/lib/project/date';
import type { TodayGroups, WeekStats } from '@/lib/project/repository';

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

function dateLine(d = new Date()) {
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${week}`;
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
  const router = useRouter();
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  async function completeTask(task: TaskWithMeta) {
    if (busyTaskId) return;
    setBusyTaskId(task.id);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          status: task.status === 'completed' ? 'todo' : 'completed',
          priority: task.priority,
          due_date: task.due_date,
          project_id: task.project_id,
        }),
      });
      if (!response.ok) throw new Error('任务更新失败');
      router.refresh();
    } catch {
      window.alert('任务更新失败，请稍后重试。');
    } finally {
      setBusyTaskId(null);
    }
  }

  const overdueN = groups.overdue.length;
  const dueN = groups.dueToday.length;
  const urgent = overdueN + dueN;
  const total =
    urgent + groups.highSoon.length + groups.inProgress.length;

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
        <p className="td-date">{dateLine()}</p>
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
        {metrics.map((m, i) => (
          <span className="td-stat" key={m.label}>
            <span className="td-stat-value">{m.value}</span>
            <span className="td-stat-label">{m.label}</span>
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
              {GROUPS.map((g) => {
                const items = groups[g.key];
                const visible = items.slice(0, 5);
                const urgentPanel = g.tone === 'danger' && items.length > 0;
                return (
                  <section
                    key={g.key}
                    className={`td-panel tone-${g.tone}${urgentPanel ? ' is-hot' : ''}`}
                  >
                    <header className="td-panel-h">
                      <h2>
                        <i className={`td-pip tone-${g.tone}`} aria-hidden />
                        {g.title}
                      </h2>
                      <span className="td-count">{items.length}</span>
                    </header>

                    {visible.length === 0 ? (
                      <p className="td-panel-empty">{g.empty}</p>
                    ) : (
                      <ul className="td-list">
                        {visible.map((task) => (
                          <li key={task.id}>
                            <TaskRow
                              task={task}
                              hot={g.key === 'overdue'}
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
              {projects.slice(0, 4).map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="td-proj">
                  <div className="td-proj-top">
                    <span className="td-swatch" style={{ background: p.color }} aria-hidden />
                    <strong>{p.name}</strong>
                    <em>{Math.round(p.progress * 100)}%</em>
                  </div>
                  <p>
                    {p.task_completed}/{p.task_total} 已完成
                    {p.nearest_due_date ? ` · 最近 ${p.nearest_due_date}` : ''}
                    {p.minutes_total > 0 ? ` · ${formatMinutes(p.minutes_total)}` : ''}
                  </p>
                  <div className="td-bar" aria-hidden>
                    <div style={{ width: `${Math.round(p.progress * 100)}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
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
      <Link href={`/projects/${task.project_id}?task=${task.id}`} className="td-row-link">
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
          href={`/projects/${task.project_id}?task=${task.id}`}
          className="td-open"
          aria-label={`打开任务：${task.title}`}
        >
          打开
        </Link>
      </div>
    </div>
  );
}
