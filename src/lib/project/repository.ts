import { randomUUID } from 'node:crypto';
import { localDb, nowIso } from '@/lib/local-db';
import type {
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
} from '@/types/project';
import type {
  ProjectInput,
  ProjectTimeEntryInput,
  SubtaskInput,
  TaskInput,
  TimeEntryInput,
} from '@/lib/project/validation';

type ProjectRow = Omit<Project, 'color'> & { color: string };
type TaskRow = Task;
type SubtaskRow = Omit<Subtask, 'is_done'> & { is_done: number };
type TimeEntryRow = TimeEntry;
type ProjectTimeEntryRow = ProjectTimeEntry;

function mapProject(row: ProjectRow): Project {
  return { ...row, color: row.color as ProjectColor };
}

function mapSubtask(row: SubtaskRow): Subtask {
  return { ...row, is_done: Boolean(row.is_done) };
}

function touchProject(projectId: string, at = nowIso()) {
  localDb.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(at, projectId);
}

export function listProjects(status?: ProjectStatus | 'all'): ProjectSummary[] {
  const rows = (
    status && status !== 'all'
      ? localDb
          .prepare(
            `SELECT p.*,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_total,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'completed') AS task_completed,
              (
                (SELECT COALESCE(SUM(te.minutes), 0)
                   FROM time_entries te
                   JOIN tasks t ON t.id = te.task_id
                  WHERE t.project_id = p.id)
                + (SELECT COALESCE(SUM(pte.minutes), 0)
                   FROM project_time_entries pte
                  WHERE pte.project_id = p.id)
              ) AS minutes_total,
              (SELECT MIN(t.due_date)
                 FROM tasks t
                WHERE t.project_id = p.id
                  AND t.status != 'completed'
                  AND t.due_date IS NOT NULL) AS nearest_due_date
             FROM projects p
            WHERE p.status = ?
            ORDER BY p.updated_at DESC`,
          )
          .all(status)
      : localDb
          .prepare(
            `SELECT p.*,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_total,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'completed') AS task_completed,
              (
                (SELECT COALESCE(SUM(te.minutes), 0)
                   FROM time_entries te
                   JOIN tasks t ON t.id = te.task_id
                  WHERE t.project_id = p.id)
                + (SELECT COALESCE(SUM(pte.minutes), 0)
                   FROM project_time_entries pte
                  WHERE pte.project_id = p.id)
              ) AS minutes_total,
              (SELECT MIN(t.due_date)
                 FROM tasks t
                WHERE t.project_id = p.id
                  AND t.status != 'completed'
                  AND t.due_date IS NOT NULL) AS nearest_due_date
             FROM projects p
            ORDER BY p.updated_at DESC`,
          )
          .all()
  ) as Array<
    ProjectRow & {
      task_total: number;
      task_completed: number;
      minutes_total: number;
      nearest_due_date: string | null;
    }
  >;

  return rows.map((row) => {
    const total = Number(row.task_total) || 0;
    const completed = Number(row.task_completed) || 0;
    return {
      ...mapProject(row),
      task_total: total,
      task_completed: completed,
      progress: total === 0 ? 0 : completed / total,
      minutes_total: Number(row.minutes_total) || 0,
      nearest_due_date: row.nearest_due_date,
    };
  });
}

export function getProject(id: string): Project | null {
  const row = localDb.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
  return row ? mapProject(row) : null;
}

export function getProjectSummary(id: string): ProjectSummary | null {
  return listProjects('all').find((project) => project.id === id) ?? null;
}

export function createProject(input: ProjectInput): Project {
  const id = randomUUID();
  const at = nowIso();
  localDb
    .prepare(
      `INSERT INTO projects(id,name,description,color,target_date,start_date,status,created_at,updated_at,completed_at)
       VALUES(?,?,?,?,?,?,'active',?,?,NULL)`,
    )
    .run(id, input.name, input.description, input.color, input.target_date, input.start_date, at, at);
  return getProject(id)!;
}

