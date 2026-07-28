'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  ProjectSummary,
  TaskPriority,
  TaskStatus,
  TaskWithMeta,
} from '@/types/project';
import {
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from '@/types/project';
import { formatMinutes } from '@/lib/project/date';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'completed'];

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sortTasks(tasks: TaskWithMeta[]) {
  const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    if (priorityRank[a.priority] !== priorityRank[b.priority]) {
      return priorityRank[a.priority] - priorityRank[b.priority];
    }
    if (Boolean(a.due_date) !== Boolean(b.due_date)) return a.due_date ? -1 : 1;
    if (a.due_date && b.due_date && a.due_date !== b.due_date) {
      return a.due_date.localeCompare(b.due_date);
    }
    if (a.position !== b.position) return a.position - b.position;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function ProjectBoard({
  project,
  initialTasks,
  initialTaskId,
}: {
  project: ProjectSummary;
  initialTasks: TaskWithMeta[];
  initialTaskId?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [tasks, setTasks] = useState(initialTasks);
  const [listFilter, setListFilter] = useState<'all' | 'open' | 'completed'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(initialTaskId ?? null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedCompleted, setExpandedCompleted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('clarity-project-view');
    if (stored === 'board' || stored === 'list') setView(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('clarity-project-view', view);
  }, [view]);

  useEffect(() => {
    if (initialTaskId) setDrawerTaskId(initialTaskId);
  }, [initialTaskId]);

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, TaskWithMeta[]> = {
      todo: [],
      in_progress: [],
      completed: [],
    };
    for (const task of sortTasks(tasks)) map[task.status].push(task);
    return map;
  }, [tasks]);

  const listTasksView = useMemo(() => {
    const sorted = sortTasks(tasks);
    if (listFilter === 'open') return sorted.filter((task) => task.status !== 'completed');
    if (listFilter === 'completed') return sorted.filter((task) => task.status === 'completed');
    return sorted;
  }, [tasks, listFilter]);

  async function refreshTasks() {
    const res = await fetch(`/api/tasks?projectId=${project.id}`);
    const body = await res.json();
    if (res.ok) setTasks(body.tasks ?? []);
    router.refresh();
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          title,
          description,
          priority,
          due_date: dueDate || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || '创建失败');
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      await refreshTasks();
      setDrawerTaskId(body.task.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(task: TaskWithMeta) {
    const nextStatus: TaskStatus = task.status === 'completed' ? 'todo' : 'completed';
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) await refreshTasks();
  }

  function openTask(taskId: string) {
    setDrawerTaskId(taskId);
    router.replace(`/projects/${project.id}?task=${taskId}`);
  }

  function closeDrawer() {
    setDrawerTaskId(null);
    router.replace(`/projects/${project.id}`);
  }

  return (
    <div className="module-page project-detail-page">
      <header className="module-header project-detail-header">
        <div>
          <Link href="/projects" className="eyebrow">
            ← 返回项目
          </Link>
          <h1>{project.name}</h1>
          <p>
            {PROJECT_STATUS_LABELS[project.status]} · 进度 {project.task_completed}/{project.task_total} · 累计{' '}
            {formatMinutes(project.minutes_total)}
          </p>
          {project.description ? <p>{project.description}</p> : null}
        </div>
        <div className="project-detail-actions">
          <div className="filter-row compact">
            <button
              type="button"
              className={view === 'board' ? 'filter-chip active' : 'filter-chip'}
              onClick={() => setView('board')}
            >
              看板
            </button>
            <button
              type="button"
              className={view === 'list' ? 'filter-chip active' : 'filter-chip'}
              onClick={() => setView('list')}
            >
              列表
            </button>
          </div>
          <button type="button" className="primary-button" onClick={() => setCreateOpen(true)}>
            新建任务
          </button>
        </div>
      </header>

      {view === 'board' ? (
        <div className="board-grid">
          {COLUMNS.map((status) => {
            const columnTasks = grouped[status];
            const visible =
              status === 'completed' && !expandedCompleted ? columnTasks.slice(0, 5) : columnTasks;
            return (
              <section key={status} className="board-column">
                <div className="board-column-head">
                  <strong>{TASK_STATUS_LABELS[status]}</strong>
                  <span>{columnTasks.length}</span>
                </div>
                <div className="board-column-body">
                  {visible.map((task) => (
                    <article key={task.id} className="task-card">
                      <div className="task-card-top">
                        <label className="task-check">
                          <input
                            type="checkbox"
                            checked={task.status === 'completed'}
                            onChange={() => void toggleComplete(task)}
                          />
                        </label>
                        <button type="button" className="task-title-btn" onClick={() => openTask(task.id)}>
                          {task.title}
                        </button>
                      </div>
                      <div className="task-card-meta">
                        <span className={`priority-dot ${task.priority}`} />
                        {TASK_PRIORITY_LABELS[task.priority]}
                        {task.due_date ? ` · ${task.due_date}` : ''}
                      </div>
                    </article>
                  ))}
                  {status === 'completed' && columnTasks.length > 5 ? (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setExpandedCompleted((value) => !value)}
                    >
                      {expandedCompleted ? '收起已完成' : `展开全部 ${columnTasks.length} 条`}
                    </button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="life-card list-panel">
          <div className="filter-row">
            {[
              ['all', '全部'],
              ['open', '未完成'],
              ['completed', '已完成'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={listFilter === key ? 'filter-chip active' : 'filter-chip'}
                onClick={() => setListFilter(key as typeof listFilter)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="task-table">
            {listTasksView.map((task) => (
              <div key={task.id} className="task-row">
                <label className="task-check">
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    onChange={() => void toggleComplete(task)}
                  />
                </label>
                <button type="button" className="task-title-btn" onClick={() => openTask(task.id)}>
                  {task.title}
                </button>
                <span>
                  <i className={`priority-dot ${task.priority}`} /> {TASK_PRIORITY_LABELS[task.priority]}
                </span>
                <span>{task.due_date || '—'}</span>
                <span>{TASK_STATUS_LABELS[task.status]}</span>
                <span>{formatMinutes(task.minutes_total)}</span>
              </div>
            ))}
            {listTasksView.length === 0 ? <p className="muted">这个筛选下没有任务。</p> : null}
          </div>
        </div>
      )}

      {createOpen ? (
        <div className="sheet-backdrop" onMouseDown={() => !saving && setCreateOpen(false)}>
          <section className="drawer-panel" onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="sheet-close" onClick={() => setCreateOpen(false)}>
              ×
            </button>
            <div className="eyebrow">新建任务</div>
            <h2>给这个项目加一步行动</h2>
            <form className="stack-form" onSubmit={createTask}>
              <label>
                标题
                <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} autoFocus />
              </label>
              <label>
                描述
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} />
              </label>
              <label>
                优先级
                <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </label>
              <label>
                截止日期
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={todayLocal()} />
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? '创建中…' : '创建任务'}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {drawerTaskId ? (
        <TaskDrawer
          taskId={drawerTaskId}
          projectId={project.id}
          onClose={closeDrawer}
          onChanged={refreshTasks}
        />
      ) : null}
    </div>
  );
}

function TaskDrawer({
  taskId,
  projectId,
  onClose,
  onChanged,
}: {
  taskId: string;
  projectId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [minutesTotal, setMinutesTotal] = useState(0);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || '加载失败');
      setTitle(body.task.title);
      setDescription(body.task.description || '');
      setStatus(body.task.status);
      setPriority(body.task.priority);
      setDueDate(body.task.due_date || '');
      setMinutesTotal(body.task.minutes_total || 0);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          priority,
          due_date: dueDate || null,
          status,
          project_id: projectId,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || '保存失败');
      setDirty(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function quickStatus(next: TaskStatus) {
    setStatus(next);
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      setDirty(false);
      await onChanged();
    }
  }

  async function removeTask() {
    if (!window.confirm('确定删除这个任务吗？子任务和耗时会一起删除。')) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    if (res.ok) {
      await onChanged();
      onClose();
    }
  }

  function requestClose() {
    if (dirty && !window.confirm('有未保存修改，确定放弃吗？')) return;
    onClose();
  }

  return (
    <div className="sheet-backdrop" onMouseDown={requestClose}>
      <section className="drawer-panel" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="sheet-close" onClick={requestClose}>
          ×
        </button>
        <div className="eyebrow">任务详情</div>
        {loading ? (
          <p className="muted">加载中…</p>
        ) : (
          <div className="stack-form">
            <label>
              标题
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <div className="meta-grid">
              <label>
                状态
                <select
                  value={status}
                  onChange={(e) => void quickStatus(e.target.value as TaskStatus)}
                >
                  <option value="todo">待办</option>
                  <option value="in_progress">进行中</option>
                  <option value="completed">已完成</option>
                </select>
              </label>
              <label>
                优先级
                <select
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value as TaskPriority);
                    setDirty(true);
                  }}
                >
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </label>
              <label>
                截止日期
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
            </div>
            <label>
              描述
              <textarea
                rows={5}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <div className="muted">累计耗时 {formatMinutes(minutesTotal)} · 子任务与耗时记录将在后续工单完善</div>
            {error ? <p className="form-error">{error}</p> : null}
            <button type="button" className="primary-button" disabled={saving || !dirty} onClick={() => void save()}>
              {saving ? '保存中…' : '保存'}
            </button>
            <button type="button" className="danger-button" onClick={() => void removeTask()}>
              删除任务
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
