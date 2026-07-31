import type {
  Project,
  ProjectTimeEntry,
  Subtask,
  Task,
  TaskDependency,
  DependencyBypass,
  TimeEntry,
} from '@/types/project';

/**
 * Client-side persistence envelope for the static export build.
 * Mirrors the server `BackupPayload` shape: the five base entity tables.
 * Derived types (ProjectSummary / TaskWithMeta / TodayGroups / WeekStats)
 * are computed on read, never stored.
 */
export interface ClarityDB {
  version: 1;
  projects: Project[];
  tasks: Task[];
  subtasks: Subtask[];
  timeEntries: TimeEntry[];
  projectTimeEntries: ProjectTimeEntry[];
  taskDependencies: TaskDependency[];
  dependencyBypasses: DependencyBypass[];
}

const STORAGE_KEY = 'clarity-db';

export function emptyDB(): ClarityDB {
  return {
    version: 1,
    projects: [],
    tasks: [],
    subtasks: [],
    timeEntries: [],
    projectTimeEntries: [],
    taskDependencies: [],
    dependencyBypasses: [],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Read the database from localStorage. Safe during SSR / static pre-render:
 * returns an empty DB when `window` is unavailable so the export render
 * does not touch the filesystem. Callers must treat the result as read-only
 * and always go through `saveDB` to persist mutations.
 */
export function loadDB(): ClarityDB {
  if (typeof window === 'undefined') return emptyDB();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDB();
    const parsed = JSON.parse(raw) as Partial<ClarityDB>;
    return {
      version: 1,
      projects: Array.isArray(parsed.projects) ? normalizeProjects(parsed.projects) : [],
      // 老数据 Task 可能缺倒计时要用的字段，统一兜底到默认值，避免渲染/计算崩。
      tasks: Array.isArray(parsed.tasks) ? normalizeTasks(parsed.tasks) : [],
      subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks : [],
      timeEntries: Array.isArray(parsed.timeEntries) ? parsed.timeEntries : [],
      projectTimeEntries: Array.isArray(parsed.projectTimeEntries)
        ? parsed.projectTimeEntries
        : [],
      taskDependencies: normalizeTaskDependencies(parsed.taskDependencies),
      dependencyBypasses: normalizeDependencyBypasses(parsed.dependencyBypasses),
    };
  } catch {
    return emptyDB();
  }
}

export function saveDB(db: ClarityDB): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export function resetDB(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Browser-native UUID; fallback for older environments. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** ISO timestamp in the same shape as the server `nowIso`. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Today as YYYY-MM-DD in the device local timezone. */
export function todayStr(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Deep clone helper for callers that need a private mutable copy. */
export function cloneDB(db: ClarityDB): ClarityDB {
  return clone(db);
}

/**
 * 把从 localStorage 读出的 task 列表里缺倒计时要用的字段补成默认值，
 * 让老数据（没有 target_minutes/started_at/elapsed_seconds/start_date）
 * 也能正常渲染与计时，不会因 undefined 撕裂计算。
 */
function validInteger(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

function normalizeBlockedReason(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const reason = value.trim();
  return reason.length >= 1 && reason.length <= 200 ? reason : null;
}

function normalizeBlockedAt(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

export function normalizeTaskDependencies(value: unknown): TaskDependency[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is TaskDependency => Boolean(item && typeof item === 'object'))
    .map((item) => {
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      const task_id = typeof item.task_id === 'string' ? item.task_id.trim() : '';
      const depends_on_task_id = typeof item.depends_on_task_id === 'string'
        ? item.depends_on_task_id.trim()
        : '';
      const created_at = typeof item.created_at === 'string' ? item.created_at : '';
      if (!id || !task_id || !depends_on_task_id || !Number.isFinite(Date.parse(created_at))) {
        return null;
      }
      return { id, task_id, depends_on_task_id, created_at };
    })
    .filter((item): item is TaskDependency => item !== null);
}

export function normalizeDependencyBypasses(value: unknown): DependencyBypass[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is DependencyBypass => Boolean(item && typeof item === 'object'))
    .map((item) => {
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      const task_id = typeof item.task_id === 'string' ? item.task_id.trim() : '';
      const created_at = typeof item.created_at === 'string' ? item.created_at : '';
      const reason = normalizeBlockedReason(item.reason);
      const dependency_ids = Array.isArray(item.dependency_ids)
        ? item.dependency_ids
            .filter((dependencyId): dependencyId is string => typeof dependencyId === 'string')
            .map((dependencyId) => dependencyId.trim())
            .filter(Boolean)
        : [];
      if (!id || !task_id || !reason || !Number.isFinite(Date.parse(created_at))) return null;
      return { id, task_id, dependency_ids, reason, created_at };
    })
    .filter((item): item is DependencyBypass => item !== null);
}

export function normalizeTask(task: Task): Task {
  const estimate_minutes = validInteger(task.estimate_minutes, 25, 1, 600);
  const dependency_mode = task.dependency_mode === 'any' ? 'any' : 'all';
  const reason = normalizeBlockedReason(task.blocked_reason);
  const blocked_at = normalizeBlockedAt(task.blocked_at);
  const is_blocked = task.is_blocked === true && reason !== null && blocked_at !== null;
  return {
    ...task,
    start_date: task.start_date ?? null,
    target_minutes:
      typeof task.target_minutes === 'number' && Number.isFinite(task.target_minutes)
        ? task.target_minutes
        : 25,
    estimate_minutes,
    dependency_mode,
    is_blocked,
    blocked_reason: is_blocked ? reason : null,
    blocked_at: is_blocked ? blocked_at : null,
    started_at: task.started_at ?? null,
    elapsed_seconds:
      typeof task.elapsed_seconds === 'number' && Number.isFinite(task.elapsed_seconds)
        ? task.elapsed_seconds
        : 0,
  };
}

function normalizeTasks(tasks: Task[]): Task[] {
  return tasks.map(normalizeTask);
}

/** 项目级专注倒计时同样需要兜底三字段（老数据没有）。 */
function normalizeProjects(projects: Project[]): Project[] {
  return projects.map((p) => ({
    ...p,
    target_minutes:
      typeof p.target_minutes === 'number' && Number.isFinite(p.target_minutes)
        ? p.target_minutes
        : 25,
    started_at: p.started_at ?? null,
    elapsed_seconds:
      typeof p.elapsed_seconds === 'number' && Number.isFinite(p.elapsed_seconds)
        ? p.elapsed_seconds
        : 0,
  }));
}
