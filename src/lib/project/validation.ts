import { PROJECT_COLORS, type ProjectColor, type ProjectStatus, type TaskPriority, type TaskStatus } from '@/types/project';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') throw new Error('请输入有效数据');
  return raw as Record<string, unknown>;
}

function trimString(value: unknown, field: string, min: number, max: number, required = true): string {
  if (value == null) {
    if (required) throw new Error(`${field}不能为空`);
    return '';
  }
  if (typeof value !== 'string') throw new Error(`${field}格式不正确`);
  const text = value.trim();
  if (required && text.length < min) throw new Error(`${field}不能为空`);
  if (text.length > max) throw new Error(`${field}不能超过 ${max} 个字符`);
  return text;
}

function optionalDate(value: unknown, field: string): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !DATE_RE.test(value)) throw new Error(`${field}格式应为 YYYY-MM-DD`);
  return value;
}

export interface ProjectInput {
  name: string;
  description: string;
  color: ProjectColor;
  target_date: string | null;
  start_date: string | null;
}

export interface TaskInput {
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
}

export interface SubtaskInput {
  title: string;
  is_done?: boolean;
}

export interface TimeEntryInput {
  minutes: number;
  logged_date: string;
  note: string;
}

export interface ProjectTimeEntryInput {
  minutes: number;
  logged_date: string;
  note: string;
}

// Alongside task-level minutes, projects can record time directly (not tied to a task).
function parseMinutesAndDate(raw: Record<string, unknown>, today: string) {
  const minutes = Number(raw.minutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error('耗时需为 1–1440 的整数分钟');
  }
  const logged_date = optionalDate(raw.logged_date ?? today, '记录日期');
  if (!logged_date) throw new Error('请填写记录日期');
  if (logged_date > today) throw new Error('不能记录未来日期的耗时');
  return {
    minutes,
    logged_date,
    note: trimString(raw.note ?? '', '备注', 0, 200, false),
  };
}

export function parseProjectInput(raw: unknown): ProjectInput {
  const input = asObject(raw);
  const name = trimString(input.name, '项目名称', 1, 80);
  const description = trimString(input.description ?? '', '项目描述', 0, 2000, false);
  const color = (input.color as string) || PROJECT_COLORS[0];
  if (!PROJECT_COLORS.includes(color as ProjectColor)) throw new Error('项目颜色不支持');
  return {
    name,
    description,
    color: color as ProjectColor,
    target_date: optionalDate(input.target_date, '目标日期'),
    start_date: optionalDate(input.start_date, '开始日期'),
  };
}

export function parseTaskInput(raw: unknown, partial = false): Partial<TaskInput> & Pick<TaskInput, never> | TaskInput {
  const input = asObject(raw);
  const statusValues: TaskStatus[] = ['todo', 'in_progress', 'completed'];
  const priorityValues: TaskPriority[] = ['low', 'medium', 'high'];

  if (partial) {
    const result: Partial<TaskInput> = {};
    if ('project_id' in input) {
      const projectId = trimString(input.project_id, '项目', 1, 80);
      result.project_id = projectId;
    }
    if ('title' in input) result.title = trimString(input.title, '任务标题', 1, 120);
    if ('description' in input) result.description = trimString(input.description ?? '', '任务描述', 0, 5000, false);
    if ('status' in input) {
      if (!statusValues.includes(input.status as TaskStatus)) throw new Error('任务状态不支持');
      result.status = input.status as TaskStatus;
    }
    if ('priority' in input) {
      if (!priorityValues.includes(input.priority as TaskPriority)) throw new Error('优先级不支持');
      result.priority = input.priority as TaskPriority;
    }
    if ('due_date' in input) result.due_date = optionalDate(input.due_date, '截止日期');
    return result;
  }

  const projectId = trimString(input.project_id, '项目', 1, 80);
  const title = trimString(input.title, '任务标题', 1, 120);
  const description = trimString(input.description ?? '', '任务描述', 0, 5000, false);
  const status = (input.status as TaskStatus) || 'todo';
  const priority = (input.priority as TaskPriority) || 'medium';
  if (!statusValues.includes(status)) throw new Error('任务状态不支持');
  if (!priorityValues.includes(priority)) throw new Error('优先级不支持');
  return {
    project_id: projectId,
    title,
    description,
    status,
    priority,
    due_date: optionalDate(input.due_date, '截止日期'),
  };
}

export function parseSubtaskInput(raw: unknown): SubtaskInput {
  const input = asObject(raw);
  return {
    title: trimString(input.title, '子任务标题', 1, 120),
    is_done: Boolean(input.is_done),
  };
}

export function parseTimeEntryInput(raw: unknown, today: string): TimeEntryInput {
  return parseMinutesAndDate(asObject(raw), today);
}

export function parseProjectTimeEntryInput(raw: unknown, today: string): ProjectTimeEntryInput {
  return parseMinutesAndDate(asObject(raw), today);
}

export function parseProjectStatus(value: unknown): ProjectStatus {
  const statusValues: ProjectStatus[] = ['active', 'completed', 'archived'];
  if (!statusValues.includes(value as ProjectStatus)) throw new Error('项目状态不支持');
  return value as ProjectStatus;
}
