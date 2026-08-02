'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProjectSummary, TaskWithMeta } from '@/types/project';
import type { TaskInput } from '@/lib/project/validation';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/types/project';
import { addDays, endOfMonth, endOfWeek, localDateString, startOfMonth, startOfWeek } from '@/lib/project/date';
import { mutate } from '@/lib/store/useStore';
import { createTask } from '@/lib/store/repository';
import { parseTaskInput } from '@/lib/project/validation';

type ViewMode = 'month' | 'week';
type FilterMode = 'all' | 'open';

function parseYMD(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return { y, m, d };
}

function buildMonthCells(year: number, month: number) {
  const first = startOfMonth(year, month);
  const gridStart = startOfWeek(first);
  const last = endOfMonth(year, month);
  const gridEnd = endOfWeek(last);
  const cells: string[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    cells.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return cells;
}

function buildWeekCells(anchor: string) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function CalendarWorkspace({
  tasks,
  projects,
  initialYear,
  initialMonth,
  initialView,
  initialFilter,
  initialSelected,
}: {
  tasks: TaskWithMeta[];
  projects: ProjectSummary[];
  initialYear: number;
  initialMonth: number;
  initialView: ViewMode;
  initialFilter: FilterMode;
  initialSelected?: string;
}) {
  const router = useRouter();
  const today = localDateString();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [view, setView] = useState<ViewMode>(initialView);
  const [filter, setFilter] = useState<FilterMode>(initialFilter);
  const [selected, setSelected] = useState(initialSelected || today);
  const [weekAnchor, setWeekAnchor] = useState(initialSelected || today);

  // 日面板内联建任务表单：预填截止日期为选中日。
  const [createOpen, setCreateOpen] = useState(false);
  const [newTaskProjectId, setNewTaskProjectId] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  function openCreateForm() {
    setNewTaskProjectId(projects[0]?.id ?? '');
    setNewTaskTitle('');
    setNewTaskDueDate(selected);
    setCreateError('');
    setCreateOpen(true);
  }

  function submitCreateTask(event: React.FormEvent) {
    event.preventDefault();
    if (!newTaskProjectId) {
      setCreateError('请选择项目');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const input = parseTaskInput({
        project_id: newTaskProjectId,
        title: newTaskTitle,
        description: '',
        priority: 'medium',
        target_minutes: 25,
        due_date: newTaskDueDate || null,
        start_date: null,
      }) as TaskInput;
      mutate((draft) => {
        createTask(draft, input);
      });
      setCreateOpen(false);
      setNewTaskTitle('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      if (filter === 'open' && task.status === 'completed') return false;
      return true;
    });
  }, [tasks, filter]);

  const byDate = useMemo(() => {
    const map = new Map<string, TaskWithMeta[]>();
    for (const task of filtered) {
      if (!task.due_date) continue;
      const list = map.get(task.due_date) ?? [];
      list.push(task);
      map.set(task.due_date, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return a.title.localeCompare(b.title, 'zh-CN');
      });
    }
    return map;
  }, [filtered]);

  const cells = useMemo(() => {
    if (view === 'week') return buildWeekCells(weekAnchor);
    return buildMonthCells(year, month);
  }, [view, year, month, weekAnchor]);

  const selectedTasks = byDate.get(selected) ?? [];

  function syncUrl(next: {
    year?: number;
    month?: number;
    view?: ViewMode;
    filter?: FilterMode;
    selected?: string;
  }) {
    const y = next.year ?? year;
    const m = next.month ?? month;
    const v = next.view ?? view;
    const f = next.filter ?? filter;
    const s = next.selected ?? selected;
    const params = new URLSearchParams({
      year: String(y),
      month: String(m),
      view: v,
      filter: f,
      day: s,
    });
    router.replace(`/calendar?${params.toString()}`);
  }

  function shiftMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    const nextYear = date.getFullYear();
    const nextMonth = date.getMonth() + 1;
    setYear(nextYear);
    setMonth(nextMonth);
    const nextSelected = startOfMonth(nextYear, nextMonth);
    setSelected(nextSelected);
    setWeekAnchor(nextSelected);
    syncUrl({ year: nextYear, month: nextMonth, selected: nextSelected });
  }

  function shiftWeek(delta: number) {
    const next = addDays(weekAnchor, delta * 7);
    const { y, m } = parseYMD(next);
    setWeekAnchor(next);
    setSelected(next);
    setYear(y);
    setMonth(m);
    syncUrl({ year: y, month: m, selected: next });
  }

  return (
    <div className="module-page calendar-page">
      <header className="module-header">
        <h1>按截止日期看清楚这一周和这个月</h1>
        <p>未完成用项目色标记，已完成弱化，逾期更醒目。</p>
      </header>

      <div className="calendar-toolbar">
        <div className="filter-row compact">
          {([['month', '月'], ['week', '周']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={view === value ? 'filter-chip active' : 'filter-chip'}
              onClick={() => {
                setView(value);
                if (value === 'week') setWeekAnchor(selected);
                syncUrl({ view: value });
              }}
            >
              {label}
            </button>
          ))}
          <span className="chip-divider" aria-hidden />
          {([['all', '全部'], ['open', '仅未完成']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'filter-chip active' : 'filter-chip'}
              onClick={() => {
                setFilter(value);
                syncUrl({ filter: value });
              }}
            >
              {label}
            </button>
          ))}
          <button type="button" className="secondary-button today-jump" onClick={() => {
            const ty = parseYMD(today);
            setYear(ty.y);
            setMonth(ty.m);
            setSelected(today);
            setWeekAnchor(today);
            syncUrl({ year: ty.y, month: ty.m, selected: today });
          }}>
            今天
          </button>
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => (view === 'month' ? shiftMonth(-1) : shiftWeek(-1))}
            aria-label="上一段"
          >
            ‹
          </button>
          <strong className="calendar-range">
            {view === 'month'
              ? `${year} 年 ${month} 月`
              : `${startOfWeek(weekAnchor)} – ${endOfWeek(weekAnchor)}`}
          </strong>
          <button
            type="button"
            className="secondary-button"
            onClick={() => (view === 'month' ? shiftMonth(1) : shiftWeek(1))}
            aria-label="下一段"
          >
            ›
          </button>
        </div>
      </div>

      <div className="calendar-layout">
        <div className="calendar-grid-wrap">
          <div className="calendar-grid">
            {['一', '二', '三', '四', '五', '六', '日'].map((label) => (
              <div key={label} className="calendar-dow">
                {label}
              </div>
            ))}
            {cells.map((date) => {
              const { m, d } = parseYMD(date);
              const dayTasks = byDate.get(date) ?? [];
              const cap = view === 'week' ? 4 : 3;
              const visible = dayTasks.slice(0, cap);
              const extra = dayTasks.length - visible.length;
              const outside = view === 'month' && m !== month;
              const isToday = date === today;
              const isSelected = date === selected;
              const hasOverdue = dayTasks.some(
                (t) => t.status !== 'completed' && t.due_date! < today,
              );
              return (
                <button
                  key={date}
                  type="button"
                  className={[
                    'calendar-cell',
                    outside ? 'muted' : '',
                    isSelected ? 'selected' : '',
                    isToday ? 'today' : '',
                    hasOverdue ? 'has-overdue' : '',
                    dayTasks.length === 0 ? 'empty' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setSelected(date);
                    setWeekAnchor(date);
                    syncUrl({ selected: date });
                  }}
                >
                  <div className="calendar-day-num">
                    <span>{d}</span>
                    {dayTasks.length > 0 ? (
                      <em className="calendar-count">{dayTasks.length}</em>
                    ) : null}
                  </div>
                  {visible.map((task) => {
                    const overdue = task.status !== 'completed' && task.due_date! < today;
                    return (
                      <span
                        key={task.id}
                        className={[
                          'calendar-pill',
                          task.status === 'completed' ? 'done' : '',
                          overdue ? 'overdue' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{ '--pill': task.project_color } as CSSProperties}
                        title={task.title}
                      >
                        <i className="pill-dot" style={{ background: task.project_color }} />
                        {task.title}
                      </span>
                    );
                  })}
                  {extra > 0 ? (
                    <div className="calendar-more">+{extra} 项</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="life-card day-panel">
          <div className="day-panel-head">
            <h2 className="day-panel-title">{selected}</h2>
            <span className="day-panel-sub muted">
              {selectedTasks.length > 0 ? `当日截止 ${selectedTasks.length} 项` : '当日截止任务'}
            </span>
            {projects.length > 0 ? (
              <button
                type="button"
                className="text-button day-panel-add"
                onClick={createOpen ? () => setCreateOpen(false) : openCreateForm}
              >
                {createOpen ? '取消' : '＋ 新建任务'}
              </button>
            ) : null}
          </div>

          {createOpen && projects.length > 0 ? (
            <form className="day-panel-create" onSubmit={submitCreateTask}>
              <select
                value={newTaskProjectId}
                onChange={(e) => setNewTaskProjectId(e.target.value)}
                aria-label="选择项目"
                required
              >
                <option value="">选择项目</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="任务标题"
                maxLength={120}
                required
                autoFocus
              />
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                aria-label="截止日期"
              />
              <button type="submit" className="primary-button sm" disabled={creating}>
                {creating ? '创建中…' : '创建'}
              </button>
              {createError ? <p className="form-error">{createError}</p> : null}
            </form>
          ) : null}

          <div className="day-panel-list">
            {selectedTasks.length === 0 ? (
              <div className="calendar-empty-day">
                <div className="calendar-empty-mark" aria-hidden />
                <p className="calendar-empty-text">这一天没有截止任务。</p>
                <p className="muted calendar-empty-hint">把约定放到相邻的工作日，留出专注空间。</p>
              </div>
            ) : (
              selectedTasks.map((task) => {
                const overdue = task.status !== 'completed' && task.due_date! < today;
                return (
                  <Link
                    key={task.id}
                    href={`/projects/detail?id=${task.project_id}&task=${task.id}`}
                    className={[
                      'day-panel-item',
                      task.status === 'completed' ? 'done' : '',
                      overdue ? 'overdue' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="dp-bar" style={{ background: task.project_color }} />
                    <span className="dp-body">
                      <strong>{task.title}</strong>
                      <span className="muted dp-meta">
                        {task.project_name} · {TASK_PRIORITY_LABELS[task.priority]} ·{' '}
                        {TASK_STATUS_LABELS[task.status]}
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
