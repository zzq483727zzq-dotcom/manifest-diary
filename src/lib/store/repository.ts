import { localDateString } from '@/lib/project/date';
import type {
  BackupPayload,
  DependencyBypass,
  DependencyMode,
  Project,
  ProjectColor,
  ProjectStatus,
  ProjectSummary,
  ProjectTimeEntry,
  DailyReviewPoint,
  ReviewStats,
  Subtask,
  Task,
  TaskBlockers,
  TaskDependency,
  TaskPriority,
  TaskStatus,
  TaskWithMeta,
  TimeEntry,
  TodayGroups,
  WeekStats,
} from '@/types/project';
export type { BackupPayload, TaskBlockers, TodayGroups, WeekStats };
import type {
  ProjectInput,
  ProjectTimeEntryInput,
  SubtaskInput,
  TaskInput,
  TimeEntryInput,
} from '@/lib/project/validation';
import {
  type ClarityDB,
  nowIso,
  todayStr,
  uuid,
} from '@/lib/store/store';

/**
 * Client-side repository for the static export build. Intent: be a drop-in
 * semantic twin of `src/lib/project/repository.ts` so page/component code
 * only needs to swap the import + drop the fetch. Operates on a ClarityDB
 * passed in by the caller (from `useStore`), keeping every mutation pure
 * and testable — no localStorage access here; persistence is the caller's
 * job (see `useStore.mutate`).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function taskMinutesTotal(db: ClarityDB, taskId: string): number {
  return db.timeEntries
    .filter((entry) => entry.task_id === taskId)
    .reduce((sum, entry) => sum + entry.minutes, 0);
}

function taskSubtaskStats(db: ClarityDB, taskId: string) {
  const subs = db.subtasks.filter((sub) => sub.task_id === taskId);
  return {
    subtask_total: subs.length,
    subtask_done: subs.filter((sub) => sub.is_done).length,
  };
}

function projectMinutesTotal(db: ClarityDB, projectId: string): number {
  const taskIds = new Set(
    db.tasks.filter((task) => task.project_id === projectId).map((task) => task.id),
  );
  const taskMinutes = db.timeEntries
    .filter((entry) => taskIds.has(entry.task_id))
    .reduce((sum, entry) => sum + entry.minutes, 0);
  const projectMinutes = db.projectTimeEntries
    .filter((entry) => entry.project_id === projectId)
    .reduce((sum, entry) => sum + entry.minutes, 0);
  return taskMinutes + projectMinutes;
}

function nearestDueDate(db: ClarityDB, projectId: string): string | null {
  const dates = db.tasks
    .filter(
      (task) =>
        task.project_id === projectId &&
        task.status !== 'completed' &&
        task.due_date != null,
    )
    .map((task) => task.due_date as string)
    .sort((a, b) => a.localeCompare(b));
  return dates.length ? dates[0] : null;
}

function withMeta(db: ClarityDB, task: Task): TaskWithMeta {
  const project = db.projects.find((project) => project.id === task.project_id);
  const stats = taskSubtaskStats(db, task.id);
  return {
    ...task,
    project_name: project?.name ?? '',
    project_color: (project?.color ?? '#5EEAD4') as ProjectColor,
    project_status: project?.status ?? 'active',
    minutes_total: taskMinutesTotal(db, task.id),
    subtask_total: stats.subtask_total,
    subtask_done: stats.subtask_done,
  };
}

function touchProject(db: ClarityDB, projectId: string, at = nowIso()) {
  const project = db.projects.find((project) => project.id === projectId);
  if (project) project.updated_at = at;
}

function nextTaskPosition(
  db: ClarityDB,
  projectId: string,
  status: TaskStatus,
): number {
  const siblings = db.tasks.filter(
    (task) => task.project_id === projectId && task.status === status,
  );
  if (siblings.length === 0) return 0;
  return Math.min(...siblings.map((task) => task.position)) - 1;
}

function getProject(db: ClarityDB, id: string): Project | null {
  return db.projects.find((project) => project.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function listProjects(
  db: ClarityDB,
  status?: ProjectStatus | 'all',
): ProjectSummary[] {
  const filtered =
    status && status !== 'all'
      ? db.projects.filter((project) => project.status === status)
      : db.projects.slice();

  return filtered
    .map((project) => {
      const total = db.tasks.filter((task) => task.project_id === project.id).length;
      const completed = db.tasks.filter(
        (task) => task.project_id === project.id && task.status === 'completed',
      ).length;
      return {
        ...project,
        task_total: total,
        task_completed: completed,
        progress: total === 0 ? 0 : completed / total,
        minutes_total: projectMinutesTotal(db, project.id),
        nearest_due_date: nearestDueDate(db, project.id),
      };
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getProjectSummary(
  db: ClarityDB,
  id: string,
): ProjectSummary | null {
  return listProjects(db, 'all').find((project) => project.id === id) ?? null;
}

export function createProject(db: ClarityDB, input: ProjectInput): Project {
  const id = uuid();
  const at = nowIso();
  const project: Project = {
    id,
    name: input.name,
    description: input.description,
    color: input.color,
    target_date: input.target_date,
    start_date: input.start_date,
    status: 'active',
    created_at: at,
    updated_at: at,
    completed_at: null,
    target_minutes: 25,
    started_at: null,
    elapsed_seconds: 0,
  };
  db.projects.push(project);
  return project;
}

export function updateProject(db: ClarityDB, id: string, input: ProjectInput): Project {
  const existing = getProject(db, id);
  if (!existing) throw new Error('项目不存在');
  const at = nowIso();
  existing.name = input.name;
  existing.description = input.description;
  existing.color = input.color;
  existing.target_date = input.target_date;
  existing.start_date = input.start_date;
  existing.updated_at = at;
  return existing;
}

export function setProjectStatus(
  db: ClarityDB,
  id: string,
  status: ProjectStatus,
): Project {
  const existing = getProject(db, id);
  if (!existing) throw new Error('项目不存在');
  const at = nowIso();
  existing.status = status;
  existing.completed_at = status === 'completed' ? at : null;
  existing.updated_at = at;
  return existing;
}

export function deleteProject(db: ClarityDB, id: string) {
  const existing = getProject(db, id);
  if (!existing) throw new Error('项目不存在');
  const taskIds = db.tasks
    .filter((task) => task.project_id === id)
    .map((task) => task.id);
  db.timeEntries = db.timeEntries.filter(
    (entry) => !taskIds.includes(entry.task_id),
  );
  db.subtasks = db.subtasks.filter((sub) => !taskIds.includes(sub.task_id));
  db.tasks = db.tasks.filter((task) => task.project_id !== id);
  db.projectTimeEntries = db.projectTimeEntries.filter(
    (entry) => entry.project_id !== id,
  );
  db.projects = db.projects.filter((project) => project.id !== id);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function listTasks(db: ClarityDB, projectId?: string): TaskWithMeta[] {
  const tasks = projectId
    ? db.tasks.filter((task) => task.project_id === projectId)
    : db.tasks.slice();
  return tasks
    .map((task) => withMeta(db, task))
    .sort((a, b) =>
      projectId
        ? a.position - b.position || a.created_at.localeCompare(b.created_at)
        : Number(b.due_date != null) - Number(a.due_date != null) ||
          (a.due_date && b.due_date ? a.due_date.localeCompare(b.due_date) : 0) ||
          b.created_at.localeCompare(a.created_at),
    );
}

export function getTask(db: ClarityDB, id: string): TaskWithMeta | null {
  const task = db.tasks.find((task) => task.id === id);
  return task ? withMeta(db, task) : null;
}

export function getTaskEntity(db: ClarityDB, id: string): Task | null {
  return db.tasks.find((task) => task.id === id) ?? null;
}

export function createTask(db: ClarityDB, input: TaskInput): TaskWithMeta {
  const project = getProject(db, input.project_id);
  if (!project) throw new Error('项目不存在');
  if (project.status === 'archived') throw new Error('已归档项目不能新增任务');

  const id = uuid();
  const at = nowIso();
  const position = nextTaskPosition(db, input.project_id, input.status);
  const task: Task = {
    id,
    project_id: input.project_id,
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    due_date: input.due_date,
    start_date: input.start_date ?? null,
    position,
    target_minutes:
      typeof input.target_minutes === 'number' && Number.isFinite(input.target_minutes)
        ? input.target_minutes
        : 25,
    started_at: null,
    elapsed_seconds: 0,
    created_at: at,
    updated_at: at,
    completed_at: input.status === 'completed' ? at : null,
    estimate_minutes:
      typeof input.estimate_minutes === 'number' && Number.isFinite(input.estimate_minutes)
        ? input.estimate_minutes
        : 25,
    dependency_mode: input.dependency_mode === 'any' ? 'any' : 'all',
    is_blocked: false,
    blocked_reason: null,
    blocked_at: null,
  };
  db.tasks.push(task);
  touchProject(db, input.project_id, at);
  return getTask(db, id)!;
}

export function updateTask(
  db: ClarityDB,
  id: string,
  patch: Partial<TaskInput>,
): TaskWithMeta {
  const existing = getTaskEntity(db, id);
  if (!existing) throw new Error('任务不存在');

  const nextProjectId = patch.project_id ?? existing.project_id;
  const nextProject = getProject(db, nextProjectId);
  if (!nextProject) throw new Error('项目不存在');
  if (nextProject.status === 'archived') throw new Error('不能移动到已归档项目');

  if (patch.title != null) existing.title = patch.title;
  if (patch.description != null) existing.description = patch.description;
  // 旧状态先记下，用于：completed 保留 completed_at、以及"切到完成时自动停计时"。
  const prevStatus = existing.status;
  const status = patch.status ?? prevStatus;
  if (patch.priority != null) existing.priority = patch.priority;
  if (patch.due_date !== undefined) existing.due_date = patch.due_date;
  if (patch.start_date !== undefined) existing.start_date = patch.start_date;
  if (patch.estimate_minutes !== undefined) existing.estimate_minutes = patch.estimate_minutes;
  if (patch.dependency_mode !== undefined) existing.dependency_mode = patch.dependency_mode;

  const at = nowIso();
  // 切到「已完成」时，无论计时正在运行还是已暂停，都把累计专注落账。
  if (
    status === 'completed' &&
    prevStatus !== 'completed' &&
    (existing.started_at || existing.elapsed_seconds > 0)
  ) {
    // 复用 stopTimer 的落账逻辑（签名 `(db, taskId, opts)`）。
    stopTimer(db, id, { note: '任务完成自动计入' });
  }
  existing.status = status;
  existing.updated_at = at;
  existing.completed_at =
    status === 'completed'
      ? prevStatus === 'completed' && existing.completed_at
        ? existing.completed_at
        : at
      : null;

  if (status !== prevStatus || nextProjectId !== existing.project_id) {
    existing.position = nextTaskPosition(db, nextProjectId, status);
  }
  existing.project_id = nextProjectId;

  touchProject(db, existing.project_id, at);
  if (nextProjectId !== existing.project_id) touchProject(db, nextProjectId, at);
  return getTask(db, id)!;
}

export function deleteTask(db: ClarityDB, id: string) {
  const existing = getTaskEntity(db, id);
  if (!existing) throw new Error('任务不存在');
  const at = nowIso();
  db.timeEntries = db.timeEntries.filter((entry) => entry.task_id !== id);
  db.subtasks = db.subtasks.filter((sub) => sub.task_id !== id);
  // 清理依赖关系：删除以该任务为任意端点的边
  db.taskDependencies = db.taskDependencies.filter(
    (dep) => dep.task_id !== id && dep.depends_on_task_id !== id,
  );
  // 清理绕过记录
  db.dependencyBypasses = db.dependencyBypasses.filter((b) => b.task_id !== id);
  db.tasks = db.tasks.filter((task) => task.id !== id);
  touchProject(db, existing.project_id, at);
}

export function moveTaskPosition(
  db: ClarityDB,
  taskId: string,
  direction: 'up' | 'down',
): TaskWithMeta {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');
  const siblings = listTasks(db, task.project_id).filter(
    (item) => item.status === task.status,
  );
  const index = siblings.findIndex((item) => item.id === taskId);
  if (index < 0) throw new Error('任务不存在');
  const swapWith = direction === 'up' ? siblings[index - 1] : siblings[index + 1];
  if (!swapWith) return getTask(db, taskId)!;

  const at = nowIso();
  const a = db.tasks.find((item) => item.id === task.id)!;
  const b = db.tasks.find((item) => item.id === swapWith.id)!;
  const tmp = a.position;
  a.position = b.position;
  b.position = tmp;
  a.updated_at = at;
  b.updated_at = at;
  touchProject(db, task.project_id, at);
  return getTask(db, taskId)!;
}

// ---------------------------------------------------------------------------
// Task dependencies
// ---------------------------------------------------------------------------

export function listTaskDependencies(db: ClarityDB, taskId: string): TaskDependency[] {
  return db.taskDependencies.filter((dep) => dep.task_id === taskId);
}

export function addTaskDependency(
  db: ClarityDB,
  taskId: string,
  dependsOnTaskId: string,
): TaskDependency {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');
  const dependsOn = getTaskEntity(db, dependsOnTaskId);
  if (!dependsOn) throw new Error('依赖任务不存在');
  if (taskId === dependsOnTaskId) throw new Error('不能依赖自己');
  if (task.project_id !== dependsOn.project_id) throw new Error('只能依赖同一项目');
  if (db.taskDependencies.some(
    (dep) => dep.task_id === taskId && dep.depends_on_task_id === dependsOnTaskId,
  )) {
    throw new Error('依赖关系已存在');
  }

  // DFS cycle detection: check if dependsOnTaskId can reach taskId through existing edges
  const visited = new Set<string>();
  function dfs(currentId: string): boolean {
    if (currentId === taskId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    const outgoing = db.taskDependencies.filter((dep) => dep.task_id === currentId);
    for (const dep of outgoing) {
      if (dfs(dep.depends_on_task_id)) return true;
    }
    return false;
  }
  if (dfs(dependsOnTaskId)) throw new Error('不能形成循环依赖');

  const at = nowIso();
  const dep: TaskDependency = {
    id: uuid(),
    task_id: taskId,
    depends_on_task_id: dependsOnTaskId,
    created_at: at,
  };
  db.taskDependencies.push(dep);
  touchProject(db, task.project_id, at);
  return dep;
}

export function removeTaskDependency(db: ClarityDB, dependencyId: string): void {
  const index = db.taskDependencies.findIndex((dep) => dep.id === dependencyId);
  if (index < 0) throw new Error('依赖关系不存在');
  const dep = db.taskDependencies[index];
  const task = getTaskEntity(db, dep.task_id);
  db.taskDependencies.splice(index, 1);
  if (task) touchProject(db, task.project_id, nowIso());
}

// ---------------------------------------------------------------------------
// Task blockers and readiness
// ---------------------------------------------------------------------------

export function getTaskBlockers(db: ClarityDB, taskId: string): TaskBlockers {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');

  const deps = listTaskDependencies(db, taskId);
  const dependencyIds = deps.map((dep) => dep.depends_on_task_id);
  const unfinishedDependencyIds = dependencyIds.filter((depId) => {
    const depTask = getTaskEntity(db, depId);
    return !depTask || depTask.status !== 'completed';
  });

  const labels: string[] = [];
  if (task.dependency_mode === 'all') {
    // All dependencies must be completed
    if (unfinishedDependencyIds.length > 0) {
      labels.push(`${unfinishedDependencyIds.length} 个依赖未完成`);
    }
  } else {
    // Any mode: at least one must be completed
    if (dependencyIds.length > 0 && unfinishedDependencyIds.length === dependencyIds.length) {
      labels.push('没有依赖已完成');
    }
  }

  if (task.is_blocked && task.blocked_reason) {
    labels.push(`外部阻塞: ${task.blocked_reason}`);
  }

  // Determine readiness
  let ready = true;
  const depReady = task.dependency_mode === 'all'
    ? unfinishedDependencyIds.length === 0
    : dependencyIds.length === 0 || unfinishedDependencyIds.length < dependencyIds.length;
  if (!depReady) ready = false;
  if (task.is_blocked) ready = false;

  return {
    ready,
    dependencyIds,
    unfinishedDependencyIds,
    externalReason: task.is_blocked ? task.blocked_reason : null,
    labels,
  };
}

export function canTaskStart(db: ClarityDB, taskId: string): TaskBlockers {
  return getTaskBlockers(db, taskId);
}

// ---------------------------------------------------------------------------
// External blocking
// ---------------------------------------------------------------------------

export function setTaskBlocked(db: ClarityDB, taskId: string, reason: string): void {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');
  const trimmed = reason.trim();
  if (trimmed.length < 1) throw new Error('阻塞原因不能为空');
  if (trimmed.length > 200) throw new Error('阻塞原因不能超过 200 个字符');
  const at = nowIso();
  task.is_blocked = true;
  task.blocked_reason = trimmed;
  task.blocked_at = at;
  task.updated_at = at;
  touchProject(db, task.project_id, at);
}

export function clearTaskBlocked(db: ClarityDB, taskId: string): void {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');
  const at = nowIso();
  task.is_blocked = false;
  task.blocked_reason = null;
  task.updated_at = at;
  touchProject(db, task.project_id, at);
}

// ---------------------------------------------------------------------------
// Dependency bypasses
// ---------------------------------------------------------------------------

export function listDependencyBypasses(db: ClarityDB, taskId: string): DependencyBypass[] {
  return db.dependencyBypasses
    .filter((b) => b.task_id === taskId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function recordDependencyBypass(
  db: ClarityDB,
  taskId: string,
  dependencyIds: string[],
  reason: string,
): DependencyBypass {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');
  const trimmed = reason.trim();
  if (trimmed.length < 1) throw new Error('绕过原因不能为空');
  if (trimmed.length > 200) throw new Error('绕过原因不能超过 200 个字符');
  const at = nowIso();
  const bypass: DependencyBypass = {
    id: uuid(),
    task_id: taskId,
    dependency_ids: dependencyIds,
    reason: trimmed,
    created_at: at,
  };
  db.dependencyBypasses.push(bypass);
  touchProject(db, task.project_id, at);
  return bypass;
}

// ---------------------------------------------------------------------------
// Subtasks
// ---------------------------------------------------------------------------

export function listSubtasks(db: ClarityDB, taskId: string): Subtask[] {
  return db.subtasks
    .filter((sub) => sub.task_id === taskId)
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

export function createSubtask(db: ClarityDB, taskId: string, input: SubtaskInput): Subtask {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');
  const count = listSubtasks(db, taskId).length;
  if (count >= 20) throw new Error('单个任务最多 20 个子任务');

  const id = uuid();
  const at = nowIso();
  const sub: Subtask = {
    id,
    task_id: taskId,
    title: input.title,
    is_done: Boolean(input.is_done),
    position: count,
    created_at: at,
    updated_at: at,
  };
  db.subtasks.push(sub);
  touchProject(db, task.project_id, at);
  return listSubtasks(db, taskId).find((item) => item.id === id)!;
}

export function updateSubtask(
  db: ClarityDB,
  id: string,
  patch: { title?: string; is_done?: boolean; position?: number },
): Subtask {
  const sub = db.subtasks.find((item) => item.id === id);
  if (!sub) throw new Error('子任务不存在');
  const task = getTaskEntity(db, sub.task_id);
  if (!task) throw new Error('任务不存在');
  const at = nowIso();
  if (patch.title != null) sub.title = patch.title;
  if (patch.is_done != null) sub.is_done = patch.is_done;
  if (patch.position != null) sub.position = patch.position;
  sub.updated_at = at;
  touchProject(db, task.project_id, at);
  return listSubtasks(db, sub.task_id).find((item) => item.id === id)!;
}

export function deleteSubtask(db: ClarityDB, id: string) {
  const sub = db.subtasks.find((item) => item.id === id);
  if (!sub) throw new Error('子任务不存在');
  const task = getTaskEntity(db, sub.task_id);
  if (!task) throw new Error('任务不存在');
  const at = nowIso();
  db.subtasks = db.subtasks.filter((item) => item.id !== id);
  touchProject(db, task.project_id, at);
}

export function moveSubtask(
  db: ClarityDB,
  id: string,
  direction: 'up' | 'down',
): Subtask {
  const sub = db.subtasks.find((item) => item.id === id);
  if (!sub) throw new Error('子任务不存在');
  const siblings = listSubtasks(db, sub.task_id);
  const index = siblings.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('子任务不存在');
  const swapWith = direction === 'up' ? siblings[index - 1] : siblings[index + 1];
  if (!swapWith) return sub;

  const at = nowIso();
  const a = sub;
  const b = db.subtasks.find((item) => item.id === swapWith.id)!;
  const tmp = a.position;
  a.position = b.position;
  b.position = tmp;
  a.updated_at = at;
  b.updated_at = at;
  const task = getTaskEntity(db, sub.task_id);
  if (task) touchProject(db, task.project_id, at);
  return listSubtasks(db, sub.task_id).find((item) => item.id === id)!;
}

// ---------------------------------------------------------------------------
// Time entries
// ---------------------------------------------------------------------------

export function listTimeEntries(db: ClarityDB, taskId: string): TimeEntry[] {
  return db.timeEntries
    .filter((entry) => entry.task_id === taskId)
    .sort((a, b) => b.logged_date.localeCompare(a.logged_date) || b.created_at.localeCompare(a.created_at));
}

export function createTimeEntry(
  db: ClarityDB,
  taskId: string,
  input: TimeEntryInput,
): TimeEntry {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');
  const project = getProject(db, task.project_id);
  if (project?.status === 'archived') throw new Error('已归档项目不能记录耗时');

  const id = uuid();
  const at = nowIso();
  const entry: TimeEntry = {
    id,
    task_id: taskId,
    minutes: input.minutes,
    logged_date: input.logged_date,
    note: input.note,
    created_at: at,
    updated_at: at,
  };
  db.timeEntries.push(entry);
  touchProject(db, task.project_id, at);
  return entry;
}

export function updateTimeEntry(
  db: ClarityDB,
  id: string,
  input: TimeEntryInput,
): TimeEntry {
  const entry = db.timeEntries.find((item) => item.id === id);
  if (!entry) throw new Error('耗时记录不存在');
  const task = getTaskEntity(db, entry.task_id);
  if (!task) throw new Error('任务不存在');
  const project = getProject(db, task.project_id);
  if (project?.status === 'archived') throw new Error('已归档项目不能修改耗时');

  const at = nowIso();
  entry.minutes = input.minutes;
  entry.logged_date = input.logged_date;
  entry.note = input.note;
  entry.updated_at = at;
  touchProject(db, task.project_id, at);
  return entry;
}

export function deleteTimeEntry(db: ClarityDB, id: string) {
  const entry = db.timeEntries.find((item) => item.id === id);
  if (!entry) throw new Error('耗时记录不存在');
  const task = getTaskEntity(db, entry.task_id);
  if (!task) throw new Error('任务不存在');
  const project = getProject(db, task.project_id);
  if (project?.status === 'archived') throw new Error('已归档项目不能删除耗时');
  const at = nowIso();
  db.timeEntries = db.timeEntries.filter((item) => item.id !== id);
  touchProject(db, task.project_id, at);
}

// ---------------------------------------------------------------------------
// Countdown timer
// ---------------------------------------------------------------------------

/**
 * 把任务里"运行中计时态"换算成已专注秒数（实时）。
 * 运行中：累计 + (现在 - started_at)；暂停：就是累计。
 * 不写库，只算给 UI 显示用。
 */
