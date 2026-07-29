'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  ProjectSummary,
  Subtask,
  TaskPriority,
  TaskStatus,
  TaskWithMeta,
  TimeEntry,
} from '@/types/project';
import {
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from '@/types/project';
import { formatMinutes, localDateString } from '@/lib/project/date';

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

  // 三态循环：待办 → 进行中 → 已完成 → 待办。让看板能显式切换到「进行中」。
  async function cycleStatus(task: TaskWithMeta) {
    const order: TaskStatus[] = ['todo', 'in_progress', 'completed'];
    const nextStatus = order[(order.indexOf(task.status) + 1) % order.length];
    if (
      nextStatus === 'completed' &&
      task.subtask_total > 0 &&
      task.subtask_done < task.subtask_total
    ) {
      if (!window.confirm('还有未完成的子任务，确定把父任务标为已完成吗？')) return;
    }
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
          <Link href="/projects" className="back-link">
            返回项目
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
                        <button
                          type="button"
                          className={`status-pill status-${task.status}`}
                          onClick={() => void cycleStatus(task)}
                          title="点击循环：待办 → 进行中 → 已完成"
                        >
                          {TASK_STATUS_LABELS[task.status]}
                        </button>
                        <button type="button" className="task-title-btn" onClick={() => openTask(task.id)}>
                          {task.title}
                        </button>
                      </div>
                      <div className="task-card-meta">
                        <span className={`priority-dot ${task.priority}`} />
                        {TASK_PRIORITY_LABELS[task.priority]}
                        {task.due_date ? ` · ${task.due_date}` : ''}
                        {task.subtask_total > 0
                          ? ` · 子任务 ${task.subtask_done}/${task.subtask_total}`
                          : ''}
                        {task.minutes_total > 0 ? ` · ${formatMinutes(task.minutes_total)}` : ''}
                      </div>
                    </article>
                  ))}
                  {columnTasks.length === 0 ? (
                    <p className="board-empty">
                      {status === 'todo'
                        ? '这里干净。把下一步要推进的事记进来。'
                        : status === 'in_progress'
                          ? '还没有正在做的事。点一张卡的标签把它切到进行中。'
                          : '完成的事情会收在这里，点标签能循环回待办。'}
                    </p>
                  ) : null}
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
                <button
                  type="button"
                  className={`status-pill status-${task.status}`}
                  onClick={() => void cycleStatus(task)}
                  title="点击循环：待办 → 进行中 → 已完成"
                >
                  {TASK_STATUS_LABELS[task.status]}
                </button>
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
  const [projectStatus, setProjectStatus] = useState<string>('active');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [timeMinutes, setTimeMinutes] = useState('30');
  const [timeDate, setTimeDate] = useState(localDateString());
  const [timeNote, setTimeNote] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState('');
  const readOnly = projectStatus === 'archived';

  async function load() {
    setLoading(true);
    setError('');
    setSectionError('');
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
      setProjectStatus(body.task.project_status || 'active');
      setSubtasks(body.subtasks ?? []);
      setTimeEntries(body.timeEntries ?? []);
      setDirty(false);
      setEditingEntryId(null);
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
    if (
      next === 'completed' &&
      subtasks.some((item) => !item.is_done)
    ) {
      if (!window.confirm('还有未完成的子任务，确定把父任务标为已完成吗？')) return;
    }
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

  async function addSubtask(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    setSectionError('');
    const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: subtaskTitle }),
    });
    const body = await res.json();
    if (!res.ok) {
      setSectionError(body.error || '添加子任务失败');
      return;
    }
    setSubtaskTitle('');
    setSubtasks((prev) => [...prev, body.subtask]);
    await onChanged();
  }

  async function toggleSubtask(subtask: Subtask) {
    if (readOnly) return;
    const res = await fetch(`/api/subtasks/${subtask.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_done: !subtask.is_done }),
    });
    if (!res.ok) return;
    const body = await res.json();
    setSubtasks((prev) => prev.map((item) => (item.id === subtask.id ? body.subtask : item)));
    await onChanged();
  }

  async function moveSubtaskItem(subtaskId: string, direction: 'up' | 'down') {
    if (readOnly) return;
    const res = await fetch(`/api/subtasks/${subtaskId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ move: direction }),
    });
    if (!res.ok) return;
    const listRes = await fetch(`/api/tasks/${taskId}/subtasks`);
    const body = await listRes.json();
    if (listRes.ok) setSubtasks(body.subtasks ?? []);
  }

  async function removeSubtask(subtaskId: string) {
    if (readOnly) return;
    if (!window.confirm('确定删除这个子任务吗？')) return;
    const res = await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
    if (!res.ok) return;
    setSubtasks((prev) => prev.filter((item) => item.id !== subtaskId));
    await onChanged();
  }

  async function saveTimeEntry(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    setSectionError('');
    const payload = {
      minutes: Number(timeMinutes),
      logged_date: timeDate,
      note: timeNote,
    };
    const res = await fetch(
      editingEntryId ? `/api/time-entries/${editingEntryId}` : `/api/tasks/${taskId}/time-entries`,
      {
        method: editingEntryId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    const body = await res.json();
    if (!res.ok) {
      setSectionError(body.error || '保存耗时失败');
      return;
    }
    setTimeMinutes('30');
    setTimeDate(localDateString());
    setTimeNote('');
    setEditingEntryId(null);
    await load();
    await onChanged();
  }

  function startEditEntry(entry: TimeEntry) {
    setEditingEntryId(entry.id);
    setTimeMinutes(String(entry.minutes));
    setTimeDate(entry.logged_date);
    setTimeNote(entry.note || '');
  }

  async function removeTimeEntry(entryId: string) {
    if (readOnly) return;
    if (!window.confirm('确定删除这条耗时记录吗？')) return;
    const res = await fetch(`/api/time-entries/${entryId}`, { method: 'DELETE' });
    if (!res.ok) return;
    await load();
    await onChanged();
  }

  function requestClose() {
    if (dirty && !window.confirm('有未保存修改，确定放弃吗？')) return;
    onClose();
  }

  return (
    <div className="sheet-backdrop" onMouseDown={requestClose}>
      <section className="drawer-panel wide" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="sheet-close" onClick={requestClose}>
          ×
        </button>
        {!loading && !readOnly ? (
          <div className="drawer-topbar">
            <button type="button" className="danger-ghost" onClick={() => void removeTask()}>
              删除任务
            </button>
          </div>
        ) : null}
                {loading ? (
          <p className="muted">加载中…</p>
        ) : (
          <div className="stack-form">
            <label>
              标题
              <input
                value={title}
                disabled={readOnly}
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
                  disabled={readOnly}
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
                  disabled={readOnly}
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
                  disabled={readOnly}
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
                rows={4}
                value={description}
                disabled={readOnly}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDirty(true);
                }}
              />
            </label>

            <section className="drawer-section">
              <div className="drawer-section-head">
                <strong>子任务</strong>
                <span>
                  {subtasks.filter((item) => item.is_done).length}/{subtasks.length}
                </span>
              </div>
              <div className="subtask-list">
                {subtasks.map((subtask, index) => (
                  <div key={subtask.id} className="subtask-row">
                    <label className="task-check">
                      <input
                        type="checkbox"
                        checked={subtask.is_done}
                        disabled={readOnly}
                        onChange={() => void toggleSubtask(subtask)}
                      />
                    </label>
                    <span className={subtask.is_done ? 'is-done' : undefined}>{subtask.title}</span>
                    {!readOnly ? (
                      <div className="subtask-actions">
                        <button
                          type="button"
                          className="text-button"
                          disabled={index === 0}
                          onClick={() => void moveSubtaskItem(subtask.id, 'up')}
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          disabled={index === subtasks.length - 1}
                          onClick={() => void moveSubtaskItem(subtask.id, 'down')}
                        >
                          下移
                        </button>
                        <button
                          type="button"
                          className="text-button danger-text"
                          onClick={() => void removeSubtask(subtask.id)}
                        >
                          删除
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {subtasks.length === 0 ? <p className="muted">还没有子任务，把大任务拆成可勾选的小步。</p> : null}
              </div>
              {!readOnly && subtasks.length < 20 ? (
                <form className="inline-form" onSubmit={addSubtask}>
                  <input
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    placeholder="添加子任务"
                    maxLength={120}
                    required
                  />
                  <button type="submit" className="secondary-button">
                    添加
                  </button>
                </form>
              ) : null}
              {subtasks.length >= 20 ? <p className="muted">单个任务最多 20 个子任务。</p> : null}
            </section>

            <section className="drawer-section">
              <div className="drawer-section-head">
                <strong>耗时记录</strong>
                <span>累计 {formatMinutes(minutesTotal)}</span>
              </div>
              <div className="time-entry-list">
                {timeEntries.map((entry) => (
                  <div key={entry.id} className="time-entry-row">
                    <div>
                      <strong>{formatMinutes(entry.minutes)}</strong>
                      <span className="muted"> · {entry.logged_date}</span>
                      {entry.note ? <p className="muted">{entry.note}</p> : null}
                    </div>
                    {!readOnly ? (
                      <div className="subtask-actions">
                        <button type="button" className="text-button" onClick={() => startEditEntry(entry)}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="text-button danger-text"
                          onClick={() => void removeTimeEntry(entry.id)}
                        >
                          删除
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {timeEntries.length === 0 ? <p className="muted">还没有耗时记录。</p> : null}
              </div>
              {!readOnly ? (
                <form className="stack-form compact" onSubmit={saveTimeEntry}>
                  <div className="meta-grid">
                    <label>
                      分钟
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={timeMinutes}
                        onChange={(e) => setTimeMinutes(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      日期
                      <input
                        type="date"
                        value={timeDate}
                        max={localDateString()}
                        onChange={(e) => setTimeDate(e.target.value)}
                        required
                      />
                    </label>
                  </div>
                  <label>
                    备注
                    <input
                      value={timeNote}
                      onChange={(e) => setTimeNote(e.target.value)}
                      maxLength={200}
                      placeholder="可选"
                    />
                  </label>
                  <div className="inline-actions">
                    <button type="submit" className="secondary-button">
                      {editingEntryId ? '更新耗时' : '添加耗时'}
                    </button>
                    {editingEntryId ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setEditingEntryId(null);
                          setTimeMinutes('30');
                          setTimeDate(localDateString());
                          setTimeNote('');
                        }}
                      >
                        取消编辑
                      </button>
                    ) : null}
                  </div>
                </form>
              ) : (
                <p className="muted">已归档项目中的任务为只读。</p>
              )}
            </section>

            {sectionError ? <p className="form-error">{sectionError}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            {!readOnly ? (
              <button type="button" className="primary-button" disabled={saving || !dirty} onClick={() => void save()}>
                {saving ? '保存中…' : '保存'}
              </button>
            ) : null}
            {!readOnly ? (
              <button type="button" className="danger-button" onClick={() => void removeTask()}>
                删除任务
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
