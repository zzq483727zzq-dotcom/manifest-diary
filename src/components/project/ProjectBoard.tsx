'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  ProjectSummary,
  ProjectTimeEntry,
  Subtask,
  Task,
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
import { CountdownTimer } from '@/components/project/CountdownTimer';
import { useCountdown } from '@/hooks/useCountdown';
import { useStore, mutate } from '@/lib/store/useStore';
import {
  createProjectTimeEntry,
  createSubtask,
  createTask,
  createTimeEntry,
  deleteProject as deleteProjectRepo,
  deleteProjectTimeEntry,
  deleteSubtask,
  deleteTask,
  deleteTimeEntry,
  getTask,
  listProjectTimeEntries,
  listSubtasks,
  listTasks,
  listTimeEntries,
  moveSubtask,
  updateProjectTimeEntry,
  updateSubtask,
  updateTask,
  updateTimeEntry,
} from '@/lib/store/repository';
import {
  parseProjectTimeEntryInput,
  parseSubtaskInput,
  parseTaskInput,
  parseTimeEntryInput,
} from '@/lib/project/validation';
import type { TaskInput } from '@/lib/project/validation';

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
  const db = useStore();
  const [view, setView] = useState<'board' | 'list'>('board');
  const tasks = useMemo(() => {
    const live = listTasks(db, project.id);
    return live.length ? live : initialTasks;
  }, [db, project.id, initialTasks]);
  const [listFilter, setListFilter] = useState<'all' | 'open' | 'completed'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(initialTaskId ?? null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  // 创建任务时「开始日期」默认填今天，可改可清。与「截止日期」并存。
  const [startDate, setStartDate] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedCompleted, setExpandedCompleted] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [projectMinutes, setProjectMinutes] = useState(project.minutes_total);

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

  useEffect(() => {
    setProjectMinutes(project.minutes_total);
  }, [project.minutes_total]);

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

  function createTaskFn(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const input = parseTaskInput({
        project_id: project.id,
        title,
        description,
        priority,
        due_date: dueDate || null,
        start_date: startDate || null,
      }) as TaskInput;
      let createdId = '';
      mutate((draft) => {
        const created = createTask(draft, input);
        createdId = created.id;
      });
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setStartDate(todayLocal());
      setDrawerTaskId(createdId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSaving(false);
    }
  }

  // 三态循环：待办 → 进行中 → 已完成 → 待办。让看板能显式切换到「进行中」。
  function cycleStatus(task: TaskWithMeta) {
    const order: TaskStatus[] = ['todo', 'in_progress', 'completed'];
    const nextStatus = order[(order.indexOf(task.status) + 1) % order.length];
    if (
      nextStatus === 'completed' &&
      task.subtask_total > 0 &&
      task.subtask_done < task.subtask_total
    ) {
      if (!window.confirm('还有未完成的子任务，确定把父任务标为已完成吗？')) return;
    }
    try {
      mutate((draft) => {
        updateTask(draft, task.id, { status: nextStatus });
      });
    } catch {
      // silent: status toggle is best-effort
    }
  }

  function openTask(taskId: string) {
    setDrawerTaskId(taskId);
    router.replace(`/projects/detail?id=${project.id}&task=${taskId}`);
  }

  function closeDrawer() {
    setDrawerTaskId(null);
    router.replace(`/projects/detail?id=${project.id}`);
  }

  function deleteProject() {
    if (
      !window.confirm(
        `确定删除项目「${project.name}」吗？项目下的任务、子任务和全部耗时记录都会一起删除，且无法撤销。`,
      )
    ) {
      return;
    }
    setDeletingProject(true);
    try {
      mutate((draft) => {
        deleteProjectRepo(draft, project.id);
      });
      router.replace('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeletingProject(false);
    }
  }

  function refreshProjectMinutes(total: number) {
    setProjectMinutes(total);
  }

  return (
    <div className="pb">
      <header className="pb-hero">
        <div className="pb-hero-text">
          <Link href="/projects" className="pb-back">
            返回项目
          </Link>
          <h1>{project.name}</h1>
          <div className="pb-hero-meta">
            <span className="pb-chip">{PROJECT_STATUS_LABELS[project.status]}</span>
            <span className="pb-stat">
              进度<em>{project.task_completed}/{project.task_total}</em>
            </span>
            <span className="pb-stat">
              累计<em>{formatMinutes(projectMinutes)}</em>
            </span>
            {project.start_date ? (
              <span className="pb-stat">
                开始<em>{project.start_date}</em>
              </span>
            ) : null}
            {project.target_date ? (
              <span className={`pb-stat${project.target_date < todayLocal() && project.status !== 'completed' ? ' is-over' : ''}`}>
                截止<em>{project.target_date}</em>
              </span>
            ) : null}
          </div>
          {project.description ? <p className="pb-desc">{project.description}</p> : null}
        </div>
        <div className="pb-hero-actions">
          <div className="pb-view-toggle" role="group" aria-label="切换视图">
            <button
              type="button"
              className={view === 'board' ? 'pb-view active' : 'pb-view'}
              aria-pressed={view === 'board'}
              onClick={() => setView('board')}
            >
              看板
            </button>
            <button
              type="button"
              className={view === 'list' ? 'pb-view active' : 'pb-view'}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              列表
            </button>
          </div>
          <button
            type="button"
            className={timeOpen ? 'pb-ghost active' : 'pb-ghost'}
            aria-pressed={timeOpen}
            onClick={() => setTimeOpen((value) => !value)}
          >
            记录耗时
          </button>
          <button
            type="button"
            className="primary-button pb-new"
            onClick={() => {
              // 打开创建抽屉时把开始日期默认填今天（用户可清）。
              setStartDate(todayLocal());
              setCreateOpen(true);
            }}
          >
            新建任务
          </button>
          <button
            type="button"
            className="pb-ghost danger-ghost"
            disabled={deletingProject}
            onClick={() => void deleteProject()}
          >
            {deletingProject ? '删除中…' : '删除项目'}
          </button>
        </div>
      </header>

      {timeOpen ? (
        <ProjectTimeSection
          projectId={project.id}
          readOnly={project.status === 'archived'}
          onMinutesChange={refreshProjectMinutes}
        />
      ) : null}

      {view === 'board' ? (
        <section className="pb-board" aria-label="任务看板">
          {COLUMNS.map((status) => {
            const columnTasks = grouped[status];
            const visible =
              status === 'completed' && !expandedCompleted ? columnTasks.slice(0, 5) : columnTasks;
            const tone =
              status === 'in_progress' ? 'accent' : status === 'completed' ? 'done' : 'neutral';
            return (
              <section key={status} className={`pb-col tone-${tone}`} aria-label={TASK_STATUS_LABELS[status]}>
                <header className="pb-col-h">
                  <h2>
                    <i className={`pb-pip tone-${tone}`} aria-hidden />
                    {TASK_STATUS_LABELS[status]}
                  </h2>
                  <span className="pb-count">{columnTasks.length}</span>
                </header>
                <div className="pb-col-body">
                  {visible.map((task) => {
                    const overdue =
                      task.due_date && task.status !== 'completed' && task.due_date < todayLocal();
                    return (
                      <article key={task.id} className={`pb-card${overdue ? ' is-over' : ''}`}>
                        <button
                          type="button"
                          className={`pb-status tone-${task.status}`}
                          onClick={() => void cycleStatus(task)}
                          title="点击循环：待办 → 进行中 → 已完成"
                        >
                          {TASK_STATUS_LABELS[task.status]}
                        </button>
                        <button type="button" className="pb-title" onClick={() => openTask(task.id)}>
                          {task.title}
                        </button>
                        <div className="pb-meta">
                          <i className={`pb-pdot ${task.priority}`} aria-hidden />
                          <span className="pb-meta-pri">{TASK_PRIORITY_LABELS[task.priority]}</span>
                          {task.due_date ? (
                            <span className={`pb-meta-date${overdue ? ' is-over' : ''}`}>
                              {task.due_date}
                            </span>
                          ) : null}
                          {task.subtask_total > 0 ? (
                            <span className="pb-meta-sub">
                              子任务 {task.subtask_done}/{task.subtask_total}
                            </span>
                          ) : null}
                          {task.minutes_total > 0 ? (
                            <span className="pb-meta-min">{formatMinutes(task.minutes_total)}</span>
                          ) : null}
                        </div>
                        {task.started_at ? (
                          <CardCountdownChip key={task.id} task={task} />
                        ) : null}
                      </article>
                    );
                  })}
                  {columnTasks.length === 0 ? (
                    <p className="pb-empty">
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
                      className="pb-more"
                      onClick={() => setExpandedCompleted((value) => !value)}
                    >
                      {expandedCompleted ? '收起已完成' : `展开全部 ${columnTasks.length} 条`}
                    </button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </section>
      ) : (
        <section className="pb-list" aria-label="任务列表">
          <div className="pb-list-filters">
            {[
              ['all', '全部'],
              ['open', '未完成'],
              ['completed', '已完成'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={listFilter === key ? 'pb-filter active' : 'pb-filter'}
                aria-pressed={listFilter === key}
                onClick={() => setListFilter(key as typeof listFilter)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pb-list-rows">
            {listTasksView.map((task) => {
              const overdue =
                task.due_date && task.status !== 'completed' && task.due_date < todayLocal();
              return (
                <div key={task.id} className="pb-list-row">
                  <button
                    type="button"
                    className={`pb-status sm tone-${task.status}`}
                    onClick={() => void cycleStatus(task)}
                    title="点击循环：待办 → 进行中 → 已完成"
                  >
                    {TASK_STATUS_LABELS[task.status]}
                  </button>
                  <button type="button" className="pb-title sm" onClick={() => openTask(task.id)}>
                    {task.title}
                  </button>
                  <span className={`pb-list-pri tone-${task.priority}`}>
                    <i className={`pb-pdot ${task.priority}`} aria-hidden />
                    {TASK_PRIORITY_LABELS[task.priority]}
                  </span>
                  <span className={`pb-list-date${overdue ? ' is-over' : ''}`}>
                    {task.due_date || '—'}
                  </span>
                  <span className="pb-list-min">
                    {task.started_at ? (
                      <CardCountdownChip key={task.id} task={task} asText />
                    ) : task.minutes_total > 0 ? (
                      formatMinutes(task.minutes_total)
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              );
            })}
            {listTasksView.length === 0 ? <p className="pb-empty line">这个筛选下没有任务。</p> : null}
          </div>
        </section>
      )}

      {createOpen ? (
        <div className="sheet-backdrop" onMouseDown={() => !saving && setCreateOpen(false)}>
          <section className="drawer-panel" onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="sheet-close" onClick={() => setCreateOpen(false)}>
              ×
            </button>
            <h2>给这个项目加一步行动</h2>
            <form className="stack-form" onSubmit={createTaskFn}>
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
                开始日期
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label>
                截止日期
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={startDate || todayLocal()} />
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
        />
      ) : null}
    </div>
  );
}

// 项目级耗时：不依附任何任务，直接记在项目上。
function ProjectTimeSection({
  projectId,
  readOnly,
  onMinutesChange,
}: {
  projectId: string;
  readOnly: boolean;
  onMinutesChange: (total: number) => void;
}) {
  const db = useStore();
  const entries = useMemo(
    () => listProjectTimeEntries(db, projectId),
    [db, projectId],
  );
  const [minutes, setMinutes] = useState('30');
  const [date, setDate] = useState(localDateString());
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const total = entries.reduce((sum, item) => sum + item.minutes, 0);
    onMinutesChange(total);
  }, [entries, onMinutesChange]);

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    setError('');
    const today = localDateString();
    try {
      const input = parseProjectTimeEntryInput(
        { minutes: Number(minutes), logged_date: date, note },
        today,
      );
      mutate((draft) => {
        if (editingId) updateProjectTimeEntry(draft, editingId, input);
        else createProjectTimeEntry(draft, projectId, input);
      });
      setMinutes('30');
      setDate(localDateString());
      setNote('');
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存耗时失败');
    }
  }

  function startEdit(entry: ProjectTimeEntry) {
    setEditingId(entry.id);
    setMinutes(String(entry.minutes));
    setDate(entry.logged_date);
    setNote(entry.note || '');
  }

  function remove(entryId: string) {
    if (readOnly) return;
    if (!window.confirm('确定删除这条耗时记录吗？')) return;
    try {
      mutate((draft) => {
        deleteProjectTimeEntry(draft, entryId);
      });
    } catch {
      // silent
    }
  }

  return (
    <section className="pb-time">
      <div className="pb-time-head">
        <strong>项目耗时</strong>
        <span className="muted">不归属任何任务，直接记在项目上</span>
      </div>
      <div className="pb-time-list">
        {entries.map((entry) => (
          <div key={entry.id} className="pb-time-row">
            <div>
              <strong>{formatMinutes(entry.minutes)}</strong>
              <span className="muted"> · {entry.logged_date}</span>
              {entry.note ? <p className="muted">{entry.note}</p> : null}
            </div>
            {!readOnly ? (
              <div className="subtask-actions">
                <button type="button" className="text-button" onClick={() => startEdit(entry)}>
                  编辑
                </button>
                <button
                  type="button"
                  className="text-button danger-text"
                  onClick={() => void remove(entry.id)}
                >
                  删除
                </button>
              </div>
            ) : null}
          </div>
        ))}
        {entries.length === 0 ? <p className="muted line">还没有项目级耗时。记录一段不依附任何任务的投入。</p> : null}
      </div>
      {readOnly ? (
        <p className="muted">已归档项目为只读。</p>
      ) : (
        <form className="stack-form compact" onSubmit={save}>
          <div className="meta-grid">
            <label>
              分钟
              <input
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                required
              />
            </label>
            <label>
              日期
              <input
                type="date"
                value={date}
                max={localDateString()}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
          </div>
          <label>
            备注
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="可选" />
          </label>
          <div className="inline-actions">
            <button type="submit" className="secondary-button">
              {editingId ? '更新耗时' : '添加耗时'}
            </button>
            {editingId ? (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setEditingId(null);
                  setMinutes('30');
                  setDate(localDateString());
                  setNote('');
                }}
              >
                取消编辑
              </button>
            ) : null}
          </div>
          {error ? <p className="form-error">{error}</p> : null}
        </form>
      )}
    </section>
  );
}

function TaskDrawer({
  taskId,
  projectId,
  onClose,
}: {
  taskId: string;
  projectId: string;
  onClose: () => void;
}) {
  const db = useStore();
  const task = useMemo(() => getTask(db, taskId), [db, taskId]);
  const subtasks = useMemo(() => listSubtasks(db, taskId), [db, taskId]);
  const timeEntries = useMemo(() => listTimeEntries(db, taskId), [db, taskId]);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  // 任务本身的开始日期，与截止日期并列；倒计时与开始日期独立。
  const [startDate, setStartDate] = useState('');
  const [sectionError, setSectionError] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [timeMinutes, setTimeMinutes] = useState('30');
  const [timeDate, setTimeDate] = useState(localDateString());
  const [timeNote, setTimeNote] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Seed form fields once a task is available (or when taskId changes).
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description || '');
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.due_date || '');
    setStartDate(task.start_date || '');
    setDirty(false);
    setEditingEntryId(null);
    setError('');
    setSectionError('');
  }, [task]);

  const minutesTotal = task?.minutes_total ?? 0;
  const projectStatus = task?.project_status ?? 'active';
  const readOnly = projectStatus === 'archived';

  function save() {
    setSaving(true);
    setError('');
    try {
      const patch = parseTaskInput(
        {
          title,
          description,
          priority,
          due_date: dueDate || null,
          start_date: startDate || null,
          status,
          project_id: projectId,
        },
        true,
      );
      mutate((draft) => {
        updateTask(draft, taskId, patch);
      });
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  function quickStatus(next: TaskStatus) {
    if (
      next === 'completed' &&
      subtasks.some((item) => !item.is_done)
    ) {
      if (!window.confirm('还有未完成的子任务，确定把父任务标为已完成吗？')) return;
    }
    setStatus(next);
    try {
      mutate((draft) => {
        updateTask(draft, taskId, { status: next });
      });
      setDirty(false);
    } catch {
      // silent
    }
  }

  function removeTask() {
    if (!window.confirm('确定删除这个任务吗？子任务和耗时会一起删除。')) return;
    try {
      mutate((draft) => {
        deleteTask(draft, taskId);
      });
      onClose();
    } catch {
      // silent
    }
  }

  function addSubtask(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    setSectionError('');
    try {
      const input = parseSubtaskInput({ title: subtaskTitle });
      mutate((draft) => {
        createSubtask(draft, taskId, input);
      });
      setSubtaskTitle('');
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : '添加子任务失败');
    }
  }

  function toggleSubtask(subtask: Subtask) {
    if (readOnly) return;
    try {
      mutate((draft) => {
        updateSubtask(draft, subtask.id, { is_done: !subtask.is_done });
      });
    } catch {
      // silent
    }
  }

  function moveSubtaskItem(subtaskId: string, direction: 'up' | 'down') {
    if (readOnly) return;
    try {
      mutate((draft) => {
        moveSubtask(draft, subtaskId, direction);
      });
    } catch {
      // silent
    }
  }

  function removeSubtask(subtaskId: string) {
    if (readOnly) return;
    if (!window.confirm('确定删除这个子任务吗？')) return;
    try {
      mutate((draft) => {
        deleteSubtask(draft, subtaskId);
      });
    } catch {
      // silent
    }
  }

  function saveTimeEntry(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    setSectionError('');
    const today = localDateString();
    try {
      const input = parseTimeEntryInput(
        { minutes: Number(timeMinutes), logged_date: timeDate, note: timeNote },
        today,
      );
      mutate((draft) => {
        if (editingEntryId) updateTimeEntry(draft, editingEntryId, input);
        else createTimeEntry(draft, taskId, input);
      });
      setTimeMinutes('30');
      setTimeDate(localDateString());
      setTimeNote('');
      setEditingEntryId(null);
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : '保存耗时失败');
    }
  }

  function startEditEntry(entry: TimeEntry) {
    setEditingEntryId(entry.id);
    setTimeMinutes(String(entry.minutes));
    setTimeDate(entry.logged_date);
    setTimeNote(entry.note || '');
  }

  function removeTimeEntry(entryId: string) {
    if (readOnly) return;
    if (!window.confirm('确定删除这条耗时记录吗？')) return;
    try {
      mutate((draft) => {
        deleteTimeEntry(draft, entryId);
      });
    } catch {
      // silent
    }
  }

  function requestClose() {
    if (dirty && !window.confirm('有未保存修改，确定放弃吗？')) return;
    onClose();
  }

  if (!task) {
    return (
      <div className="sheet-backdrop" onMouseDown={requestClose}>
        <section className="drawer-panel wide" onMouseDown={(e) => e.stopPropagation()}>
          <button type="button" className="sheet-close" onClick={requestClose}>
            ×
          </button>
          <p className="muted">任务不存在。</p>
        </section>
      </div>
    );
  }

  return (
    <div className="sheet-backdrop" onMouseDown={requestClose}>
      <section className="drawer-panel wide" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="sheet-close" onClick={requestClose}>
          ×
        </button>
        {!readOnly ? (
          <div className="drawer-topbar">
            <button type="button" className="danger-ghost" onClick={() => void removeTask()}>
              删除任务
            </button>
          </div>
        ) : null}
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
                开始日期
                <input
                  type="date"
                  value={startDate}
                  disabled={readOnly}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                截止日期
                <input
                  type="date"
                  value={dueDate}
                  min={startDate || undefined}
                  disabled={readOnly}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
            </div>
            {task ? (
              <CountdownTimer task={task} readOnly={readOnly} />
            ) : null}
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
      </section>
    </div>
  );
}

/**
 * 看板/列表上任务卡里的小倒计时角标：只在计时正在跑时显示，
 * 实时显示剩余 mm:ss。驱动每秒 re-render（用 useCountdown），
 * 到点不在这里落账（落账由抽屉里的 CountdownTimer 负责——
 * 卡片角标只是展示，避免一处计时在两处都 try-finish 造成重复）。
 */
function CardCountdownChip({
  task,
  asText,
}: {
  task: TaskWithMeta;
  asText?: boolean;
}) {
  const remaining = useCountdown(task);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const text = `⏱ ${m}:${String(s).padStart(2, '0')}`;
  if (asText) return <>{text}</>;
  return <span className="pb-meta-cd">{text}</span>;
}
