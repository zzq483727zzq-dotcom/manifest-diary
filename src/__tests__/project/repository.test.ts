import { beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const dbDir = path.join(process.cwd(), 'data-test-project');
const dbPath = path.join(dbDir, 'test.sqlite');

beforeEach(() => {
  rmSync(dbDir, { recursive: true, force: true });
  mkdirSync(dbDir, { recursive: true });
  process.env.LOCAL_DB_PATH = dbPath;
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
});
