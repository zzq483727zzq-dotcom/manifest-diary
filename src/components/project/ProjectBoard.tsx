'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  DependencyMode,
  ProjectSummary,
  Subtask,
  TaskDependency,
  DependencyBypass,
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
import { CountdownTimer } from '@/components/project/CountdownTimer';
import { ProjectCountdown } from '@/components/project/ProjectCountdown';
import { useCountdown } from '@/hooks/useCountdown';
import { useStore, mutate } from '@/lib/store/useStore';
import { notifyFocusCompletion } from '@/lib/project/focus-notification';
import {
  addTaskDependency,
  clearTaskBlocked,
  createSubtask,
  createTask,
  deleteProject as deleteProjectRepo,
  deleteSubtask,
  deleteTask,
  deleteTimeEntry,
  finishTaskFocus,
  getTaskBlockers,
  getTask,
  getProjectSummary,
  listDependencyBypasses,
  listSubtasks,
  listTaskDependencies,
  listTasks,
  listTimeEntries,
  moveSubtask,
  moveTaskPosition,
  pauseTimer,
  removeTaskDependency,
  setTaskBlocked,
  startTaskFocus,
  taskRemainingSeconds,
  updateSubtask,
  updateTask,
} from '@/lib/store/repository';
import {
  parseSubtaskInput,
  parseTaskInput,
} from '@/lib/project/validation';
import type { TaskInput } from '@/lib/project/validation';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'completed'];

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sortTasks(tasks: TaskWithMeta[], manual = false): TaskWithMeta[] {
  const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    // 手动排序模式：完全按 position（靠 moveTaskPosition 维护），其余字段不参与。
    // 否则用 优先级 → 截止日 → position → 创建时间 的复合排序。
    if (manual) {
      if (a.position !== b.position) return a.position - b.position;
      return a.created_at.localeCompare(b.created_at);
    }
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
  initialTasks?: TaskWithMeta[];
  initialTaskId?: string;
}) {
  const router = useRouter();
  const db = useStore();
  const liveProject = useMemo(
    () => getProjectSummary(db, project.id) ?? project,
    [db, project],
  );
  const [view, setView] = useState<'board' | 'list'>('board');
  // 列表视图的手动排序开关：开启后按 position 排（靠 moveTaskPosition 维护），
  // 关闭时走 优先级 → 截止 日的复合自动排序。只在 list 视图生效。
  const [manualSort, setManualSort] = useState(false);
  const tasks = useMemo(() => listTasks(db, project.id), [db, project.id]);
  const [listFilter, setListFilter] = useState<'all' | 'open' | 'completed'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(initialTaskId ?? null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [targetMinutes, setTargetMinutes] = useState('25');
  // 快速建任务的截止/开始日期（可选），填补之前强制为 null 的缺口。
  const [createDueDate, setCreateDueDate] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedCompleted, setExpandedCompleted] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('clarity-project-view');
    if (stored === 'board' || stored === 'list') setView(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('clarity-project-view', view);
  }, [view]);

  useEffect(() => {
    const stored = window.localStorage.getItem('clarity-manual-sort');
    setManualSort(stored === '1');
  }, []);

  useEffect(() => {
    window.localStorage.setItem('clarity-manual-sort', manualSort ? '1' : '0');
  }, [manualSort]);

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
    const sorted = sortTasks(tasks, manualSort);
    if (listFilter === 'open') return sorted.filter((task) => task.status !== 'completed');
    if (listFilter === 'completed') return sorted.filter((task) => task.status === 'completed');
    return sorted;
  }, [tasks, listFilter, manualSort]);

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
        target_minutes: Number(targetMinutes),
        due_date: createDueDate || null,
        start_date: createStartDate || null,
      }) as TaskInput;
      mutate((draft) => {
        createTask(draft, input);
      });
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setPriority('medium');
      setTargetMinutes('25');
      setCreateDueDate('');
      setCreateStartDate('');
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
    if (nextStatus === 'in_progress') {
      const blockers = getTaskBlockers(db, task.id);
      const reason = blockers.ready
        ? undefined
        : window.prompt(`任务当前被阻塞：${blockers.labels.join('；')}\n请输入绕过原因`)?.trim();
      if (!blockers.ready && !reason) return;
      try {
        mutate((draft) => startTaskFocus(draft, task.id, reason ? { bypass: true, reason } : undefined));
      } catch {
        // silent: status toggle is best-effort
      }
      return;
    }
    if (nextStatus === 'completed' && task.subtask_total > 0 && task.subtask_done < task.subtask_total) {
      if (!window.confirm('还有未完成的子任务，确定把父任务标为已完成吗？')) return;
    }
    try {
      mutate((draft) => { updateTask(draft, task.id, { status: nextStatus }); });
    } catch {
      // silent: status toggle is best-effort
    }
  }

  function openTask(taskId: string) {
    setDrawerTaskId(taskId);
    router.replace(`/projects/detail?id=${project.id}&task=${taskId}`);
  }

  function moveTaskRow(taskId: string, direction: 'up' | 'down') {
    try {
      mutate((draft) => { moveTaskPosition(draft, taskId, direction, manualSort); });
    } catch {
      // silent: position swap is best-effort
    }
  }

  function closeDrawer() {
    setDrawerTaskId(null);
    router.replace(`/projects/detail?id=${project.id}`);
  }

  function toggleTaskTimer(task: TaskWithMeta) {
    if (task.status === 'completed') return;
    if (task.started_at) {
      mutate((draft) => pauseTimer(draft, task.id));
      return;
    }
    const blockers = getTaskBlockers(db, task.id);
    const bypass = !blockers.ready;
    const reason = bypass
      ? window.prompt(`任务当前被阻塞：${blockers.labels.join('；')}\n请输入绕过原因`)?.trim()
      : undefined;
    if (bypass && !reason) return;
    mutate((draft) => {
      startTaskFocus(draft, task.id, bypass ? { bypass: true, reason } : undefined);
    });
  }

  function finishTaskEarly(task: TaskWithMeta) {
    if (task.status === 'completed') return;
    if (!window.confirm('提前结束并完成这个任务吗？已专注时间会保存。')) return;
    mutate((draft) => {
      finishTaskFocus(draft, task.id);
    });
  }

  function deleteProject() {
    if (!window.confirm(`确定删除项目「${project.name}」吗？项目下的任务、子任务和全部耗时记录都会一起删除，且无法撤销。`)) {
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
              项目专注<em>{formatMinutes(project.minutes_total)}</em>
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
          <ProjectCountdown project={liveProject} readOnly={project.status === 'archived'} />
          <button
            type="button"
            className="primary-button pb-new"
            onClick={() => {
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
                        {task.status !== 'completed' && project.status !== 'archived' ? (
                          <div className="pb-focus-actions">
                            <button
                              type="button"
                              className="pb-focus-button"
                              onClick={() => toggleTaskTimer(task)}
                            >
                              {task.started_at ? '暂停' : '开始专注'}
                            </button>
                            {task.started_at || task.elapsed_seconds > 0 ? (
                              <button
                                type="button"
                                className="pb-focus-end"
                                onClick={() => finishTaskEarly(task)}
                              >
                                提前结束
                              </button>
                            ) : null}
                          </div>
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
            <label className="pb-manual-toggle" title="开启后按你手动排的顺序显示，关闭则自动按优先级/截止日排">
              <input
                type="checkbox"
                checked={manualSort}
                onChange={(e) => setManualSort(e.target.checked)}
              />
              手动排序
            </label>
          </div>
          <div className="pb-list-rows">
            {listTasksView.map((task, index) => {
              const overdue =
                task.due_date && task.status !== 'completed' && task.due_date < todayLocal();
              // 手动排序下，按方向键的禁用判定：相邻同 status 兄弟不存在时禁用。
              const prevSibling = index > 0 ? listTasksView[index - 1] : null;
              const nextSibling = index < listTasksView.length - 1 ? listTasksView[index + 1] : null;
              const canMoveUp = !!prevSibling && prevSibling.status === task.status;
              const canMoveDown = !!nextSibling && nextSibling.status === task.status;
              return (
                <div key={task.id} className={manualSort ? 'pb-list-row pb-manual-row' : 'pb-list-row'}>
                  {manualSort ? (
                    <div className="pb-reorder-actions" aria-label="移动任务顺序">
                      <button
                        type="button"
                        className="text-button sm"
                        disabled={!canMoveUp}
                        onClick={() => moveTaskRow(task.id, 'up')}
                        title="上移"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="text-button sm"
                        disabled={!canMoveDown}
                        onClick={() => moveTaskRow(task.id, 'down')}
                        title="下移"
                      >
                        ↓
                      </button>
                    </div>
                  ) : null}
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
                  {task.status !== 'completed' ? (
                    <div className="pb-focus-actions">
                      <button
                        type="button"
                        className="pb-focus-button sm"
                        onClick={() => toggleTaskTimer(task)}
                      >
                        {task.started_at ? '暂停' : '开始专注'}
                      </button>
                      {task.started_at || task.elapsed_seconds > 0 ? (
                        <button
                          type="button"
                          className="pb-focus-end sm"
                          onClick={() => finishTaskEarly(task)}
                        >
                          提前结束
                        </button>
                      ) : null}
                    </div>
                  ) : null}
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
                专注时长
                <div className="input-with-suffix">
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={targetMinutes}
                    onChange={(e) => setTargetMinutes(e.target.value)}
                    required
                  />
                  <span>分钟</span>
                </div>
              </label>
              <div className="stack-form-row">
                <label>
                  开始日期
                  <input
                    type="date"
                    value={createStartDate}
                    onChange={(e) => setCreateStartDate(e.target.value)}
                  />
                </label>
                <label>
                  截止日期
                  <input
                    type="date"
                    value={createDueDate}
                    min={createStartDate || undefined}
                    onChange={(e) => setCreateDueDate(e.target.value)}
                  />
                </label>
              </div>
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

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [sectionError, setSectionError] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
  const [estimateMinutes, setEstimateMinutes] = useState('25');
  const [dependencyMode, setDependencyMode] = useState<DependencyMode>('all');
  const [blockedReason, setBlockedReason] = useState('');
  const [depTargetTaskId, setDepTargetTaskId] = useState('');

  // Seed form fields once a task is available (or when taskId changes).
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description || '');
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.due_date || '');
    setStartDate(task.start_date || '');
    setEstimateMinutes(String(task.estimate_minutes ?? 25));
    setDependencyMode(task.dependency_mode ?? 'all');
    setBlockedReason(task.blocked_reason ?? '');
    setDirty(false);
    setError('');
    setSectionError('');
  }, [task]);

  const minutesTotal = task?.minutes_total ?? 0;
  const timeEntries = useMemo(
    () => (task ? listTimeEntries(db, taskId) : []),
    [db, taskId, task],
  );
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const projectStatus = task?.project_status ?? 'active';
  const readOnly = projectStatus === 'archived';
  const dependencies = useMemo(
    () => (task ? listTaskDependencies(db, taskId) : []),
    [db, taskId, task],
  );
  const bypasses = useMemo(
    () => (task ? listDependencyBypasses(db, taskId) : []),
    [db, taskId, task],
  );
  const blockers = useMemo(
    () => (task ? getTaskBlockers(db, taskId) : null),
    [db, taskId, task],
  );
  const projectTasks = useMemo(
    () => task ? listTasks(db, task.project_id).filter((t) => t.id !== taskId && t.status !== 'completed') : [],
    [db, taskId, task],
  );

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
          estimate_minutes: Number(estimateMinutes),
          dependency_mode: dependencyMode,
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
    if (!task) return;
    if (next === 'in_progress' && task.status !== 'in_progress') {
      const blockers = getTaskBlockers(db, task.id);
      const reason = blockers.ready
        ? undefined
        : window.prompt(`任务当前被阻塞：${blockers.labels.join('；')}\n请输入绕过原因`)?.trim();
      if (!blockers.ready && !reason) return;
      try {
        const formPatch = parseTaskInput({ title, description, priority, due_date: dueDate || null, start_date: startDate || null, status: task.status, project_id: projectId }, true);
        mutate((draft) => {
          updateTask(draft, taskId, { ...formPatch, status: task.status });
          startTaskFocus(draft, taskId, reason ? { bypass: true, reason } : undefined);
        });
        setDirty(false);
      } catch { /* silent */ }
      return;
    }
    if (next === 'completed' && subtasks.some((item) => !item.is_done)) {
      if (!window.confirm('还有未完成的子任务，确定把父任务标为已完成吗？')) return;
    }
    setStatus(next);
    try {
      const formPatch = parseTaskInput({ title, description, priority, due_date: dueDate || null, start_date: startDate || null, status: task.status, project_id: projectId }, true);
      mutate((draft) => { updateTask(draft, taskId, { ...formPatch, status: next }); });
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

  function removeTimeEntry(entryId: string, minutes: number) {
    if (!window.confirm(`确定删除这条耗时记录（${formatMinutes(minutes)}）？`)) return;
    setDeletingEntryId(entryId);
    try {
      mutate((draft) => {
        deleteTimeEntry(draft, entryId);
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeletingEntryId(null);
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

  function startEditSubtask(subtask: Subtask) {
    if (readOnly) return;
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
  }

  function commitEditSubtask(subtaskId: string | null) {
    if (!subtaskId) {
      setEditingSubtaskId(null);
      return;
    }
    const trimmed = editingSubtaskTitle.trim();
    const original = subtasks.find((item) => item.id === subtaskId)?.title ?? '';
    setEditingSubtaskId(null);
    setEditingSubtaskTitle('');
    if (!trimmed || trimmed === original) return;
    try {
      const input = parseSubtaskInput({ title: trimmed });
      mutate((draft) => {
        updateSubtask(draft, subtaskId, input);
      });
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : '保存失败');
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
              <label>
                预计时长
                <div className="input-with-suffix">
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={estimateMinutes}
                    disabled={readOnly}
                    onChange={(e) => {
                      setEstimateMinutes(e.target.value);
                      setDirty(true);
                    }}
                  />
                  <span>分钟</span>
                </div>
              </label>
              <label>
                依赖模式
                <select
                  value={dependencyMode}
                  disabled={readOnly}
                  onChange={(e) => {
                    setDependencyMode(e.target.value as DependencyMode);
                    setDirty(true);
                  }}
                >
                  <option value="all">全部完成</option>
                  <option value="any">任一完成</option>
                </select>
              </label>
            </div>
            {task ? (
              <CountdownTimer
                task={task}
                readOnly={readOnly}
                onBlockedStart={(currentTask) => {
                  const blockers = getTaskBlockers(db, currentTask.id);
                  if (blockers.ready) return { bypass: false };
                  const reason = window.prompt(`任务当前被阻塞：${blockers.labels.join('；')}\n请输入绕过原因`)?.trim();
                  return reason ? { bypass: true, reason } : null;
                }}
              />
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

            {task && blockers ? (
              <section className="drawer-section">
                <div className="drawer-section-head">
                  <strong>执行条件</strong>
                  {blockers.ready ? (
                    <span className="eco-ready">就绪</span>
                  ) : (
                    <span className="eco-blocked">阻塞</span>
                  )}
                </div>

                {/* 阻塞状态 */}
                {!blockers.ready ? (
                  <div className="eco-blocker-list">
                    {blockers.labels.map((label, i) => (
                      <div key={i} className="eco-blocker-item">{label}</div>
                    ))}
                  </div>
                ) : null}

                {/* 依赖列表 */}
                {dependencies.length > 0 ? (
                  <div className="subtask-list">
                    {dependencies.map((dep) => {
                      const depTask = projectTasks.find((t) => t.id === dep.depends_on_task_id);
                      return (
                        <div key={dep.id} className="subtask-row">
                          <span>{depTask?.title ?? dep.depends_on_task_id}</span>
                          {!readOnly ? (
                            <div className="subtask-actions">
                              <button
                                type="button"
                                className="text-button danger-text"
                                onClick={() => {
                                  mutate((draft) => {
                                    removeTaskDependency(draft, dep.id);
                                  });
                                }}
                              >
                                移除
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">没有设置依赖任务。</p>
                )}

                {/* 添加依赖 */}
                {!readOnly && projectTasks.length > 0 ? (
                  <form
                    className="inline-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!depTargetTaskId) return;
                      try {
                        mutate((draft) => {
                          addTaskDependency(draft, taskId, depTargetTaskId);
                        });
                        setDepTargetTaskId('');
                      } catch (err) {
                        setSectionError(err instanceof Error ? err.message : '添加依赖失败');
                      }
                    }}
                  >
                    <select
                      value={depTargetTaskId}
                      onChange={(e) => setDepTargetTaskId(e.target.value)}
                      required
                    >
                      <option value="">选择依赖任务…</option>
                      {projectTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.status === 'completed' ? '已完成' : t.status === 'in_progress' ? '进行中' : '待办'})
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="secondary-button" disabled={!depTargetTaskId}>
                      添加
                    </button>
                  </form>
                ) : null}

                {/* 外部阻塞 */}
                {!readOnly ? (
                  <div className="eco-block-form">
                    {task.is_blocked ? (
                      <div className="eco-blocked-row">
                        <span className="eco-blocked-label">已阻塞：{task.blocked_reason}</span>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            mutate((draft) => {
                              clearTaskBlocked(draft, taskId);
                            });
                          }}
                        >
                          解除阻塞
                        </button>
                      </div>
                    ) : (
                      <form
                        className="inline-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!blockedReason.trim()) return;
                          try {
                            mutate((draft) => {
                              setTaskBlocked(draft, taskId, blockedReason.trim());
                            });
                            setBlockedReason('');
                          } catch (err) {
                            setSectionError(err instanceof Error ? err.message : '设置阻塞失败');
                          }
                        }}
                      >
                        <input
                          value={blockedReason}
                          onChange={(e) => setBlockedReason(e.target.value)}
                          placeholder="阻塞原因"
                          maxLength={200}
                          required
                        />
                        <button type="submit" className="secondary-button" disabled={!blockedReason.trim()}>
                          设为阻塞
                        </button>
                      </form>
                    )}
                  </div>
                ) : null}
              </section>
            ) : null}

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
                    {editingSubtaskId === subtask.id && !readOnly ? (
                      <input
                        className="subtask-edit-input"
                        value={editingSubtaskTitle}
                        autoFocus
                        maxLength={120}
                        onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                        onBlur={() => commitEditSubtask(subtask.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            (e.currentTarget as HTMLInputElement).blur();
                          } else if (e.key === 'Escape') {
                            setEditingSubtaskId(null);
                            setEditingSubtaskTitle('');
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`subtask-title-btn${subtask.is_done ? ' is-done' : ''}`}
                        disabled={readOnly}
                        title={readOnly ? subtask.title : '点击改名'}
                        onClick={() => startEditSubtask(subtask)}
                      >
                        {subtask.title}
                      </button>
                    )}
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
                <strong>专注时间</strong>
                <span>累计 {formatMinutes(minutesTotal)}</span>
              </div>
              {timeEntries.length > 0 ? (
                <div className="time-entry-list drawer-time-list">
                  {timeEntries.map((entry) => (
                    <div key={entry.id} className="drawer-time-row">
                      <span className="drawer-time-date">{entry.logged_date}</span>
                      <strong className="drawer-time-mins">{formatMinutes(entry.minutes)}</strong>
                      <span className="drawer-time-note">{entry.note || '专注计时'}</span>
                      {!readOnly ? (
                        <button
                          type="button"
                          className="text-button danger-text"
                          disabled={deletingEntryId === entry.id}
                          onClick={() => removeTimeEntry(entry.id, entry.minutes)}
                        >
                          删除
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">还没有专注计时记录。</p>
              )}
            </section>

            {bypasses.length > 0 ? (
              <section className="drawer-section">
                <div className="drawer-section-head">
                  <strong>绕过记录</strong>
                  <span>{bypasses.length}</span>
                </div>
                <div className="subtask-list">
                  {bypasses.map((b) => (
                    <div key={b.id} className="subtask-row">
                      <span className="bypass-reason">{b.reason}</span>
                      <span className="bypass-meta">
                        {b.created_at.slice(0, 10)} · {b.dependency_ids.length > 0 ? `${b.dependency_ids.length} 条依赖` : '外部阻塞'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

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
  const remaining = useCountdown(task, (item, now) => taskRemainingSeconds(item, now));
  const finishedRef = useRef(false);

  useEffect(() => {
    finishedRef.current = false;
  }, [task.started_at, task.elapsed_seconds]);

  useEffect(() => {
    if (!task.started_at || remaining > 0 || finishedRef.current) return;
    finishedRef.current = true;
    notifyFocusCompletion(task.id, task.started_at);
    mutate((draft) => {
      finishTaskFocus(draft, task.id);
    });
  }, [remaining, task.id, task.started_at]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const text = `⏱ ${m}:${String(s).padStart(2, '0')}`;
  if (asText) return <>{text}</>;
  return <span className="pb-meta-cd">{text}</span>;
}
