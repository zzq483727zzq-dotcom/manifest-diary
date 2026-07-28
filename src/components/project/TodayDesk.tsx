'use client';

import Link from 'next/link';
import type { ProjectSummary, TaskWithMeta } from '@/types/project';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/types/project';
import { formatMinutes } from '@/lib/project/date';
import type { TodayGroups, WeekStats } from '@/lib/project/repository';

const GROUP_META: Array<{
  key: keyof TodayGroups;
  title: string;
  empty: string;
}> = [
  { key: 'overdue', title: '已逾期', empty: '没有逾期任务，节奏不错。' },
  { key: 'dueToday', title: '今天到期', empty: '今天没有硬截止。' },
  { key: 'highSoon', title: '未来 3 天高优', empty: '近期没有高优任务。' },
  { key: 'inProgress', title: '进行中', empty: '还没有进行中的任务。' },
];

export function TodayDesk({
  groups,
  stats,
  projects,
}: {
  groups: TodayGroups;
  stats: WeekStats;
  projects: ProjectSummary[];
}) {
  const totalActionable =
    groups.overdue.length + groups.dueToday.length + groups.highSoon.length + groups.inProgress.length;

  return (
    <div className="module-page">
      <header className="module-header">
        <div className="eyebrow">今日 · ACTION DESK</div>
        <h1>今天先推进最重要的事。</h1>
        <p>
          {totalActionable > 0
            ? `当前有 ${totalActionable} 条值得关注的任务，从最紧急的一组开始。`
            : '没有紧急任务。去项目里补下一步，或者记录一点投入。'}
        </p>
      </header>

      <div className="today-stats">
        <div className="stat-card">
          <span>本周完成</span>
          <strong>{stats.completedThisWeek}</strong>
        </div>
        <div className="stat-card">
          <span>进行中项目</span>
          <strong>{stats.activeProjects}</strong>
        </div>
        <div className="stat-card">
          <span>本周完成率</span>
          <strong>{Math.round(stats.completionRate * 100)}%</strong>
        </div>
        <div className="stat-card">
          <span>本周投入</span>
          <strong>{formatMinutes(stats.minutesThisWeek)}</strong>
        </div>
      </div>

      {projects.length === 0 ? (
        <article className="life-card module-note">
          <div className="eyebrow">开始</div>
          <h2>还没有进行中的项目</h2>
          <p>把一个想完成的事情变成可执行的项目。</p>
          <p style={{ marginTop: 18 }}>
            <Link className="primary-link" href="/projects">
              创建第一个项目 →
            </Link>
          </p>
        </article>
      ) : (
        <>
          <div className="today-groups">
            {GROUP_META.map((group) => {
              const items = groups[group.key];
              const visible = items.slice(0, 5);
              return (
                <section key={group.key} className="today-group">
                  <div className="today-group-head">
                    <h2>{group.title}</h2>
                    <span>{items.length} 条</span>
                  </div>
                  {visible.length === 0 ? (
                    <p className="muted">{group.empty}</p>
                  ) : (
                    visible.map((task) => <TodayTaskRow key={task.id} task={task} />)
                  )}
                  {items.length > 5 ? (
                    <p className="muted" style={{ marginTop: 8 }}>
                      还有 {items.length - 5} 条，优先处理上面这些。
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="today-group-head">
              <h2>进行中项目</h2>
              <Link className="primary-link" href="/projects">
                全部项目 →
              </Link>
            </div>
            <div className="project-mini-grid">
              {projects.slice(0, 4).map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="project-mini-card">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: project.color,
                        display: 'inline-block',
                      }}
                    />
                    <strong>{project.name}</strong>
                  </div>
                  <small className="muted">
                    进度 {project.task_completed}/{project.task_total}
                    {project.nearest_due_date ? ` · 最近截止 ${project.nearest_due_date}` : ''}
                    {project.minutes_total > 0 ? ` · ${formatMinutes(project.minutes_total)}` : ''}
                  </small>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${Math.round(project.progress * 100)}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TodayTaskRow({ task }: { task: TaskWithMeta }) {
  return (
    <Link href={`/projects/${task.project_id}?task=${task.id}`} className="today-task">
      <span className={`priority-dot ${task.priority}`} />
      <div>
        <strong>{task.title}</strong>
        <small>
          {task.project_name} · {TASK_PRIORITY_LABELS[task.priority]} · {TASK_STATUS_LABELS[task.status]}
          {task.due_date ? ` · ${task.due_date}` : ''}
        </small>
      </div>
      <span className="muted">{task.minutes_total > 0 ? formatMinutes(task.minutes_total) : '—'}</span>
    </Link>
  );
}