export function updateProject(id: string, input: ProjectInput): Project {
  const existing = getProject(id);
  if (!existing) throw new Error('项目不存在');
  const at = nowIso();
  localDb
    .prepare(
      `UPDATE projects
          SET name = ?, description = ?, color = ?, target_date = ?, start_date = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(input.name, input.description, input.color, input.target_date, input.start_date, at, id);
  return getProject(id)!;
}

export function setProjectStatus(id: string, status: ProjectStatus): Project {
  const existing = getProject(id);
  if (!existing) throw new Error('项目不存在');
  const at = nowIso();
  const completedAt = status === 'completed' ? at : null;
  localDb
    .prepare('UPDATE projects SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?')
    .run(status, completedAt, at, id);
  return getProject(id)!;
}

export function listTasks(projectId?: string): TaskWithMeta[] {
  const rows = (
    projectId
      ? localDb
          .prepare(
            `SELECT t.*,
                    p.name AS project_name,
                    p.color AS project_color,
                    p.status AS project_status,
                    (SELECT COALESCE(SUM(te.minutes),0) FROM time_entries te WHERE te.task_id = t.id) AS minutes_total,
                    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) AS subtask_total,
                    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.is_done = 1) AS subtask_done
               FROM tasks t
               JOIN projects p ON p.id = t.project_id
              WHERE t.project_id = ?
              ORDER BY t.position ASC, t.created_at ASC`,
          )
          .all(projectId)
      : localDb
          .prepare(
            `SELECT t.*,
                    p.name AS project_name,
                    p.color AS project_color,
                    p.status AS project_status,
                    (SELECT COALESCE(SUM(te.minutes),0) FROM time_entries te WHERE te.task_id = t.id) AS minutes_total,
                    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) AS subtask_total,
                    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.is_done = 1) AS subtask_done
               FROM tasks t
               JOIN projects p ON p.id = t.project_id
              ORDER BY t.due_date IS NULL, t.due_date ASC, t.created_at DESC`,
          )
          .all()
  ) as Array<
    TaskRow & {
      project_name: string;
      project_color: string;
      project_status: ProjectStatus;
      minutes_total: number;
      subtask_total: number;
      subtask_done: number;
    }
  >;

  return rows.map((row) => ({
    ...row,
    project_color: row.project_color as ProjectColor,
    minutes_total: Number(row.minutes_total) || 0,
    subtask_total: Number(row.subtask_total) || 0,
    subtask_done: Number(row.subtask_done) || 0,
  }));
}

export function getTask(id: string): TaskWithMeta | null {
  return listTasks().find((task) => task.id === id) ?? null;
}

function nextTaskPosition(projectId: string, status: TaskStatus): number {
  const row = localDb
    .prepare(
      `SELECT MIN(position) AS min_pos FROM tasks WHERE project_id = ? AND status = ?`,
    )
    .get(projectId, status) as { min_pos: number | null };
  if (row.min_pos == null) return 0;
  return row.min_pos - 1;
}

export function createTask(input: TaskInput): TaskWithMeta {
  const project = getProject(input.project_id);
  if (!project) throw new Error('项目不存在');
  if (project.status === 'archived') throw new Error('已归档项目不能新增任务');

  const id = randomUUID();
  const at = nowIso();
  const position = nextTaskPosition(input.project_id, input.status);
  localDb
    .prepare(
      `INSERT INTO tasks(
         id, project_id, title, description, status, priority, due_date, position, created_at, updated_at, completed_at
       ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      input.project_id,
      input.title,
      input.description,
      input.status,
      input.priority,
      input.due_date,
      position,
      at,
      at,
      input.status === 'completed' ? at : null,
    );
  touchProject(input.project_id, at);
  return getTask(id)!;
}

export function updateTask(id: string, patch: Partial<TaskInput>): TaskWithMeta {
  const existing = getTask(id);
  if (!existing) throw new Error('任务不存在');

  const nextProjectId = patch.project_id ?? existing.project_id;
  const nextProject = getProject(nextProjectId);
  if (!nextProject) throw new Error('项目不存在');
  if (nextProject.status === 'archived') throw new Error('不能移动到已归档项目');

  const title = patch.title ?? existing.title;
  const description = patch.description ?? existing.description;
  const status = patch.status ?? existing.status;
  const priority = patch.priority ?? existing.priority;
  const dueDate = patch.due_date === undefined ? existing.due_date : patch.due_date;
  const at = nowIso();
  const completedAt =
    status === 'completed' ? existing.completed_at && existing.status === 'completed' ? existing.completed_at : at : null;

  let position = existing.position;
  if (status !== existing.status || nextProjectId !== existing.project_id) {
    position = nextTaskPosition(nextProjectId, status);
  }

  localDb
    .prepare(
      `UPDATE tasks
          SET project_id = ?, title = ?, description = ?, status = ?, priority = ?, due_date = ?, position = ?, updated_at = ?, completed_at = ?
        WHERE id = ?`,
    )
    .run(nextProjectId, title, description, status, priority, dueDate, position, at, completedAt, id);

  touchProject(existing.project_id, at);
  if (nextProjectId !== existing.project_id) touchProject(nextProjectId, at);
  return getTask(id)!;
}

