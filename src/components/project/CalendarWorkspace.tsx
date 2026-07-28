'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { TaskWithMeta } from '@/types/project';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/types/project';
import { addDays, endOfMonth, endOfWeek, localDateString, startOfMonth, startOfWeek } from '@/lib/project/date';

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
  initialYear,
  initialMonth,
  initialView,
  initialFilter,
  initialSelected,
}: {
  tasks: TaskWithMeta[];
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
    <div className="module-page">
      <header className="module-header">
        <h1>按截止日期看清楚这一周和这个月</h1>
        <p>未完成用项目色标记，已完成弱化，逾期更醒目。</p>
      </header>

      <div className="calendar-toolbar">
        <div className="filter-row compact">
          <button
            type="button"
            className={view === 'month' ? 'filter-chip active' : 'filter-chip'}
            onClick={() => {
              setView('month');
              syncUrl({ view: 'month' });
            }}
          >
            月
          </button>
          <button
            type="button"
            className={view === 'week' ? 'filter-chip active' : 'filter-chip'}
            onClick={() => {
              setView('week');
              setWeekAnchor(selected);
              syncUrl({ view: 'week' });
            }}
          >
            周
          </button>
          <button
            type="button"
            className={filter === 'all' ? 'filter-chip active' : 'filter-chip'}
            onClick={() => {
              setFilter('all');
              syncUrl({ filter: 'all' });
            }}
          >
            全部
          </button>
          <button
            type="button"
            className={filter === 'open' ? 'filter-chip active' : 'filter-chip'}
            onClick={() => {
              setFilter('open');
              syncUrl({ filter: 'open' });
            }}
          >
            仅未完成
          </button>
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => (view === 'month' ? shiftMonth(-1) : shiftWeek(-1))}
          >
            上一段
          </button>
          <strong>
            {view === 'month'
              ? `${year} 年 ${month} 月`
              : `${startOfWeek(weekAnchor)} – ${endOfWeek(weekAnchor)}`}
          </strong>
          <button
            type="button"
            className="secondary-button"
            onClick={() => (view === 'month' ? shiftMonth(1) : shiftWeek(1))}
          >
            下一段
          </button>
        </div>
      </div>

      <div className="calendar-layout">
        <div>
          <div className="calendar-grid">
            {['一', '二', '三', '四', '五', '六', '日'].map((label) => (
              <div key={label} className="calendar-dow">
                {label}
              </div>
            ))}
            {cells.map((date) => {
              const { m } = parseYMD(date);
              const dayTasks = byDate.get(date) ?? [];
              const visible = dayTasks.slice(0, view === 'week' ? 4 : 3);
              const extra = dayTasks.length - visible.length;
              const outside = view === 'month' && m !== month;
              return (
                <button
                  key={date}
                  type="button"
                  className={[
                    'calendar-cell',
                    outside ? 'muted' : '',
                    date === selected ? 'selected' : '',
                    date === today ? 'today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setSelected(date);
                    setWeekAnchor(date);
                    syncUrl({ selected: date });
                  }}
                >
                  <div className="calendar-day-num">{parseYMD(date).d}</div>
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
                        style={{ background: `${task.project_color}33` }}
                        title={task.title}
                      >
                        {task.title}
                      </span>
                    );
                  })}
                  {extra > 0 ? <div className="calendar-more">还有 {extra} 项</div> : null}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="life-card day-panel">
          <h2 className="day-panel-title">{selected}</h2>
          <p className="muted day-panel-sub">当日截止任务</p>
          <div className="day-panel-list">
            {selectedTasks.length === 0 ? (
              <p className="muted">这一天没有截止日期任务。</p>
            ) : (
              selectedTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${task.project_id}?task=${task.id}`}
                  className="day-panel-item"
                >
                  <strong>{task.title}</strong>
                  <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                    {task.project_name} · {TASK_PRIORITY_LABELS[task.priority]} ·{' '}
                    {TASK_STATUS_LABELS[task.status]}
                  </div>
                </Link>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
