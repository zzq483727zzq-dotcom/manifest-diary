export type ProjectStatus = 'active' | 'completed' | 'archived';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

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
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
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
