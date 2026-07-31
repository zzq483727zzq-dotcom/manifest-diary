import { describe, expect, it } from 'vitest';
import { emptyDB } from '@/lib/store/store';
import {
  createProject,
  createTask,
  exportBackup,
  getTaskEntity,
  importBackup,
  updateTask,
  weekMinutes,
} from '@/lib/store/repository';

describe('task focus completion', () => {
  it('records focused time when a focused task is completed', () => {
    const db = emptyDB();
    const project = createProject(db, {
      name: '项目',
      description: '',
      color: '#5EEAD4',
      target_date: null,
      start_date: null,
    });
    const task = createTask(db, {
      project_id: project.id,
      title: '任务',
      description: '',
      status: 'todo',
      priority: 'medium',
      due_date: null,
      start_date: null,
      target_minutes: 25,
    });
    const entity = getTaskEntity(db, task.id)!;
    entity.elapsed_seconds = 20;
    updateTask(db, task.id, { status: 'completed' });
    expect(db.timeEntries).toHaveLength(1);
    expect(db.timeEntries[0].minutes).toBe(1);
    expect(weekMinutes(db, '2026-07-27', '2026-08-02')).toBe(1);
  });

  it('persists execution fields on create and update', () => {
    const db = emptyDB();
    const project = createProject(db, {
      name: '项目',
      description: '',
      color: '#5EEAD4',
      target_date: null,
      start_date: null,
    });
    const task = createTask(db, {
      project_id: project.id,
      title: '任务',
      description: '',
      status: 'todo',
      priority: 'medium',
      due_date: null,
      start_date: null,
      estimate_minutes: 90,
      dependency_mode: 'any',
      is_blocked: true,
      blocked_reason: '等待反馈',
    });
    expect(task).toMatchObject({
      estimate_minutes: 90,
      dependency_mode: 'any',
      is_blocked: true,
      blocked_reason: '等待反馈',
    });
    expect(task.blocked_at).not.toBeNull();

    const updated = updateTask(db, task.id, {
      estimate_minutes: 120,
      dependency_mode: 'all',
      is_blocked: false,
      blocked_reason: null,
      blocked_at: null,
    });
    expect(updated).toMatchObject({
      estimate_minutes: 120,
      dependency_mode: 'all',
      is_blocked: false,
      blocked_reason: null,
      blocked_at: null,
    });
  });

  it('normalizes malformed execution fields during backup import', () => {
    const db = emptyDB();
    importBackup(db, {
      version: 1,
      exported_at: '2026-07-31T00:00:00.000Z',
      projects: [],
      tasks: [{
        id: 'task-1',
        project_id: 'project-1',
        title: '任务',
        description: '',
        status: 'todo',
        priority: 'medium',
        due_date: null,
        start_date: null,
        position: 0,
        target_minutes: 25,
        estimate_minutes: 999,
        dependency_mode: 'sometimes' as 'all',
        is_blocked: 'yes' as unknown as boolean,
        blocked_reason: 42 as unknown as string,
        blocked_at: 42 as unknown as string,
        started_at: null,
        elapsed_seconds: 0,
        created_at: '2026-07-31T00:00:00.000Z',
        updated_at: '2026-07-31T00:00:00.000Z',
        completed_at: null,
      }],
      subtasks: [],
      timeEntries: [],
      taskDependencies: [{
        id: 'dep-1',
        task_id: 'task-1',
        depends_on_task_id: 'task-2',
        created_at: '2026-07-31T00:00:00.000Z',
      }],
      dependencyBypasses: [{
        id: 'bypass-1',
        task_id: 'task-1',
        dependency_ids: 'dep-1' as unknown as string[],
        reason: 42 as unknown as string,
        created_at: '2026-07-31T00:00:00.000Z',
      }],
    });

    expect(db.tasks[0]).toMatchObject({
      estimate_minutes: 25,
      dependency_mode: 'all',
      is_blocked: false,
      blocked_reason: null,
      blocked_at: null,
    });
    expect(db.taskDependencies).toHaveLength(1);
    expect(db.dependencyBypasses[0]).toMatchObject({
      dependency_ids: [],
      reason: '',
    });
  });

  it('exports dependency tables without requiring repository logic', () => {
    const backup = exportBackup(emptyDB());
    expect(backup.taskDependencies).toEqual([]);
    expect(backup.dependencyBypasses).toEqual([]);
  });
});
