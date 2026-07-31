import { describe, expect, it } from 'vitest';
import { emptyDB } from '@/lib/store/store';
import {
  createProject,
  createTask,
  deleteProject,
  deleteTask,
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
    expect(db.dependencyBypasses).toEqual([]);
  });

  it('rejects malformed active blocking fields and malformed dependency tables', () => {
    const db = emptyDB();
    importBackup(db, {
      version: 1,
      exported_at: '2026-07-31T00:00:00.000Z',
      projects: [],
      tasks: [{
        id: 'task-active',
        project_id: 'project-1',
        title: '任务',
        description: '',
        status: 'todo',
        priority: 'medium',
        due_date: null,
        start_date: null,
        position: 0,
        target_minutes: 25,
        estimate_minutes: 25,
        dependency_mode: 'all',
        is_blocked: true,
        blocked_reason: '   ',
        blocked_at: 'invalid',
        started_at: null,
        elapsed_seconds: 0,
        created_at: '2026-07-31T00:00:00.000Z',
        updated_at: '2026-07-31T00:00:00.000Z',
        completed_at: null,
      }],
      subtasks: [],
      timeEntries: [],
      taskDependencies: 'bad' as unknown as [],
      dependencyBypasses: {} as unknown as [],
    });
    expect(db.tasks[0]).toMatchObject({
      is_blocked: false,
      blocked_reason: null,
      blocked_at: null,
    });
    expect(db.taskDependencies).toEqual([]);
    expect(db.dependencyBypasses).toEqual([]);
  });

  it('filters invalid dependency and bypass records', () => {
    const db = emptyDB();
    importBackup(db, {
      version: 1,
      exported_at: '2026-07-31T00:00:00.000Z',
      projects: [],
      tasks: [],
      subtasks: [],
      timeEntries: [],
      taskDependencies: [
        { id: '', task_id: 'task-1', depends_on_task_id: 'task-2', created_at: '2026-07-31T00:00:00.000Z' },
        { id: 'dep-valid', task_id: 'task-1', depends_on_task_id: 'task-2', created_at: 'invalid' },
      ],
      dependencyBypasses: [
        { id: 'bypass-valid', task_id: 'task-1', dependency_ids: [''], reason: '   ', created_at: 'invalid' },
      ],
    });
    expect(db.taskDependencies).toEqual([]);
    expect(db.dependencyBypasses).toEqual([]);
  });

  it('drops bypasses with scalar or mixed dependency ids', () => {
    const db = emptyDB();
    importBackup(db, {
      version: 1,
      exported_at: '2026-07-31T00:00:00.000Z',
      projects: [],
      tasks: [],
      subtasks: [],
      timeEntries: [],
      dependencyBypasses: [
        {
          id: 'bypass-scalar',
          task_id: 'task-1',
          dependency_ids: 'dep-1' as unknown as string[],
          reason: '绕过原因',
          created_at: '2026-07-31T00:00:00.000Z',
        },
        {
          id: 'bypass-mixed',
          task_id: 'task-1',
          dependency_ids: ['dep-1', ''],
          reason: '绕过原因',
          created_at: '2026-07-31T00:00:00.000Z',
        },
      ],
    });
    expect(db.dependencyBypasses).toEqual([]);
  });

  it('cleans dependency edges and bypasses when deleting a task', () => {
    const db = emptyDB();
    db.taskDependencies.push(
      { id: 'dep-in', task_id: 'task-1', depends_on_task_id: 'task-2', created_at: '2026-07-31T00:00:00.000Z' },
      { id: 'dep-out', task_id: 'task-2', depends_on_task_id: 'task-1', created_at: '2026-07-31T00:00:00.000Z' },
      { id: 'dep-keep', task_id: 'task-2', depends_on_task_id: 'task-3', created_at: '2026-07-31T00:00:00.000Z' },
    );
    db.dependencyBypasses.push({
      id: 'bypass-delete', task_id: 'task-1', dependency_ids: ['dep-in'], reason: '原因',
      created_at: '2026-07-31T00:00:00.000Z',
    });
    db.dependencyBypasses.push({
      id: 'bypass-keep', task_id: 'task-2', dependency_ids: ['dep-keep'], reason: '原因',
      created_at: '2026-07-31T00:00:00.000Z',
    });
    db.tasks.push(
      { id: 'task-1', project_id: 'project-1', title: '一', description: '', status: 'todo', priority: 'medium', due_date: null, start_date: null, position: 0, target_minutes: 25, estimate_minutes: 25, dependency_mode: 'all', is_blocked: false, blocked_reason: null, blocked_at: null, started_at: null, elapsed_seconds: 0, created_at: '2026-07-31T00:00:00.000Z', updated_at: '2026-07-31T00:00:00.000Z', completed_at: null },
      { id: 'task-2', project_id: 'project-1', title: '二', description: '', status: 'todo', priority: 'medium', due_date: null, start_date: null, position: 0, target_minutes: 25, estimate_minutes: 25, dependency_mode: 'all', is_blocked: false, blocked_reason: null, blocked_at: null, started_at: null, elapsed_seconds: 0, created_at: '2026-07-31T00:00:00.000Z', updated_at: '2026-07-31T00:00:00.000Z', completed_at: null },
    );
    deleteTask(db, 'task-1');
    expect(db.taskDependencies.map((item) => item.id)).toEqual(['dep-keep']);
    expect(db.dependencyBypasses.map((item) => item.id)).toEqual(['bypass-keep']);
  });

  it('exports dependency tables and reports import counts', () => {
    const source = emptyDB();
    source.taskDependencies.push({
      id: 'dep-1', task_id: 'task-1', depends_on_task_id: 'task-2',
      created_at: '2026-07-31T00:00:00.000Z',
    });
    source.dependencyBypasses.push({
      id: 'bypass-1', task_id: 'task-1', dependency_ids: ['dep-1'], reason: '原因',
      created_at: '2026-07-31T00:00:00.000Z',
    });
    const backup = exportBackup(source);
    expect(backup.taskDependencies).toHaveLength(1);
    expect(backup.dependencyBypasses).toHaveLength(1);
    const target = emptyDB();
    const counts = importBackup(target, backup);
    expect(counts.taskDependencies).toBe(1);
    expect(counts.dependencyBypasses).toBe(1);
  });

  it('accepts empty dependency ids for external-only bypasses', () => {
    const db = emptyDB();
    importBackup(db, {
      version: 1,
      exported_at: '2026-07-31T00:00:00.000Z',
      projects: [],
      tasks: [],
      subtasks: [],
      timeEntries: [],
      dependencyBypasses: [{
        id: 'bypass-external', task_id: 'task-1', dependency_ids: [], reason: '外部阻塞',
        created_at: '2026-07-31T00:00:00.000Z',
      }],
    });
    expect(db.dependencyBypasses).toHaveLength(1);
    expect(db.dependencyBypasses[0].dependency_ids).toEqual([]);
  });

  it('cleans all project dependency records when deleting a project', () => {
    const db = emptyDB();
    db.tasks.push(
      { id: 'task-project', project_id: 'project-delete', title: '项目任务', description: '', status: 'todo', priority: 'medium', due_date: null, start_date: null, position: 0, target_minutes: 25, estimate_minutes: 25, dependency_mode: 'all', is_blocked: false, blocked_reason: null, blocked_at: null, started_at: null, elapsed_seconds: 0, created_at: '2026-07-31T00:00:00.000Z', updated_at: '2026-07-31T00:00:00.000Z', completed_at: null },
      { id: 'task-other', project_id: 'project-keep', title: '其他任务', description: '', status: 'todo', priority: 'medium', due_date: null, start_date: null, position: 0, target_minutes: 25, estimate_minutes: 25, dependency_mode: 'all', is_blocked: false, blocked_reason: null, blocked_at: null, started_at: null, elapsed_seconds: 0, created_at: '2026-07-31T00:00:00.000Z', updated_at: '2026-07-31T00:00:00.000Z', completed_at: null },
    );
    db.projects.push(
      { id: 'project-delete', name: '删除', description: '', color: '#5EEAD4', target_date: null, start_date: null, status: 'active', created_at: '2026-07-31T00:00:00.000Z', updated_at: '2026-07-31T00:00:00.000Z', completed_at: null, target_minutes: 25, started_at: null, elapsed_seconds: 0 },
      { id: 'project-keep', name: '保留', description: '', color: '#7DD3FC', target_date: null, start_date: null, status: 'active', created_at: '2026-07-31T00:00:00.000Z', updated_at: '2026-07-31T00:00:00.000Z', completed_at: null, target_minutes: 25, started_at: null, elapsed_seconds: 0 },
    );
    db.taskDependencies.push(
      { id: 'dep-delete', task_id: 'task-project', depends_on_task_id: 'task-other', created_at: '2026-07-31T00:00:00.000Z' },
      { id: 'dep-keep', task_id: 'task-other', depends_on_task_id: 'task-other', created_at: '2026-07-31T00:00:00.000Z' },
    );
    db.dependencyBypasses.push(
      { id: 'bypass-delete', task_id: 'task-project', dependency_ids: [], reason: '外部', created_at: '2026-07-31T00:00:00.000Z' },
      { id: 'bypass-reference', task_id: 'task-other', dependency_ids: ['dep-delete'], reason: '绕过', created_at: '2026-07-31T00:00:00.000Z' },
    );
    deleteProject(db, 'project-delete');
    expect(db.taskDependencies.map((item) => item.id)).toEqual(['dep-keep']);
    expect(db.dependencyBypasses).toEqual([]);
  });

  it('prunes bypass references to deleted dependency edges', () => {
    const db = emptyDB();
    db.tasks.push(
      { id: 'task-delete', project_id: 'project-1', title: '删除', description: '', status: 'todo', priority: 'medium', due_date: null, start_date: null, position: 0, target_minutes: 25, estimate_minutes: 25, dependency_mode: 'all', is_blocked: false, blocked_reason: null, blocked_at: null, started_at: null, elapsed_seconds: 0, created_at: '2026-07-31T00:00:00.000Z', updated_at: '2026-07-31T00:00:00.000Z', completed_at: null },
      { id: 'task-owner', project_id: 'project-1', title: '保留', description: '', status: 'todo', priority: 'medium', due_date: null, start_date: null, position: 0, target_minutes: 25, estimate_minutes: 25, dependency_mode: 'all', is_blocked: false, blocked_reason: null, blocked_at: null, started_at: null, elapsed_seconds: 0, created_at: '2026-07-31T00:00:00.000Z', updated_at: '2026-07-31T00:00:00.000Z', completed_at: null },
    );
    db.taskDependencies.push({ id: 'dep-delete', task_id: 'task-owner', depends_on_task_id: 'task-delete', created_at: '2026-07-31T00:00:00.000Z' });
    db.dependencyBypasses.push({ id: 'bypass-owner', task_id: 'task-owner', dependency_ids: ['dep-delete'], reason: '绕过', created_at: '2026-07-31T00:00:00.000Z' });
    deleteTask(db, 'task-delete');
    expect(db.dependencyBypasses).toEqual([]);
  });

  it('rejects invalid create fields at the repository boundary', () => {
    const db = emptyDB();
    const project = createProject(db, {
      name: '项目', description: '', color: '#5EEAD4', target_date: null, start_date: null,
    });
    const base = {
      project_id: project.id, title: '任务', description: '', status: 'todo' as const,
      priority: 'medium' as const, due_date: null, start_date: null,
    };
    expect(() => createTask(db, { ...base, estimate_minutes: 0 })).toThrow('预计时长需为 1–600');
    expect(() => createTask(db, { ...base, dependency_mode: 'bad' as 'all' })).toThrow('依赖模式不支持');
    expect(() => createTask(db, { ...base, is_blocked: true })).toThrow('阻塞原因不能为空');
  });

  it('validates update execution fields atomically', () => {
    const db = emptyDB();
    const project = createProject(db, {
      name: '项目', description: '', color: '#5EEAD4', target_date: null, start_date: null,
    });
    const task = createTask(db, {
      project_id: project.id, title: '原标题', description: '', status: 'todo', priority: 'medium',
      due_date: null, start_date: null,
    });
    expect(() => updateTask(db, task.id, { title: '新标题', estimate_minutes: 0 })).toThrow('预计时长需为 1–600');
    expect(getTaskEntity(db, task.id)).toMatchObject({ title: '原标题', estimate_minutes: 25 });
  });

});