export function taskElapsedSeconds(task: Task, now: number = Date.now()): number {
  const acc = task.elapsed_seconds || 0;
  if (!task.started_at) return acc;
  const started = Date.parse(task.started_at);
  if (!Number.isFinite(started)) return acc;
  return acc + Math.max(0, Math.floor((now - started) / 1000));
}

/**
 * 倒计时剩余秒数：>=0。用于 UI 显示 mm:ss / 判断是否到点。
 */
export function taskRemainingSeconds(task: Task, now: number = Date.now()): number {
  const elapsed = taskElapsedSeconds(task, now);
  const total = Math.max(0, task.target_minutes || 0) * 60;
  return Math.max(0, total - elapsed);
}

/** 开始终倒计时。若已在跑则不改（避免重复起算）。 */
export function startTimer(db: ClarityDB, taskId: string): void {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');
  if (task.status === 'completed') return;
  if (task.started_at) return; // 已在运行，不动
  const previousStatus = task.status;
  task.started_at = nowIso();
  task.status = 'in_progress';
  task.completed_at = null;
  if (previousStatus !== 'in_progress') {
    task.position = nextTaskPosition(db, task.project_id, 'in_progress');
  }
  task.updated_at = task.started_at;
  touchProject(db, task.project_id, task.started_at);
}