export function deleteTask(id: string) {
  const existing = getTask(id);
  if (!existing) throw new Error('任务不存在');
  const at = nowIso();
  localDb.exec('BEGIN');
  try {
    localDb.prepare('DELETE FROM time_entries WHERE task_id = ?').run(id);
    localDb.prepare('DELETE FROM subtasks WHERE task_id = ?').run(id);
    localDb.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    touchProject(existing.project_id, at);
    localDb.exec('COMMIT');
  } catch (error) {
    localDb.exec('ROLLBACK');
    throw error;
  }
}

export function deleteProject(id: string) {
  const existing = getProject(id);
  if (!existing) throw new Error('项目不存在');
  const at = nowIso();
  localDb.exec('BEGIN');
  try {
    const taskIds = localDb
      .prepare('SELECT id FROM tasks WHERE project_id = ?')
      .all(id)
      .map((row) => (row as { id: string }).id);
    for (const taskId of taskIds) {
      localDb.prepare('DELETE FROM time_entries WHERE task_id = ?').run(taskId);
      localDb.prepare('DELETE FROM subtasks WHERE task_id = ?').run(taskId);
    }
    localDb.prepare('DELETE FROM tasks WHERE project_id = ?').run(id);
    localDb.prepare('DELETE FROM project_time_entries WHERE project_id = ?').run(id);
    localDb.prepare('DELETE FROM projects WHERE id = ?').run(id);
    // 触摸已无意义（项目已删），保持事务一致性不保留 touchProject 调用
    localDb.exec('COMMIT');
  } catch (error) {
    localDb.exec('ROLLBACK');
    throw error;
  }
  void at;
}

export function listSubtasks(taskId: string): Subtask[] {
  const rows = localDb
    .prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY position ASC, created_at ASC')
    .all(taskId) as SubtaskRow[];
  return rows.map(mapSubtask);
}

export function createSubtask(taskId: string, input: SubtaskInput): Subtask {
  const task = getTask(taskId);
  if (!task) throw new Error('任务不存在');
  const count = listSubtasks(taskId).length;
  if (count >= 20) throw new Error('单个任务最多 20 个子任务');

  const id = randomUUID();
  const at = nowIso();
  const position = count;
  localDb
    .prepare(
      `INSERT INTO subtasks(id,task_id,title,is_done,position,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?)`,
    )
    .run(id, taskId, input.title, input.is_done ? 1 : 0, position, at, at);
  touchProject(task.project_id, at);
  return listSubtasks(taskId).find((item) => item.id === id)!;
}

