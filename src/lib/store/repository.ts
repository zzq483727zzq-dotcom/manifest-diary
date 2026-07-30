import type {
  BackupPayload,
  Project,
  ProjectColor,
  ProjectStatus,
  ProjectSummary,
  ProjectTimeEntry,
  Subtask,
  Task,
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
    position,
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
  const nextProject = getProject(db, nextProjectId);
  if (!nextProject) throw new Error('项目不存在');
  if (nextProject.status === 'archived') throw new Error('不能移动到已归档项目');

  if (patch.title != null) existing.title = patch.title;
  if (patch.description != null) existing.description = patch.description;
  const status = patch.status ?? existing.status;
  existing.status = status;
  if (patch.priority != null) existing.priority = patch.priority;
  if (patch.due_date !== undefined) existing.due_date = patch.due_date;

  const at = nowIso();
  existing.updated_at = at;
  existing.completed_at =
    status === 'completed'
      ? existing.status === 'completed' && existing.completed_at
        ? existing.completed_at
        : at
      : null;

  if (status !== existing.status || nextProjectId !== existing.project_id) {
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
      position: task.position ?? 0,
      created_at: task.created_at,
      updated_at: task.updated_at,
      completed_at: task.completed_at,
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

  return {
    projects: payload.projects.length,
    tasks: (payload.tasks ?? []).length,
    subtasks: (payload.subtasks ?? []).length,
    timeEntries: (payload.timeEntries ?? []).length,
    projectTimeEntries: (payload.projectTimeEntries ?? []).length,
  };
}

export { todayStr };