/**
 * 暂停倒计时：把 本次运行时长 加进 elapsed_seconds，清 started_at。
 * 不落账（不写 TimeEntry），专注时长保留在 elapsed_seconds 里，可再继续。
 */
export function pauseTimer(db: ClarityDB, taskId: string): void {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');
  if (!task.started_at) return; // 没在跑
  const started = Date.parse(task.started_at);
  const at = nowIso();
  if (Number.isFinite(started)) {
    task.elapsed_seconds += Math.max(0, Math.floor((Date.now() - started) / 1000));
  }
  task.started_at = null;
  task.updated_at = at;
  touchProject(db, task.project_id, at);
}

/**
 * 停止倒计时并把已专注时长落账，状态归零。
 * elapsed_seconds / started_at 清零，可重新开始下一轮。
 */
export function stopTimer(
  db: ClarityDB,
  taskId: string,
  opts: { note?: string } = {},
): TimeEntry | null {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');
  const project = getProject(db, task.project_id);
  if (project?.status === 'archived') throw new Error('已归档项目不能记录耗时');

  const elapsed = taskElapsedSeconds(task);
  const hadFocus = Boolean(task.started_at) || task.elapsed_seconds > 0;
  const at = nowIso();
  const minutes = hadFocus ? Math.max(1, Math.ceil(elapsed / 60)) : 0;
  task.started_at = null;
  task.elapsed_seconds = 0;
  task.updated_at = at;
  touchProject(db, task.project_id, at);
  if (minutes <= 0) return null;
  const entry: TimeEntry = {
    id: uuid(),
    task_id: taskId,
    minutes,
    logged_date: todayStr(),
    note: opts.note ?? '倒计时专注',
    created_at: at,
    updated_at: at,
  };
  db.timeEntries.push(entry);
  return entry;
}