export function updateSubtask(
  id: string,
  patch: { title?: string; is_done?: boolean; position?: number },
): Subtask {
  const row = localDb.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as SubtaskRow | undefined;
  if (!row) throw new Error('子任务不存在');
  const task = getTask(row.task_id);
  if (!task) throw new Error('任务不存在');

  const at = nowIso();
  localDb
    .prepare(
      `UPDATE subtasks
          SET title = ?, is_done = ?, position = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(
      patch.title ?? row.title,
      patch.is_done == null ? row.is_done : patch.is_done ? 1 : 0,
      patch.position ?? row.position,
      at,
      id,
    );
  touchProject(task.project_id, at);
  return listSubtasks(row.task_id).find((item) => item.id === id)!;
}

export function deleteSubtask(id: string) {
  const row = localDb.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as SubtaskRow | undefined;
  if (!row) throw new Error('子任务不存在');
  const task = getTask(row.task_id);
  if (!task) throw new Error('任务不存在');
  const at = nowIso();
  localDb.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
  touchProject(task.project_id, at);
}

export function moveSubtask(id: string, direction: 'up' | 'down'): Subtask {
  const row = localDb.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as SubtaskRow | undefined;
  if (!row) throw new Error('子任务不存在');
  const siblings = listSubtasks(row.task_id);
  const index = siblings.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('子任务不存在');
  const swapWith = direction === 'up' ? siblings[index - 1] : siblings[index + 1];
  if (!swapWith) return mapSubtask(row);

  const at = nowIso();
  const task = getTask(row.task_id);
  if (!task) throw new Error('任务不存在');
  localDb.exec('BEGIN');
  try {
    localDb
      .prepare('UPDATE subtasks SET position = ?, updated_at = ? WHERE id = ?')
      .run(swapWith.position, at, row.id);
    localDb
      .prepare('UPDATE subtasks SET position = ?, updated_at = ? WHERE id = ?')
      .run(row.position, at, swapWith.id);
    touchProject(task.project_id, at);
    localDb.exec('COMMIT');
  } catch (error) {
    localDb.exec('ROLLBACK');
    throw error;
  }
  return listSubtasks(row.task_id).find((item) => item.id === id)!;
}

export function listTimeEntries(taskId: string): TimeEntry[] {
  return localDb
    .prepare('SELECT * FROM time_entries WHERE task_id = ? ORDER BY logged_date DESC, created_at DESC')
    .all(taskId) as TimeEntry[];
}

export function createTimeEntry(taskId: string, input: TimeEntryInput): TimeEntry {
  const task = getTask(taskId);
  if (!task) throw new Error('任务不存在');
  if (task.project_status === 'archived') throw new Error('已归档项目不能记录耗时');

  const id = randomUUID();
  const at = nowIso();
  localDb
    .prepare(
      `INSERT INTO time_entries(id,task_id,minutes,logged_date,note,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?)`,
    )
    .run(id, taskId, input.minutes, input.logged_date, input.note, at, at);
  touchProject(task.project_id, at);
  return (localDb.prepare('SELECT * FROM time_entries WHERE id = ?').get(id) as TimeEntry);
}

export function updateTimeEntry(id: string, input: TimeEntryInput): TimeEntry {
  const row = localDb.prepare('SELECT * FROM time_entries WHERE id = ?').get(id) as TimeEntryRow | undefined;
  if (!row) throw new Error('耗时记录不存在');
  const task = getTask(row.task_id);
  if (!task) throw new Error('任务不存在');
  if (task.project_status === 'archived') throw new Error('已归档项目不能修改耗时');

  const at = nowIso();
  localDb
    .prepare(
      `UPDATE time_entries
          SET minutes = ?, logged_date = ?, note = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(input.minutes, input.logged_date, input.note, at, id);
  touchProject(task.project_id, at);
  return localDb.prepare('SELECT * FROM time_entries WHERE id = ?').get(id) as TimeEntry;
}

export function deleteTimeEntry(id: string) {
  const row = localDb.prepare('SELECT * FROM time_entries WHERE id = ?').get(id) as TimeEntryRow | undefined;
  if (!row) throw new Error('耗时记录不存在');
  const task = getTask(row.task_id);
  if (!task) throw new Error('任务不存在');
  if (task.project_status === 'archived') throw new Error('已归档项目不能删除耗时');
  const at = nowIso();
  localDb.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
  touchProject(task.project_id, at);
}

// --- 项目级耗时（不依附任何任务，直接记在项目上） ---

export function listProjectTimeEntries(projectId: string): ProjectTimeEntry[] {
  return localDb
    .prepare('SELECT * FROM project_time_entries WHERE project_id = ? ORDER BY logged_date DESC, created_at DESC')
    .all(projectId) as ProjectTimeEntryRow[];
}

export function createProjectTimeEntry(projectId: string, input: ProjectTimeEntryInput): ProjectTimeEntry {
  const project = getProject(projectId);
  if (!project) throw new Error('项目不存在');
  if (project.status === 'archived') throw new Error('已归档项目不能记录耗时');

  const id = randomUUID();
  const at = nowIso();
  localDb
    .prepare(
      `INSERT INTO project_time_entries(id,project_id,minutes,logged_date,note,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?)`,
    )
    .run(id, projectId, input.minutes, input.logged_date, input.note, at, at);
  touchProject(projectId, at);
  return localDb.prepare('SELECT * FROM project_time_entries WHERE id = ?').get(id) as ProjectTimeEntry;
}

export function updateProjectTimeEntry(id: string, input: ProjectTimeEntryInput): ProjectTimeEntry {
  const row = localDb
    .prepare('SELECT * FROM project_time_entries WHERE id = ?')
    .get(id) as ProjectTimeEntryRow | undefined;
  if (!row) throw new Error('耗时记录不存在');
  const project = getProject(row.project_id);
  if (!project) throw new Error('项目不存在');
  if (project.status === 'archived') throw new Error('已归档项目不能修改耗时');

  const at = nowIso();
  localDb
    .prepare(
      `UPDATE project_time_entries
          SET minutes = ?, logged_date = ?, note = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(input.minutes, input.logged_date, input.note, at, id);
  touchProject(row.project_id, at);
  return localDb.prepare('SELECT * FROM project_time_entries WHERE id = ?').get(id) as ProjectTimeEntry;
}

export function deleteProjectTimeEntry(id: string) {
  const row = localDb
    .prepare('SELECT * FROM project_time_entries WHERE id = ?')
    .get(id) as ProjectTimeEntryRow | undefined;
  if (!row) throw new Error('耗时记录不存在');
  const project = getProject(row.project_id);
  if (!project) throw new Error('项目不存在');
  if (project.status === 'archived') throw new Error('已归档项目不能删除耗时');
  const at = nowIso();
  localDb.prepare('DELETE FROM project_time_entries WHERE id = ?').run(id);
  touchProject(row.project_id, at);
}

export function moveTaskPosition(taskId: string, direction: 'up' | 'down'): TaskWithMeta {
  const task = getTask(taskId);
  if (!task) throw new Error('任务不存在');
  const siblings = listTasks(task.project_id).filter((item) => item.status === task.status);
  const index = siblings.findIndex((item) => item.id === taskId);
  if (index < 0) throw new Error('任务不存在');
  const swapWith = direction === 'up' ? siblings[index - 1] : siblings[index + 1];
  if (!swapWith) return task;

  const at = nowIso();
  localDb.exec('BEGIN');
  try {
    localDb.prepare('UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?').run(swapWith.position, at, task.id);
    localDb.prepare('UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?').run(task.position, at, swapWith.id);
    touchProject(task.project_id, at);
    localDb.exec('COMMIT');
  } catch (error) {
    localDb.exec('ROLLBACK');
    throw error;
  }
  return getTask(taskId)!;
}

export function countActionBadge(today: string): number {
  const row = localDb
    .prepare(
      `SELECT COUNT(*) AS count
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
        WHERE p.status != 'archived'
          AND t.status != 'completed'
          AND t.due_date IS NOT NULL
          AND t.due_date <= ?`,
    )
    .get(today) as { count: number };
  return Number(row.count) || 0;
}

export function weekMinutes(start: string, end: string): number {
  const row = localDb
    .prepare(
      `SELECT COALESCE(SUM(minutes), 0) AS total
         FROM time_entries
        WHERE logged_date >= ? AND logged_date <= ?`,
    )
    .get(start, end) as { total: number };
  return Number(row.total) || 0;
}

export interface TodayGroups {
  overdue: TaskWithMeta[];
  dueToday: TaskWithMeta[];
  highSoon: TaskWithMeta[];
  inProgress: TaskWithMeta[];
}

export function listTodayGroups(today: string, horizon = 3): TodayGroups {
  const open = listTasks().filter(
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

export interface WeekStats {
  completedThisWeek: number;
  createdOrOpenThisWeek: number;
  completionRate: number;
  minutesThisWeek: number;
  activeProjects: number;
}

export function getWeekStats(today: string): WeekStats {
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
  const end = today;

  const completedRow = localDb
    .prepare(
      `SELECT COUNT(*) AS count
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
        WHERE t.status = 'completed'
          AND t.completed_at IS NOT NULL
          AND substr(t.completed_at, 1, 10) >= ?
          AND substr(t.completed_at, 1, 10) <= ?`,
    )
    .get(start, end) as { count: number };

  const openRow = localDb
    .prepare(
      `SELECT COUNT(*) AS count
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
        WHERE p.status != 'archived'
          AND t.status != 'completed'`,
    )
    .get() as { count: number };

  const completed = Number(completedRow.count) || 0;
  const stillOpen = Number(openRow.count) || 0;
  const denom = completed + stillOpen;
  return {
    completedThisWeek: completed,
    createdOrOpenThisWeek: denom,
    completionRate: denom === 0 ? 0 : completed / denom,
    minutesThisWeek: weekMinutes(start, end),
    activeProjects: listProjects('active').length,
  };
}

export function listTasksByDueRange(start: string, end: string): TaskWithMeta[] {
  return listTasks().filter((task) => {
    if (!task.due_date) return false;
    return task.due_date >= start && task.due_date <= end;
  });
}

export interface BackupPayload {
  version: 1;
  exported_at: string;
  projects: Project[];
  tasks: Task[];
  subtasks: Subtask[];
  timeEntries: TimeEntry[];
  projectTimeEntries?: ProjectTimeEntry[];
}

export function exportBackup(): BackupPayload {
  const projects = localDb.prepare('SELECT * FROM projects ORDER BY created_at ASC').all() as ProjectRow[];
  const tasks = localDb.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all() as TaskRow[];
  const subtasks = localDb.prepare('SELECT * FROM subtasks ORDER BY created_at ASC').all() as SubtaskRow[];
  const timeEntries = localDb
    .prepare('SELECT * FROM time_entries ORDER BY created_at ASC')
    .all() as TimeEntryRow[];
  const projectTimeEntries = localDb
    .prepare('SELECT * FROM project_time_entries ORDER BY created_at ASC')
    .all() as ProjectTimeEntryRow[];
  return {
    version: 1,
    exported_at: nowIso(),
    projects: projects.map(mapProject),
    tasks,
    subtasks: subtasks.map(mapSubtask),
    timeEntries,
    projectTimeEntries,
  };
}

export function importBackup(payload: BackupPayload): {
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

  localDb.exec('BEGIN');
  try {
    for (const project of payload.projects) {
      localDb
        .prepare(
          `INSERT INTO projects(id,name,description,color,target_date,start_date,status,created_at,updated_at,completed_at)
           VALUES(?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             name=excluded.name,
             description=excluded.description,
             color=excluded.color,
             target_date=excluded.target_date,
             start_date=excluded.start_date,
             status=excluded.status,
             updated_at=excluded.updated_at,
             completed_at=excluded.completed_at`,
        )
        .run(
          project.id,
          project.name,
          project.description ?? '',
          project.color,
          project.target_date,
          project.start_date ?? null,
          project.status,
          project.created_at,
          project.updated_at,
          project.completed_at,
        );
    }

    for (const task of payload.tasks ?? []) {
      localDb
        .prepare(
          `INSERT INTO tasks(id,project_id,title,description,status,priority,due_date,position,created_at,updated_at,completed_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             project_id=excluded.project_id,
             title=excluded.title,
             description=excluded.description,
             status=excluded.status,
             priority=excluded.priority,
             due_date=excluded.due_date,
             position=excluded.position,
             updated_at=excluded.updated_at,
             completed_at=excluded.completed_at`,
        )
        .run(
          task.id,
          task.project_id,
          task.title,
          task.description ?? '',
          task.status,
          task.priority,
          task.due_date,
          task.position ?? 0,
          task.created_at,
          task.updated_at,
          task.completed_at,
        );
    }

    for (const subtask of payload.subtasks ?? []) {
      localDb
        .prepare(
          `INSERT INTO subtasks(id,task_id,title,is_done,position,created_at,updated_at)
           VALUES(?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             task_id=excluded.task_id,
             title=excluded.title,
             is_done=excluded.is_done,
             position=excluded.position,
             updated_at=excluded.updated_at`,
        )
        .run(
          subtask.id,
          subtask.task_id,
          subtask.title,
          subtask.is_done ? 1 : 0,
          subtask.position ?? 0,
          subtask.created_at,
          subtask.updated_at,
        );
    }

    for (const entry of payload.timeEntries ?? []) {
      localDb
        .prepare(
          `INSERT INTO time_entries(id,task_id,minutes,logged_date,note,created_at,updated_at)
           VALUES(?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             task_id=excluded.task_id,
             minutes=excluded.minutes,
             logged_date=excluded.logged_date,
             note=excluded.note,
             updated_at=excluded.updated_at`,
        )
        .run(
          entry.id,
          entry.task_id,
          entry.minutes,
          entry.logged_date,
          entry.note ?? '',
          entry.created_at,
          entry.updated_at,
        );
    }

    for (const entry of payload.projectTimeEntries ?? []) {
      localDb
        .prepare(
          `INSERT INTO project_time_entries(id,project_id,minutes,logged_date,note,created_at,updated_at)
           VALUES(?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             project_id=excluded.project_id,
             minutes=excluded.minutes,
             logged_date=excluded.logged_date,
             note=excluded.note,
             updated_at=excluded.updated_at`,
        )
        .run(
          entry.id,
          entry.project_id,
          entry.minutes,
          entry.logged_date,
          entry.note ?? '',
          entry.created_at,
          entry.updated_at,
        );
    }

    localDb.exec('COMMIT');
  } catch (error) {
    localDb.exec('ROLLBACK');
    throw error;
  }

  return {
    projects: payload.projects.length,
    tasks: (payload.tasks ?? []).length,
    subtasks: (payload.subtasks ?? []).length,
    timeEntries: (payload.timeEntries ?? []).length,
    projectTimeEntries: (payload.projectTimeEntries ?? []).length,
  };
}
