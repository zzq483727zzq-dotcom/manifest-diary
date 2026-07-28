import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const root = path.join(process.cwd(), 'data-test-project');

beforeEach(() => {
  mkdirSync(root, { recursive: true });
  process.env.LOCAL_DB_PATH = path.join(root, `${randomUUID()}.sqlite`);
  vi.resetModules();
});

describe('project repository', () => {
  it('creates project and task with progress', async () => {
    const {
      createProject,
      createTask,
      listProjects,
      updateTask,
      deleteTask,
      getProjectSummary,
    } = await import('@/lib/project/repository');

    const project = createProject({
      name: '作品集',
      description: '',
      color: '#5EEAD4',
      target_date: null,
    });

    const task = createTask({
      project_id: project.id,
      title: '做首页',
      description: '',
      status: 'todo',
      priority: 'high',
      due_date: '2026-07-30',
    });

    expect(task.title).toBe('做首页');
    let summary = getProjectSummary(project.id)!;
    expect(summary.task_total).toBe(1);
    expect(summary.task_completed).toBe(0);

    updateTask(task.id, { status: 'completed' });
    summary = getProjectSummary(project.id)!;
    expect(summary.task_completed).toBe(1);
    expect(summary.progress).toBe(1);

    deleteTask(task.id);
    summary = getProjectSummary(project.id)!;
    expect(summary.task_total).toBe(0);
    expect(listProjects('active').some((p) => p.id === project.id)).toBe(true);
  });

  it('supports subtasks move and cascade delete', async () => {
    const {
      createProject,
      createTask,
      createSubtask,
      listSubtasks,
      moveSubtask,
      deleteTask,
      createTimeEntry,
      listTimeEntries,
      getProjectSummary,
    } = await import('@/lib/project/repository');

    const project = createProject({
      name: '迁移',
      description: '',
      color: '#7DD3FC',
      target_date: null,
    });
    const task = createTask({
      project_id: project.id,
      title: '父任务',
      description: '',
      status: 'todo',
      priority: 'medium',
      due_date: null,
    });

    createSubtask(task.id, { title: 'A' });
    const b = createSubtask(task.id, { title: 'B' });
    createTimeEntry(task.id, { minutes: 25, logged_date: '2026-07-28', note: '专注' });

    moveSubtask(b.id, 'up');
    expect(listSubtasks(task.id).map((item) => item.title)).toEqual(['B', 'A']);
    expect(listTimeEntries(task.id)).toHaveLength(1);
    expect(getProjectSummary(project.id)?.minutes_total).toBe(25);

    deleteTask(task.id);
    expect(listSubtasks(task.id)).toHaveLength(0);
    expect(listTimeEntries(task.id)).toHaveLength(0);
    expect(getProjectSummary(project.id)?.task_total).toBe(0);
  });

  it('groups today actions without duplicates', async () => {
    const { createProject, createTask, listTodayGroups } = await import('@/lib/project/repository');
    const project = createProject({
      name: '执行',
      description: '',
      color: '#C4B5FD',
      target_date: null,
    });

    createTask({
      project_id: project.id,
      title: '逾期高优',
      description: '',
      status: 'in_progress',
      priority: 'high',
      due_date: '2026-07-20',
    });
    createTask({
      project_id: project.id,
      title: '今天',
      description: '',
      status: 'todo',
      priority: 'medium',
      due_date: '2026-07-28',
    });
    createTask({
      project_id: project.id,
      title: '三天内高优',
      description: '',
      status: 'todo',
      priority: 'high',
      due_date: '2026-07-30',
    });
    createTask({
      project_id: project.id,
      title: '纯进行中',
      description: '',
      status: 'in_progress',
      priority: 'low',
      due_date: null,
    });

    const groups = listTodayGroups('2026-07-28');
    expect(groups.overdue.map((t) => t.title)).toEqual(['逾期高优']);
    expect(groups.dueToday.map((t) => t.title)).toEqual(['今天']);
    expect(groups.highSoon.map((t) => t.title)).toEqual(['三天内高优']);
    expect(groups.inProgress.map((t) => t.title)).toEqual(['纯进行中']);
  });

  it('exports and imports backup by uuid merge', async () => {
    const {
      createProject,
      createTask,
      exportBackup,
      importBackup,
      listProjects,
      listTasks,
    } = await import('@/lib/project/repository');

    const project = createProject({
      name: '原名',
      description: '',
      color: '#FBBF24',
      target_date: null,
    });
    const task = createTask({
      project_id: project.id,
      title: '原任务',
      description: '',
      status: 'todo',
      priority: 'low',
      due_date: null,
    });

    const backup = exportBackup();
    backup.projects[0].name = '新名';
    backup.tasks[0].title = '新任务';
    backup.tasks.push({
      ...task,
      id: '11111111-1111-1111-1111-111111111111',
      title: '额外任务',
    });

    const counts = importBackup(backup);
    expect(counts.projects).toBe(1);
    expect(counts.tasks).toBe(2);
    expect(listProjects('all')[0].name).toBe('新名');
    expect(listTasks(project.id).some((item) => item.title === '新任务')).toBe(true);
    expect(listTasks(project.id).some((item) => item.title === '额外任务')).toBe(true);
  });
});
