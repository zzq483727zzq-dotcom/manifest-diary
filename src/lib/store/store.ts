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
      taskDependencies: Array.isArray(parsed.taskDependencies) ? parsed.taskDependencies : [],
      dependencyBypasses: Array.isArray(parsed.dependencyBypasses) ? parsed.dependencyBypasses : [],
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

function normalizeTasks(tasks: Task[]): Task[] {
  return tasks.map((t) => ({
    ...t,
    start_date: t.start_date ?? null,
    target_minutes:
      typeof t.target_minutes === 'number' && Number.isFinite(t.target_minutes)
        ? t.target_minutes
        : 25,
    estimate_minutes: validInteger(t.estimate_minutes, 25, 1, 600),
    dependency_mode: t.dependency_mode === 'any' ? 'any' : 'all',
    is_blocked: t.is_blocked === true,
    blocked_reason: typeof t.blocked_reason === 'string' ? t.blocked_reason : null,
    blocked_at: t.blocked_at ?? null,
    started_at: t.started_at ?? null,
    elapsed_seconds:
      typeof t.elapsed_seconds === 'number' && Number.isFinite(t.elapsed_seconds)
        ? t.elapsed_seconds
        : 0,
  }));
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
