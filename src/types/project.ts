export type ProjectStatus = 'active' | 'completed' | 'archived';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type DependencyMode = 'all' | 'any';

export const PROJECT_COLORS = [
  '#5EEAD4',
  '#7DD3FC',
  '#C4B5FD',
  '#FBBF24',
  '#FB7185',
  '#86EFAC',
] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number];

export interface Project {
  id: string;
  name: string;
  description: string;
  color: ProjectColor;
  target_date: string | null;
  start_date: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  // 项目级整体专注倒计时。同构于任务的计时三字段：
  // target_minutes = 目标（默认 25），started_at = 运行起算 ISO / null，elapsed_seconds = 暂停时累计秒。
  target_minutes: number;
  started_at: string | null;
  elapsed_seconds: number;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
}

export interface DependencyBypass {
  id: string;
  task_id: string;
  dependency_ids: string[];
  reason: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  start_date: string | null;
  position: number;
  // 倒计时运行态。target_minutes = 目标时长（默认 25，可改）；
  // started_at = 本次运行起算时刻（运行中 ISO 字符串，暂停为 null）；
  // elapsed_seconds = 之前累计已专注秒数（暂停保留，运行中=acc+(now-started_at)）
  target_minutes: number;
  estimate_minutes: number;
  dependency_mode: DependencyMode;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  started_at: string | null;
  elapsed_seconds: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
}

export interface DependencyBypass {
  id: string;
  task_id: string;
  dependency_ids: string[];
  reason: string;
  created_at: string;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  task_id: string;
  minutes: number;
  logged_date: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectTimeEntry {
  id: string;
  project_id: string;
  minutes: number;
  logged_date: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectSummary extends Project {
  task_total: number;
  task_completed: number;
  progress: number;
  minutes_total: number;
  nearest_due_date: string | null;
}

export interface TaskWithMeta extends Task {
  project_name: string;
  project_color: ProjectColor;
  project_status: ProjectStatus;
  minutes_total: number;
  subtask_total: number;
  subtask_done: number;
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  completed: '已完成',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

// --- Derived shapes shared by both the server (SQLite) and client
// (localStorage) repositories. Living here (not in either repository file)
// keeps client components from importing a server-only module just for a
// type.

export interface TodayGroups {
  overdue: TaskWithMeta[];
  dueToday: TaskWithMeta[];
  highSoon: TaskWithMeta[];
  inProgress: TaskWithMeta[];
}

export interface WeekStats {
  completedThisWeek: number;
  createdOrOpenThisWeek: number;
  completionRate: number;
  minutesThisWeek: number;
  activeProjects: number;
}

export interface TaskBlockers {
  ready: boolean;
  dependencyIds: string[];
  unfinishedDependencyIds: string[];
  externalReason: string | null;
  labels: string[];
}

export interface ReviewRange {
  start: string;
  end: string;
}

export interface DailyReviewPoint {
  date: string;
  taskMinutes: number;
  projectMinutes: number;
  totalMinutes: number;
}

export interface ProjectReviewRow {
  projectId: string;
  projectName: string;
  color: ProjectColor;
  taskMinutes: number;
  projectMinutes: number;
  totalMinutes: number;
}

export interface ReviewStats {
  range: ReviewRange;
  taskMinutes: number;
  projectMinutes: number;
  totalMinutes: number;
  completedCount: number;
  overdueCount: number;
  blockedCount: number;
  estimateMinutes: number;
  actualTaskMinutes: number;
  estimateVarianceMinutes: number;
  averageCompletionCycleMinutes: number;
  daily: DailyReviewPoint[];
  projects: ProjectReviewRow[];
  overdueTasks: TaskWithMeta[];
  blockedTasks: TaskWithMeta[];
  bypasses: DependencyBypass[];
}

export interface BackupPayload {
  version: 1;
  exported_at: string;
  projects: Project[];
  tasks: Task[];
  subtasks: Subtask[];
  timeEntries: TimeEntry[];
  projectTimeEntries?: ProjectTimeEntry[];
  taskDependencies?: TaskDependency[];
  dependencyBypasses?: DependencyBypass[];
}
