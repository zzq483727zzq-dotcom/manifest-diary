import type {
  BackupPayload,
  Project,
  ProjectColor,
  ProjectStatus,
  ProjectSummary,
  ProjectTimeEntry,
  Subtask,
  Task,
  TaskDependency,
  DependencyBypass,
  TaskPriority,
  TaskStatus,
  TaskWithMeta,
  TimeEntry,
  TodayGroups,
  WeekStats,
} from '@/types/project';
export type { BackupPayload, TodayGroups, WeekStats };
import type {
  ProjectInput,
  ProjectTimeEntryInput,
  SubtaskInput,
  TaskInput,
  TimeEntryInput,
} from '@/lib/project/validation';
import {
  type ClarityDB,
  cloneDB,
  normalizeDependencyBypasses,
  normalizeTask,
  normalizeTaskDependencies,
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

export interface TaskBlockers {
  ready: boolean;
  dependencyIds: string[];
  unfinishedDependencyIds: string[];
  externalReason: string | null;
  labels: string[];
}

function getTaskForDependency(db: ClarityDB, id: string): Task {
  const task = getTaskEntity(db, id);
  if (!task) throw new Error('任务不存在');
  return task;
}

function assertDependencyEditable(db: ClarityDB, task: Task) {
  const project = getProject(db, task.project_id);
  if (project?.status === 'archived') throw new Error('已归档项目不能编辑依赖');
}

function validateReason(reason: string, message: string): string {
  if (typeof reason !== 'string') throw new Error(message);
  const trimmed = reason.trim();
  if (trimmed.length < 1 || trimmed.length > 200) throw new Error(message);
  return trimmed;
}

// Dependency edges point from the blocked task to its prerequisites. A path
// from the proposed prerequisite back to the blocked task would create a cycle.
function reachesTask(db: ClarityDB, startTaskId: string, targetTaskId: string): boolean {
  return reachesTaskInEdges(db.taskDependencies, startTaskId, targetTaskId);
}

function reachesTaskInEdges(
  edges: TaskDependency[],
  startTaskId: string,
  targetTaskId: string,
): boolean {
  const visited = new Set<string>();
  const visit = (taskId: string): boolean => {
    if (taskId === targetTaskId) return true;
    if (visited.has(taskId)) return false;
    visited.add(taskId);
    return edges
      .filter((dependency) => dependency.task_id === taskId)
      .some((dependency) => visit(dependency.depends_on_task_id));
  };
  return visit(startTaskId);
}

export function listTaskDependencies(db: ClarityDB, taskId: string): TaskDependency[] {
  getTaskForDependency(db, taskId);
  return db.taskDependencies
    .filter((dependency) => dependency.task_id === taskId)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function addTaskDependency(
  db: ClarityDB,
  taskId: string,
  dependsOnTaskId: string,
): TaskDependency {
  const task = getTaskForDependency(db, taskId);
  const prerequisite = getTaskForDependency(db, dependsOnTaskId);
  assertDependencyEditable(db, task);
  if (task.project_id !== prerequisite.project_id) throw new Error('只能依赖同一项目');
  if (taskId === dependsOnTaskId) throw new Error('不能依赖自己');
  if (db.taskDependencies.some(
    (dependency) => dependency.task_id === taskId && dependency.depends_on_task_id === dependsOnTaskId,
  )) {
    throw new Error('依赖已经存在');
  }
  if (reachesTask(db, dependsOnTaskId, taskId)) throw new Error('不能形成循环依赖');

  const at = nowIso();
  const dependency: TaskDependency = {
    id: uuid(),
    task_id: taskId,
    depends_on_task_id: dependsOnTaskId,
    created_at: at,
  };
  db.taskDependencies.push(dependency);
  task.updated_at = at;
  touchProject(db, task.project_id, at);
  return dependency;
}

export function removeTaskDependency(db: ClarityDB, dependencyId: string): void {
  const dependency = db.taskDependencies.find((item) => item.id === dependencyId);
  if (!dependency) throw new Error('依赖不存在');
  const task = getTaskForDependency(db, dependency.task_id);
  assertDependencyEditable(db, task);
  const at = nowIso();
  db.taskDependencies = db.taskDependencies.filter((item) => item.id !== dependencyId);
  task.updated_at = at;
  touchProject(db, task.project_id, at);
}

export function getTaskBlockers(db: ClarityDB, taskId: string): TaskBlockers {
  const task = getTaskForDependency(db, taskId);
  const dependencies = listTaskDependencies(db, taskId);
  const unfinishedDependencyIds = dependencies
    .map((dependency) => dependency.depends_on_task_id)
    .filter((dependencyTaskId) => {
      const dependencyTask = db.tasks.find((item) => item.id === dependencyTaskId);
      return dependencyTask?.status !== 'completed';
    });
  const externalReason = task.is_blocked ? task.blocked_reason : null;
  const dependencyBlocked = task.dependency_mode === 'any'
    ? dependencies.length > 0 && unfinishedDependencyIds.length === dependencies.length
    : unfinishedDependencyIds.length > 0;
  const labels: string[] = [];
  if (dependencyBlocked) {
    labels.push(`等待前置任务（${unfinishedDependencyIds.length}/${dependencies.length}）`);
  }
  if (externalReason) labels.push(`外部阻塞：${externalReason}`);
  return {
    ready: !dependencyBlocked && externalReason === null,
    dependencyIds: dependencies.map((dependency) => dependency.id),
    unfinishedDependencyIds,
    externalReason,
    labels,
  };
}

export function canTaskStart(db: ClarityDB, taskId: string): TaskBlockers {
  return getTaskBlockers(db, taskId);
}

export function setTaskBlocked(db: ClarityDB, taskId: string, reason: string): void {
  const task = getTaskForDependency(db, taskId);
  assertDependencyEditable(db, task);
  const normalizedReason = validateReason(reason, '阻塞原因不能为空');
  const at = nowIso();
  task.is_blocked = true;
  task.blocked_reason = normalizedReason;
  task.blocked_at = at;
  task.updated_at = at;
  touchProject(db, task.project_id, at);
}

export function clearTaskBlocked(db: ClarityDB, taskId: string): void {
  const task = getTaskForDependency(db, taskId);
  assertDependencyEditable(db, task);
  const at = nowIso();
  task.is_blocked = false;
  task.blocked_reason = null;
  task.blocked_at = null;
  task.updated_at = at;
  touchProject(db, task.project_id, at);
}

export function listDependencyBypasses(db: ClarityDB, taskId: string): DependencyBypass[] {
  getTaskForDependency(db, taskId);
  return db.dependencyBypasses
    .filter((bypass) => bypass.task_id === taskId)
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}

export function recordDependencyBypass(
  db: ClarityDB,
  taskId: string,
  dependencyIds: string[],
  reason: string,
): DependencyBypass {
  const task = getTaskForDependency(db, taskId);
  assertDependencyEditable(db, task);
  const normalizedReason = validateReason(reason, '绕过原因不能为空');
  if (!Array.isArray(dependencyIds)) throw new Error('依赖记录格式不正确');
  const uniqueIds = [...new Set(dependencyIds)];
  if (uniqueIds.some((dependencyId) => typeof dependencyId !== 'string' || !dependencyId.trim())) {
    throw new Error('依赖记录格式不正确');
  }
  if (uniqueIds.some((dependencyId) => {
    const dependency = db.taskDependencies.find((item) => item.id === dependencyId);
    if (!dependency || dependency.task_id !== taskId) return true;
    const prerequisite = db.tasks.find((item) => item.id === dependency.depends_on_task_id);
    return prerequisite?.status === 'completed';
  })) {
    const hasUnknownDependency = uniqueIds.some((dependencyId) => {
      const dependency = db.taskDependencies.find((item) => item.id === dependencyId);
      return !dependency || dependency.task_id !== taskId;
    });
    throw new Error(hasUnknownDependency ? '依赖记录不属于当前任务' : '只能绕过未完成依赖');
  }

  const at = nowIso();
  const bypass: DependencyBypass = {
    id: uuid(),
    task_id: taskId,
    dependency_ids: uniqueIds,
    reason: normalizedReason,
    created_at: at,
  };
  db.dependencyBypasses.push(bypass);
  task.updated_at = at;
  touchProject(db, task.project_id, at);
  return bypass;
}

function validateExecutionFields(input: Partial<TaskInput>, current?: Task) {
  if (input.estimate_minutes !== undefined &&
    (!Number.isInteger(input.estimate_minutes) || input.estimate_minutes < 1 || input.estimate_minutes > 600)) {
    throw new Error('预计时长需为 1–600 的整数分钟');
  }
  if (input.dependency_mode !== undefined && input.dependency_mode !== 'all' && input.dependency_mode !== 'any') {
    throw new Error('依赖模式不支持');
  }
  if (input.is_blocked !== undefined && typeof input.is_blocked !== 'boolean') {
    throw new Error('阻塞状态格式不正确');
  }
  if (input.blocked_at !== undefined && input.blocked_at !== null &&
    (typeof input.blocked_at !== 'string' || !Number.isFinite(Date.parse(input.blocked_at)))) {
    throw new Error('阻塞时间格式不正确');
  }
  const nextBlocked = input.is_blocked ?? current?.is_blocked ?? false;
  const nextReason = input.blocked_reason !== undefined
    ? input.blocked_reason
    : current?.blocked_reason ?? null;
  if (input.blocked_reason !== undefined && nextReason !== null) {
    if (typeof nextReason !== 'string' || nextReason.trim().length < 1 || nextReason.trim().length > 200) {
      throw new Error('阻塞原因不能为空');
    }
  }
  if (nextBlocked && (!nextReason || nextReason.trim().length === 0)) {
    throw new Error('阻塞原因不能为空');
  }
}

function normalizeExecutionInput(input: Partial<TaskInput>, current?: Task) {
  validateExecutionFields(input, current);
  const is_blocked = input.is_blocked ?? current?.is_blocked ?? false;
  const blocked_reason = is_blocked
    ? (input.blocked_reason ?? current?.blocked_reason ?? null)!.trim()
    : null;
  const blocked_at = is_blocked
    ? input.blocked_at ?? current?.blocked_at ?? nowIso()
    : null;
  return {
    ...(input.estimate_minutes === undefined ? {} : { estimate_minutes: input.estimate_minutes }),
    ...(input.dependency_mode === undefined ? {} : { dependency_mode: input.dependency_mode }),
    ...(input.is_blocked === undefined ? { is_blocked } : { is_blocked }),
    ...(input.blocked_reason === undefined ? { blocked_reason } : { blocked_reason }),
    ...(input.blocked_at === undefined ? { blocked_at } : { blocked_at }),
  };
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
  db.taskDependencies = db.taskDependencies.filter(
    (dependency) => !taskIds.includes(dependency.task_id) && !taskIds.includes(dependency.depends_on_task_id),
  );
  db.dependencyBypasses = db.dependencyBypasses.filter(
    (bypass) => !taskIds.includes(bypass.task_id) &&
      bypass.dependency_ids.every((dependencyId) => db.taskDependencies.some((dependency) => dependency.id === dependencyId)),
  );
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
  const execution = normalizeExecutionInput(input);

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
    estimate_minutes: execution.estimate_minutes ?? 25,
    dependency_mode: execution.dependency_mode ?? 'all',
    is_blocked: execution.is_blocked ?? false,
    blocked_reason: execution.blocked_reason ?? null,
    blocked_at: execution.blocked_at ?? null,
    started_at: null,
    elapsed_seconds: 0,
    created_at: at,
    updated_at: at,
    completed_at: input.status === 'completed' ? at : null,
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
  const previousProjectId = existing.project_id;
  const nextProject = getProject(db, nextProjectId);
  if (!nextProject) throw new Error('项目不存在');
  if (nextProject.status === 'archived') throw new Error('不能移动到已归档项目');

  if (nextProjectId !== existing.project_id) {
    const breaksDependencyInvariant = db.taskDependencies.some((dependency) => {
      const taskProjectId = dependency.task_id === id
        ? nextProjectId
        : getTaskEntity(db, dependency.task_id)?.project_id;
      const prerequisiteProjectId = dependency.depends_on_task_id === id
        ? nextProjectId
        : getTaskEntity(db, dependency.depends_on_task_id)?.project_id;
      return taskProjectId !== prerequisiteProjectId;
    });
    if (breaksDependencyInvariant) throw new Error('移动任务会破坏同项目依赖');
  }

  if (patch.status === 'in_progress' && existing.status !== 'in_progress') {
    startTaskFocus(db, id);
    return getTask(db, id)!;
  }
  if (patch.status === 'todo' && existing.status === 'in_progress' && (existing.started_at || existing.elapsed_seconds > 0)) {
    stopTimer(db, id, { note: '任务暂停' });
  }
  const execution = normalizeExecutionInput(patch, existing);
  const at = nowIso();
  const nextTitle = patch.title != null ? patch.title : existing.title;
  const nextDescription = patch.description != null ? patch.description : existing.description;
  const nextPriority = patch.priority != null ? patch.priority : existing.priority;
  const nextDueDate = patch.due_date !== undefined ? patch.due_date : existing.due_date;
  const nextStartDate = patch.start_date !== undefined ? patch.start_date : existing.start_date;
  const nextStatus = patch.status ?? existing.status;
  const nextTask = normalizeTask({
    ...existing,
    title: nextTitle,
    description: nextDescription,
    priority: nextPriority,
    due_date: nextDueDate,
    start_date: nextStartDate,
    status: nextStatus,
    ...execution,
  });
  if (nextTask.is_blocked && (!nextTask.blocked_reason || !nextTask.blocked_at)) {
    throw new Error('阻塞原因不能为空');
  }
  // 旧状态先记下，用于：completed 保留 completed_at、以及"切到完成时自动停计时"。
  const prevStatus = existing.status;
  const status = nextTask.status;
  existing.title = nextTask.title;
  existing.description = nextTask.description;
  existing.priority = nextTask.priority;
  existing.due_date = nextTask.due_date;
  existing.start_date = nextTask.start_date;
  existing.estimate_minutes = nextTask.estimate_minutes;
  existing.dependency_mode = nextTask.dependency_mode;
  existing.is_blocked = nextTask.is_blocked;
  existing.blocked_reason = nextTask.blocked_reason;
  existing.blocked_at = nextTask.blocked_at;
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

  touchProject(db, nextProjectId, at);
  if (previousProjectId !== nextProjectId) touchProject(db, previousProjectId, at);
  return getTask(db, id)!;
}

export function deleteTask(db: ClarityDB, id: string) {
  const existing = getTaskEntity(db, id);
  if (!existing) throw new Error('任务不存在');
  const at = nowIso();
  db.timeEntries = db.timeEntries.filter((entry) => entry.task_id !== id);
  db.subtasks = db.subtasks.filter((sub) => sub.task_id !== id);
  db.taskDependencies = db.taskDependencies.filter(
    (dependency) => dependency.task_id !== id && dependency.depends_on_task_id !== id,
  );
  db.dependencyBypasses = db.dependencyBypasses.filter((bypass) =>
    bypass.task_id !== id &&
    bypass.dependency_ids.every((dependencyId) => db.taskDependencies.some((dependency) => dependency.id === dependencyId)),
  );
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

/** Start a task only after dependency/external blocker checks. */
export function startTaskFocus(
  db: ClarityDB,
  taskId: string,
  options: { bypass?: boolean; reason?: string } = {},
): void {
  const task = getTaskForDependency(db, taskId);
  if (task.status === 'completed') return;
  const project = getProject(db, task.project_id);
  if (project?.status === 'archived') throw new Error('已归档项目不能开始专注');
  if (task.started_at) return;
  const blockers = canTaskStart(db, taskId);
  if (!blockers.ready) {
    if (!options.bypass) throw new Error('任务当前被阻塞');
    const reason = validateReason(options.reason ?? '', '绕过原因不能为空');
    recordDependencyBypass(db, taskId, blockers.unfinishedDependencyIds
      .map((dependencyTaskId) => db.taskDependencies.find(
        (dependency) => dependency.task_id === taskId && dependency.depends_on_task_id === dependencyTaskId,
      )?.id)
      .filter((dependencyId): dependencyId is string => dependencyId !== undefined), reason);
  }
  startTimer(db, taskId);
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

export function finishTaskFocus(db: ClarityDB, taskId: string, note = '提前结束'): TimeEntry | null {
  const entry = stopTimer(db, taskId, { note });
  const task = getTaskForDependency(db, taskId);
  if (task.status === 'completed') return entry;
  const at = nowIso();
  task.status = 'completed';
  task.completed_at = at;
  task.updated_at = at;
  task.position = nextTaskPosition(db, task.project_id, 'completed');
  touchProject(db, task.project_id, at);
  return entry;
}

export function finishTimer(db: ClarityDB, taskId: string): TimeEntry | null {
  return finishTaskFocus(db, taskId, '倒计时完成');
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
      task.completed_at.slice(0, 10) >= start &&
      task.completed_at.slice(0, 10) <= today,
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

// ---------------------------------------------------------------------------
// Backup export / import (acts on the in-memory DB, not localStorage)
// ---------------------------------------------------------------------------

function validImportedDependencies(
  db: ClarityDB,
  dependencies: TaskDependency[],
): TaskDependency[] {
  const accepted: TaskDependency[] = [];
  const seenIds = new Set(db.taskDependencies.map((dependency) => dependency.id));
  const taskById = new Map(db.tasks.map((task) => [task.id, task]));
  for (const dependency of dependencies) {
    if (seenIds.has(dependency.id)) continue;
    seenIds.add(dependency.id);
    const task = taskById.get(dependency.task_id);
    const prerequisite = taskById.get(dependency.depends_on_task_id);
    if (!task || !prerequisite || task.id === prerequisite.id || task.project_id !== prerequisite.project_id) continue;
    const duplicate = [...db.taskDependencies, ...accepted].some((existing) =>
      existing.task_id === dependency.task_id &&
      existing.depends_on_task_id === dependency.depends_on_task_id,
    );
    if (duplicate) continue;
    const edges = [...db.taskDependencies, ...accepted];
    if (reachesTaskInEdges(edges, dependency.depends_on_task_id, dependency.task_id)) continue;
    accepted.push(dependency);
  }
  return accepted;
}

function validImportedBypasses(
  db: ClarityDB,
  bypasses: DependencyBypass[],
  acceptedDependencies: TaskDependency[],
): DependencyBypass[] {
  const dependencies = new Map(
    [...db.taskDependencies, ...acceptedDependencies].map((dependency) => [dependency.id, dependency]),
  );
  const acceptedBypasses: DependencyBypass[] = [];
  const seenIds = new Set(db.dependencyBypasses.map((bypass) => bypass.id));
  return bypasses.filter((bypass) => {
    if (seenIds.has(bypass.id)) return false;
    seenIds.add(bypass.id);
    const task = db.tasks.find((item) => item.id === bypass.task_id);
    if (!task) return false;
    const valid = bypass.dependency_ids.every((dependencyId) => {
      const dependency = dependencies.get(dependencyId);
      const prerequisite = dependency && db.tasks.find((item) => item.id === dependency.depends_on_task_id);
      return dependency?.task_id === bypass.task_id && prerequisite?.status !== 'completed';
    });
    if (valid) acceptedBypasses.push(bypass);
    return valid;
  });
}

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

function importBackupIntoDB(
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

  let importedProjects = 0;
  let importedTasks = 0;
  let importedSubtasks = 0;
  let importedTimeEntries = 0;
  let importedProjectTimeEntries = 0;
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
    importedProjects += 1;
  }

  for (const task of payload.tasks ?? []) {
    if (!db.projects.some((project) => project.id === task.project_id)) continue;
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
      estimate_minutes:
        typeof task.estimate_minutes === 'number' && Number.isInteger(task.estimate_minutes) &&
        task.estimate_minutes >= 1 && task.estimate_minutes <= 600
          ? task.estimate_minutes
          : 25,
      dependency_mode: task.dependency_mode === 'any' ? 'any' : 'all',
      is_blocked: task.is_blocked === true,
      blocked_reason: typeof task.blocked_reason === 'string' ? task.blocked_reason : null,
      blocked_at: task.blocked_at ?? null,
      started_at: task.started_at ?? null,
      elapsed_seconds:
        typeof task.elapsed_seconds === 'number' && Number.isFinite(task.elapsed_seconds)
          ? task.elapsed_seconds
          : 0,
      created_at: task.created_at,
      updated_at: task.updated_at,
      completed_at: task.completed_at,
    };
    const normalizedRecord = normalizeTask(record);
    if (existing) Object.assign(existing, normalizedRecord);
    else db.tasks.push(normalizedRecord);
    importedTasks += 1;
  }

  for (const subtask of payload.subtasks ?? []) {
    if (!db.tasks.some((task) => task.id === subtask.task_id)) continue;
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
    importedSubtasks += 1;
  }

  for (const entry of payload.timeEntries ?? []) {
    if (!db.tasks.some((task) => task.id === entry.task_id)) continue;
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
    importedTimeEntries += 1;
  }

  for (const entry of payload.projectTimeEntries ?? []) {
    if (!db.projects.some((project) => project.id === entry.project_id)) continue;
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
    importedProjectTimeEntries += 1;
  }

  const importedDependencies = normalizeTaskDependencies(payload.taskDependencies);
  const importedBypasses = normalizeDependencyBypasses(payload.dependencyBypasses);
  const acceptedDependencies = validImportedDependencies(db, importedDependencies);
  const acceptedBypasses = validImportedBypasses(db, importedBypasses, acceptedDependencies);

  for (const dependency of acceptedDependencies) {
    const existing = db.taskDependencies.find((item) => item.id === dependency.id);
    const record: TaskDependency = {
      id: dependency.id,
      task_id: dependency.task_id,
      depends_on_task_id: dependency.depends_on_task_id,
      created_at: dependency.created_at,
    };
    if (existing) Object.assign(existing, record);
    else db.taskDependencies.push(record);
  }

  for (const bypass of acceptedBypasses) {
    const existing = db.dependencyBypasses.find((item) => item.id === bypass.id);
    const record: DependencyBypass = {
      id: bypass.id,
      task_id: bypass.task_id,
      dependency_ids: bypass.dependency_ids,
      reason: bypass.reason,
      created_at: bypass.created_at,
    };
    if (existing) Object.assign(existing, record);
    else db.dependencyBypasses.push(record);
  }

  return {
    projects: importedProjects,
    tasks: importedTasks,
    subtasks: importedSubtasks,
    timeEntries: importedTimeEntries,
    projectTimeEntries: importedProjectTimeEntries,
    taskDependencies: acceptedDependencies.length,
    dependencyBypasses: acceptedBypasses.length,
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
  const staged = cloneDB(db);
  const counts = importBackupIntoDB(staged, payload);
  Object.assign(db, staged);
  return counts;
}

export { todayStr };