/**
 * 倒计时归零时的到点处理：响铃由 UI 触发；这里只负责落账 + 归零，
 * 与 stopTimer 等价但语义上"用完了目标时长"。
 */
export function finishTimer(db: ClarityDB, taskId: string): TimeEntry | null {
  const entry = stopTimer(db, taskId, { note: '倒计时完成' });
  const task = getTaskEntity(db, taskId);
  if (!task || task.status === 'completed') return entry;
  const at = nowIso();
  task.status = 'completed';
  task.completed_at = at;
  task.updated_at = at;
  task.position = nextTaskPosition(db, task.project_id, 'completed');
  touchProject(db, task.project_id, at);
  return entry;
}

/** 修改目标时长（分钟）。不影响正在跑的计时，改的是 goal 分钟。 */
export function setTargetMinutes(db: ClarityDB, taskId: string, minutes: number): void {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) {
    throw new Error('目标时长需为 1–600 的整数分钟');
  }
  const m = Math.floor(minutes);
  task.target_minutes = m;
  task.updated_at = nowIso();
  touchProject(db, task.project_id, task.updated_at);
}

// ---------------------------------------------------------------------------
// Task focus state transitions
// ---------------------------------------------------------------------------

/**
 * 开始任务专注：检查阻塞/依赖条件，记录绕过，启动计时，状态切为 in_progress。
 * 这是所有 UI 开始专注的统一入口。options.bypass=true 时跳过阻塞检查。
 */
export function startTaskFocus(
  db: ClarityDB,
  taskId: string,
  options: { bypass?: boolean; reason?: string } = {},
): void {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');
  if (task.status === 'completed') throw new Error('已完成的任务不能开始专注');
  const project = getProject(db, task.project_id);
  if (project?.status === 'archived') throw new Error('已归档项目不能开始专注');

  const blockers = getTaskBlockers(db, taskId);
  if (!blockers.ready) {
    if (!options.bypass) {
      if (blockers.externalReason) {
        throw new Error('任务当前被阻塞');
      }
      if (blockers.unfinishedDependencyIds.length > 0) {
        throw new Error('依赖未完成');
      }
      throw new Error('任务当前不能开始');
    }
    // Record bypass
    const bypassReason = options.reason?.trim() || '跳过限制';
    recordDependencyBypass(db, taskId, blockers.unfinishedDependencyIds, bypassReason);
  }

  // Use the existing startTimer logic
  startTimer(db, taskId);
}

/**
 * 结束任务专注：保存专注时间，任务标记为完成。
 * 这是所有 UI 提前结束/倒计时完成的统一入口。
 * 零专注时间时仍清除运行状态但不创建耗时记录。
 */
export function finishTaskFocus(
  db: ClarityDB,
  taskId: string,
  note?: string,
): TimeEntry | null {
  const task = getTaskEntity(db, taskId);
  if (!task) throw new Error('任务不存在');

  const hadFocus = Boolean(task.started_at) || task.elapsed_seconds > 0;
  const entry = stopTimer(db, taskId, { note: note ?? '提前结束' });

  const at = nowIso();
  task.status = 'completed';
  task.completed_at = at;
  task.updated_at = at;
  task.position = nextTaskPosition(db, task.project_id, 'completed');
  touchProject(db, task.project_id, at);

  if (!hadFocus) return null;
  return entry;
}

// ---------------------------------------------------------------------------
// Project-level countdown timer (一个项目整计时，与任务级同构)
// ---------------------------------------------------------------------------

/**
 * 项目级整计时已专注秒数（实时）。运行中 = acc + (now - started)；暂停 = acc。
 */
export function projectElapsedSeconds(project: Project, now: number = Date.now()): number {
  const acc = project.elapsed_seconds || 0;
  if (!project.started_at) return acc;
  const started = Date.parse(project.started_at);
  if (!Number.isFinite(started)) return acc;
  return acc + Math.max(0, Math.floor((now - started) / 1000));
}

/** 项目整计时剩余秒（>=0）。 */
export function projectRemainingSeconds(project: Project, now: number = Date.now()): number {
  const elapsed = projectElapsedSeconds(project, now);
  const total = Math.max(0, project.target_minutes || 0) * 60;
  return Math.max(0, total - elapsed);
}

export function startProjectTimer(db: ClarityDB, projectId: string): void {
  const project = getProject(db, projectId);
  if (!project) throw new Error('项目不存在');
  if (project.started_at) return;
  project.started_at = nowIso();
  project.updated_at = project.started_at;
}

export function pauseProjectTimer(db: ClarityDB, projectId: string): void {
  const project = getProject(db, projectId);
  if (!project) throw new Error('项目不存在');
  if (!project.started_at) return;
  const started = Date.parse(project.started_at);
  const at = nowIso();
  if (Number.isFinite(started)) {
    project.elapsed_seconds += Math.max(0, Math.floor((Date.now() - started) / 1000));
  }
  project.started_at = null;
  project.updated_at = at;
}

/**
 * 停止项目整计时：把专注时长落账，计时归零，可开始下一轮。
 */
export function stopProjectTimer(
  db: ClarityDB,
  projectId: string,
  opts: { note?: string } = {},
): ProjectTimeEntry | null {
  const project = getProject(db, projectId);
  if (!project) throw new Error('项目不存在');

  const elapsed = projectElapsedSeconds(project);
  const minutes = Math.round(elapsed / 60);
  const at = nowIso();
  project.started_at = null;
  project.elapsed_seconds = 0;
  project.updated_at = at;
  if (minutes <= 0) return null;
  const entry: ProjectTimeEntry = {
    id: uuid(),
    project_id: projectId,
    minutes,
    logged_date: todayStr(),
    note: opts.note ?? '项目专注',
    created_at: at,
    updated_at: at,
  };
  db.projectTimeEntries.push(entry);
  return entry;
}

export function finishProjectTimer(db: ClarityDB, projectId: string): ProjectTimeEntry | null {
  return stopProjectTimer(db, projectId, { note: '项目倒计时完成' });
}

export function setProjectTargetMinutes(
  db: ClarityDB,
  projectId: string,
  minutes: number,
): void {
  const project = getProject(db, projectId);
  if (!project) throw new Error('项目不存在');
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) {
    throw new Error('目标时长需为 1–600 的整数分钟');
  }
  project.target_minutes = Math.floor(minutes);
  project.updated_at = nowIso();
}


// ---------------------------------------------------------------------------
// Project-level time entries (recorded on the project, not on a task)
// ---------------------------------------------------------------------------

export function listProjectTimeEntries(
  db: ClarityDB,
  projectId: string,
): ProjectTimeEntry[] {
  return db.projectTimeEntries
    .filter((entry) => entry.project_id === projectId)
    .sort((a, b) => b.logged_date.localeCompare(a.logged_date) || b.created_at.localeCompare(a.created_at));
}

export function createProjectTimeEntry(
  db: ClarityDB,
  projectId: string,
  input: ProjectTimeEntryInput,
): ProjectTimeEntry {
  const project = getProject(db, projectId);
  if (!project) throw new Error('项目不存在');
  if (project.status === 'archived') throw new Error('已归档项目不能记录耗时');

  const id = uuid();
  const at = nowIso();
  const entry: ProjectTimeEntry = {
    id,
    project_id: projectId,
    minutes: input.minutes,
    logged_date: input.logged_date,
    note: input.note,
    created_at: at,
    updated_at: at,
  };
  db.projectTimeEntries.push(entry);
  touchProject(db, projectId, at);
  return entry;
}

export function updateProjectTimeEntry(
  db: ClarityDB,
  id: string,
  input: ProjectTimeEntryInput,
): ProjectTimeEntry {
  const entry = db.projectTimeEntries.find((item) => item.id === id);
  if (!entry) throw new Error('耗时记录不存在');
  const project = getProject(db, entry.project_id);
  if (!project) throw new Error('项目不存在');
  if (project.status === 'archived') throw new Error('已归档项目不能修改耗时');

  const at = nowIso();
  entry.minutes = input.minutes;
  entry.logged_date = input.logged_date;
  entry.note = input.note;
  entry.updated_at = at;
  touchProject(db, entry.project_id, at);
  return entry;
}

export function deleteProjectTimeEntry(db: ClarityDB, id: string) {
  const entry = db.projectTimeEntries.find((item) => item.id === id);
  if (!entry) throw new Error('耗时记录不存在');
  const project = getProject(db, entry.project_id);
  if (!project) throw new Error('项目不存在');
  if (project.status === 'archived') throw new Error('已归档项目不能删除耗时');
  const at = nowIso();
  db.projectTimeEntries = db.projectTimeEntries.filter((item) => item.id !== id);
  touchProject(db, entry.project_id, at);
}

// ---------------------------------------------------------------------------
// Derived reads for the Today desk + stats
// ---------------------------------------------------------------------------

export function countActionBadge(db: ClarityDB, today: string): number {
  const archivedProjects = new Set(
    db.projects.filter((project) => project.status === 'archived').map((project) => project.id),
  );
  return db.tasks.filter(
    (task) =>
      !archivedProjects.has(task.project_id) &&
      task.status !== 'completed' &&
      task.due_date != null &&
      task.due_date <= today,
  ).length;
}

export function weekMinutes(db: ClarityDB, start: string, end: string): number {
  return db.timeEntries
    .filter((entry) => entry.logged_date >= start && entry.logged_date <= end)
    .reduce((sum, entry) => sum + entry.minutes, 0);
}

export function listTodayGroups(db: ClarityDB, today: string, horizon = 3): TodayGroups {
  const open = listTasks(db).filter(
    (task) => task.status !== 'completed' && task.project_status !== 'archived',
  );
  const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  const sortOpen = (a: TaskWithMeta, b: TaskWithMeta) => {
    if (priorityRank[a.priority] !== priorityRank[b.priority]) {
      return priorityRank[a.priority] - priorityRank[b.priority];
    }
    if (Boolean(a.due_date) !== Boolean(b.due_date)) return a.due_date ? -1 : 1;
    if (a.due_date && b.due_date && a.due_date !== b.due_date) {
      return a.due_date.localeCompare(b.due_date);
    }
    return a.updated_at.localeCompare(b.updated_at);
  };

  const used = new Set<string>();
  const pick = (predicate: (task: TaskWithMeta) => boolean) => {
    const items = open.filter((task) => !used.has(task.id) && predicate(task)).sort(sortOpen);
    for (const item of items) used.add(item.id);
    return items;
  };

  const horizonEnd = (() => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() + horizon);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();

  return {
    overdue: pick((task) => Boolean(task.due_date && task.due_date < today)),
    dueToday: pick((task) => task.due_date === today),
    highSoon: pick(
      (task) =>
        task.priority === 'high' &&
        Boolean(task.due_date && task.due_date > today && task.due_date <= horizonEnd),
    ),
    inProgress: pick((task) => task.status === 'in_progress'),
  };
}

export function getWeekStats(db: ClarityDB, today: string): WeekStats {
  const start = (() => {
    const date = new Date(`${today}T12:00:00`);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();

  const archivedProjects = new Set(
    db.projects.filter((project) => project.status === 'archived').map((project) => project.id),
  );
  const completed = db.tasks.filter(
    (task) =>
      task.status === 'completed' &&
      task.completed_at != null &&
      localDateString(new Date(task.completed_at)) >= start &&
      localDateString(new Date(task.completed_at)) <= today,
  ).length;
  const stillOpen = db.tasks.filter(
    (task) => !archivedProjects.has(task.project_id) && task.status !== 'completed',
  ).length;
  const denom = completed + stillOpen;
  return {
    completedThisWeek: completed,
    createdOrOpenThisWeek: denom,
    completionRate: denom === 0 ? 0 : completed / denom,
    minutesThisWeek: weekMinutes(db, start, today),
    activeProjects: listProjects(db, 'active').length,
  };
}

export function listTasksByDueRange(
  db: ClarityDB,
  start: string,
  end: string,
): TaskWithMeta[] {
  return listTasks(db).filter((task) => {
    if (!task.due_date) return false;
    return task.due_date >= start && task.due_date <= end;
  });
}

export function getReviewStats(
  db: ClarityDB,
  range: { start: string; end: string },
): ReviewStats {
  const { start, end } =
    range.start <= range.end
      ? range
      : { start: range.end, end: range.start };

  // --- daily arrays ---
  const days: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  while (d <= endDate) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${day}`);
    d.setDate(d.getDate() + 1);
  }

  // --- task time entries ---
  const taskEntries = db.timeEntries.filter(
    (entry) => entry.logged_date >= start && entry.logged_date <= end,
  );
  const taskMinutesByDate = new Map<string, number>();
  let taskMinutes = 0;
  for (const entry of taskEntries) {
    taskMinutes += entry.minutes;
    taskMinutesByDate.set(
      entry.logged_date,
      (taskMinutesByDate.get(entry.logged_date) ?? 0) + entry.minutes,
    );
  }

  // --- project time entries ---
  const projectEntries = db.projectTimeEntries.filter(
    (entry) => entry.logged_date >= start && entry.logged_date <= end,
  );
  const projectMinutesByDate = new Map<string, number>();
  let projectMinutes = 0;
  for (const entry of projectEntries) {
    projectMinutes += entry.minutes;
    projectMinutesByDate.set(
      entry.logged_date,
      (projectMinutesByDate.get(entry.logged_date) ?? 0) + entry.minutes,
    );
  }

  // --- daily points (zero-filled) ---
  const daily: DailyReviewPoint[] = days.map((date) => ({
    date,
    taskMinutes: taskMinutesByDate.get(date) ?? 0,
    projectMinutes: projectMinutesByDate.get(date) ?? 0,
    totalMinutes: (taskMinutesByDate.get(date) ?? 0) + (projectMinutesByDate.get(date) ?? 0),
  }));

  // --- completed tasks in range ---
  const allTasks = listTasks(db);
  const completedInRange = allTasks.filter(
    (task) =>
      task.status === 'completed' &&
      task.completed_at != null &&
      localDateString(new Date(task.completed_at)) >= start &&
      localDateString(new Date(task.completed_at)) <= end,
  );

  const completedCount = completedInRange.length;

  // --- estimate variance ---
  let estimateMinutes = 0;
  let actualTaskMinutes = 0;
  for (const task of completedInRange) {
    estimateMinutes += task.estimate_minutes;
    // sum actual task minutes from time entries
    const actual = db.timeEntries
      .filter((entry) => entry.task_id === task.id)
      .reduce((sum, entry) => sum + entry.minutes, 0);
    actualTaskMinutes += actual;
  }
  const estimateVarianceMinutes = estimateMinutes - actualTaskMinutes;

  // --- completion cycle ---
  let totalCycleMinutes = 0;
  for (const task of completedInRange) {
    const created = new Date(task.created_at).getTime();
    const completed = new Date(task.completed_at!).getTime();
    totalCycleMinutes += Math.round((completed - created) / 60000);
  }
  const averageCompletionCycleMinutes = completedCount > 0
    ? Math.round(totalCycleMinutes / completedCount)
    : 0;

  // --- overdue ---
  const overdueTasks = allTasks.filter((task) => {
    if (!task.due_date) return false;
    if (task.status === 'completed' && task.completed_at) {
      const completedDate = localDateString(new Date(task.completed_at));
      return completedDate >= start && completedDate <= end && task.due_date < completedDate;
    }
    return task.status !== 'completed' &&
      task.project_status !== 'archived' &&
      task.due_date >= start &&
      task.due_date <= end;
  });

  // --- blocked ---
  const isWithinRange = (value: string | null): boolean => {
    if (value == null) return false;
    const date = localDateString(new Date(value));
    return date >= start && date <= end;
  };
  const blockedTasks = allTasks.filter((task) => {
    if (task.project_status === 'archived') return false;
    const hasExternalBlock = isWithinRange(task.blocked_at);
    if (hasExternalBlock) return true;

    const dependencies = db.taskDependencies.filter((dependency) => dependency.task_id === task.id);
    if (!dependencies.some((dependency) => isWithinRange(dependency.created_at))) return false;

    const unfinishedDependencies = dependencies.filter((dependency) => {
      const dependsOn = db.tasks.find((candidate) => candidate.id === dependency.depends_on_task_id);
      return dependsOn != null && dependsOn.status !== 'completed';
    });

    return task.dependency_mode === 'all'
      ? unfinishedDependencies.length > 0
      : unfinishedDependencies.length === dependencies.length;
  });

  // --- bypasses ---
  const bypasses = db.dependencyBypasses.filter((bypass) => isWithinRange(bypass.created_at));

  // --- project rows ---
  const projectRows = db.projects.map((project) => {
    const pTaskMinutes = db.timeEntries
      .filter((entry) => {
        const task = db.tasks.find((t) => t.id === entry.task_id);
        return task?.project_id === project.id && entry.logged_date >= start && entry.logged_date <= end;
      })
      .reduce((sum, entry) => sum + entry.minutes, 0);
    const pProjectMinutes = db.projectTimeEntries
      .filter((entry) => entry.project_id === project.id && entry.logged_date >= start && entry.logged_date <= end)
      .reduce((sum, entry) => sum + entry.minutes, 0);
    return {
      projectId: project.id,
      projectName: project.name,
      color: project.color,
      taskMinutes: pTaskMinutes,
      projectMinutes: pProjectMinutes,
      totalMinutes: pTaskMinutes + pProjectMinutes,
    };
  }).filter((row) => row.totalMinutes > 0);

  return {
    range: { start, end },
    taskMinutes,
    projectMinutes,
    totalMinutes: taskMinutes + projectMinutes,
    completedCount,
    overdueCount: overdueTasks.length,
    blockedCount: blockedTasks.length,
    estimateMinutes,
    actualTaskMinutes,
    estimateVarianceMinutes,
    averageCompletionCycleMinutes,
    daily,
    projects: projectRows,
    overdueTasks,
    blockedTasks,
    bypasses,
  };
}

// ---------------------------------------------------------------------------
// Backup export / import (acts on the in-memory DB, not localStorage)
// ---------------------------------------------------------------------------

export function exportBackup(db: ClarityDB): BackupPayload {
  const byCreated = <T extends { created_at: string }>(items: T[]) =>
    items.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    version: 1,
    exported_at: nowIso(),
    projects: byCreated(db.projects),
    tasks: byCreated(db.tasks),
    subtasks: byCreated(db.subtasks),
    timeEntries: byCreated(db.timeEntries),
    projectTimeEntries: byCreated(db.projectTimeEntries),
    taskDependencies: byCreated(db.taskDependencies),
    dependencyBypasses: byCreated(db.dependencyBypasses),
  };
}

export function importBackup(
  db: ClarityDB,
  payload: BackupPayload,
): {
  projects: number;
  tasks: number;
  subtasks: number;
  timeEntries: number;
  projectTimeEntries: number;
  taskDependencies: number;
  dependencyBypasses: number;
} {
  if (!payload || payload.version !== 1) throw new Error('备份格式不支持');
  if (!Array.isArray(payload.projects) || !Array.isArray(payload.tasks)) {
    throw new Error('备份缺少项目或任务数据');
  }

  for (const project of payload.projects) {
    const existing = db.projects.find((item) => item.id === project.id);
    const record: Project = {
      id: project.id,
      name: project.name,
      description: project.description ?? '',
      color: project.color,
      target_date: project.target_date,
      start_date: project.start_date ?? null,
      status: project.status,
      created_at: project.created_at,
      updated_at: project.updated_at,
      completed_at: project.completed_at,
      target_minutes:
        typeof project.target_minutes === 'number' && Number.isFinite(project.target_minutes)
          ? project.target_minutes
          : 25,
      started_at: project.started_at ?? null,
      elapsed_seconds:
        typeof project.elapsed_seconds === 'number' && Number.isFinite(project.elapsed_seconds)
          ? project.elapsed_seconds
          : 0,
    };
    if (existing) Object.assign(existing, record);
    else db.projects.push(record);
  }

  for (const task of payload.tasks ?? []) {
    const existing = db.tasks.find((item) => item.id === task.id);
    const record: Task = {
      id: task.id,
      project_id: task.project_id,
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      start_date: task.start_date ?? null,
      position: task.position ?? 0,
      target_minutes:
        typeof task.target_minutes === 'number' && Number.isFinite(task.target_minutes)
          ? task.target_minutes
          : 25,
      started_at: task.started_at ?? null,
      elapsed_seconds:
        typeof task.elapsed_seconds === 'number' && Number.isFinite(task.elapsed_seconds)
          ? task.elapsed_seconds
          : 0,
      created_at: task.created_at,
      updated_at: task.updated_at,
      completed_at: task.completed_at,
      estimate_minutes:
        typeof task.estimate_minutes === 'number' && Number.isFinite(task.estimate_minutes)
          ? task.estimate_minutes
          : 25,
      dependency_mode: task.dependency_mode === 'any' ? 'any' : 'all',
      is_blocked: task.is_blocked === true,
      blocked_reason: typeof task.blocked_reason === 'string' ? task.blocked_reason : null,
      blocked_at: task.blocked_at ?? null,
    };
    if (existing) Object.assign(existing, record);
    else db.tasks.push(record);
  }

  for (const subtask of payload.subtasks ?? []) {
    const existing = db.subtasks.find((item) => item.id === subtask.id);
    const record: Subtask = {
      id: subtask.id,
      task_id: subtask.task_id,
      title: subtask.title,
      is_done: Boolean(subtask.is_done),
      position: subtask.position ?? 0,
      created_at: subtask.created_at,
      updated_at: subtask.updated_at,
    };
    if (existing) Object.assign(existing, record);
    else db.subtasks.push(record);
  }

  for (const entry of payload.timeEntries ?? []) {
    const existing = db.timeEntries.find((item) => item.id === entry.id);
    const record: TimeEntry = {
      id: entry.id,
      task_id: entry.task_id,
      minutes: entry.minutes,
      logged_date: entry.logged_date,
      note: entry.note ?? '',
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
    if (existing) Object.assign(existing, record);
    else db.timeEntries.push(record);
  }

  for (const entry of payload.projectTimeEntries ?? []) {
    const existing = db.projectTimeEntries.find((item) => item.id === entry.id);
    const record: ProjectTimeEntry = {
      id: entry.id,
      project_id: entry.project_id,
      minutes: entry.minutes,
      logged_date: entry.logged_date,
      note: entry.note ?? '',
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
    if (existing) Object.assign(existing, record);
    else db.projectTimeEntries.push(record);
  }

  for (const dep of payload.taskDependencies ?? []) {
    const existing = db.taskDependencies.find((item) => item.id === dep.id);
    if (existing) Object.assign(existing, dep);
    else db.taskDependencies.push(dep);
  }

  for (const bypass of payload.dependencyBypasses ?? []) {
    const existing = db.dependencyBypasses.find((item) => item.id === bypass.id);
    if (existing) Object.assign(existing, bypass);
    else db.dependencyBypasses.push(bypass);
  }

  return {
    projects: payload.projects.length,
    tasks: (payload.tasks ?? []).length,
    subtasks: (payload.subtasks ?? []).length,
    timeEntries: (payload.timeEntries ?? []).length,
    projectTimeEntries: (payload.projectTimeEntries ?? []).length,
    taskDependencies: (payload.taskDependencies ?? []).length,
    dependencyBypasses: (payload.dependencyBypasses ?? []).length,
  };
}

export { todayStr };
