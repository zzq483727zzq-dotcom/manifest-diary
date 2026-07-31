import { describe, expect, it } from 'vitest';
import { emptyDB } from '@/lib/store/store';
import {
  addTaskDependency,
  canTaskStart,
  clearTaskBlocked,
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  exportBackup,
  getTaskBlockers,
  getTaskEntity,
  importBackup,
  listDependencyBypasses,
  listTaskDependencies,
  recordDependencyBypass,
  removeTaskDependency,
  setTaskBlocked,
  startTaskFocus,
  updateTask,
  weekMinutes,
} from '@/lib/store/repository';

function dependencyFixture() {
  const db = emptyDB();
  const project = createProject(db, {
    name: '主项目', description: '', color: '#5EEAD4', target_date: null, start_date: null,
  });
  const otherProject = createProject(db, {
    name: '其他项目', description: '', color: '#7DD3FC', target_date: null, start_date: null,
  });
  const taskInput = (project_id: string, title: string) => ({
    project_id, title, description: '', status: 'todo' as const, priority: 'medium' as const,
    due_date: null, start_date: null,
  });
  const taskA = createTask(db, taskInput(project.id, '前置一'));
  const taskB = createTask(db, taskInput(project.id, '前置二'));
  const taskC = createTask(db, taskInput(project.id, '后置任务'));
  const otherTask = createTask(db, taskInput(otherProject.id, '跨项目任务'));
  return {
    db,
    taskA: getTaskEntity(db, taskA.id)!,
    taskB: getTaskEntity(db, taskB.id)!,
    taskC: getTaskEntity(db, taskC.id)!,
    otherTask: getTaskEntity(db, otherTask.id)!,
  };
}

describe('task dependency repository', () => {
  it('accepts same-project dependencies and rejects duplicate, cross-project, self, and cyclic edges', () => {
    const { db, taskA, taskB, taskC, otherTask } = dependencyFixture();
    const dependency = addTaskDependency(db, taskB.id, taskA.id);

    expect(dependency).toMatchObject({ task_id: taskB.id, depends_on_task_id: taskA.id });
    expect(listTaskDependencies(db, taskB.id)).toEqual([dependency]);
    expect(() => addTaskDependency(db, taskB.id, taskA.id)).toThrow('依赖已经存在');
    expect(() => addTaskDependency(db, taskB.id, taskB.id)).toThrow('不能依赖自己');
    expect(() => addTaskDependency(db, taskC.id, otherTask.id)).toThrow('只能依赖同一项目');
    addTaskDependency(db, taskC.id, taskB.id);
    expect(() => addTaskDependency(db, taskA.id, taskC.id)).toThrow('不能形成循环依赖');

    removeTaskDependency(db, dependency.id);
    expect(listTaskDependencies(db, taskB.id)).toEqual([]);
    expect(() => removeTaskDependency(db, dependency.id)).toThrow('依赖不存在');
  });

  it('rejects moving a dependency-bearing task across projects', () => {
    const { db, taskA, taskB, otherTask } = dependencyFixture();
    const dependency = addTaskDependency(db, taskB.id, taskA.id);
    const originalProjectId = taskB.project_id;

    expect(() => updateTask(db, taskB.id, { project_id: otherTask.project_id })).toThrow('移动任务会破坏同项目依赖');
    expect(taskB.project_id).toBe(originalProjectId);
    expect(listTaskDependencies(db, taskB.id)).toEqual([dependency]);

    expect(() => updateTask(db, taskA.id, { project_id: otherTask.project_id })).toThrow('移动任务会破坏同项目依赖');
    expect(taskA.project_id).toBe(originalProjectId);
  });

  it('touches both project timestamps after a successful task move', () => {
    const { db, taskC, otherTask } = dependencyFixture();
    const oldProject = db.projects.find((project) => project.id === taskC.project_id)!;
    const newProject = db.projects.find((project) => project.id === otherTask.project_id)!;
    oldProject.updated_at = '2020-01-01T00:00:00.000Z';
    newProject.updated_at = '2020-01-01T00:00:00.000Z';

    updateTask(db, taskC.id, { project_id: newProject.id });

    expect(taskC.project_id).toBe(newProject.id);
    expect(oldProject.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
    expect(newProject.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
  });
  it('supports all and any dependency readiness without mutating the database', () => {
    const { db, taskA, taskB, taskC } = dependencyFixture();
    const first = addTaskDependency(db, taskC.id, taskA.id);
    const second = addTaskDependency(db, taskC.id, taskB.id);

    expect(canTaskStart(db, taskC.id)).toMatchObject({
      ready: false, dependencyIds: [first.id, second.id],
      unfinishedDependencyIds: [taskA.id, taskB.id], externalReason: null,
    });
    expect(taskC.dependency_mode).toBe('all');

    taskA.status = 'completed';
    expect(getTaskBlockers(db, taskC.id)).toMatchObject({
      ready: false, unfinishedDependencyIds: [taskB.id],
    });
    taskC.dependency_mode = 'any';
    expect(canTaskStart(db, taskC.id)).toMatchObject({
      ready: true, unfinishedDependencyIds: [taskB.id],
    });
    expect(taskC.status).toBe('todo');

    taskA.status = 'todo';
    expect(canTaskStart(db, taskC.id).ready).toBe(false);
  });

  it('blocks ordinary focus starts and records explicit bypasses', () => {
    const { db, taskA, taskC } = dependencyFixture();
    addTaskDependency(db, taskC.id, taskA.id);
    expect(() => startTaskFocus(db, taskC.id)).toThrow('任务当前被阻塞');
    expect(taskC.started_at).toBeNull();

    startTaskFocus(db, taskC.id, { bypass: true, reason: '先处理可独立部分' });
    expect(taskC.status).toBe('in_progress');
    expect(taskC.started_at).not.toBeNull();
    expect(db.dependencyBypasses).toHaveLength(1);
  });
  it('records and clears external blocking while preserving bypass history', () => {
    const { db, taskA, taskC } = dependencyFixture();
    const dependency = addTaskDependency(db, taskC.id, taskA.id);

    setTaskBlocked(db, taskC.id, '等待客户确认');
    expect(getTaskBlockers(db, taskC.id)).toMatchObject({
      ready: false, externalReason: '等待客户确认', unfinishedDependencyIds: [taskA.id],
    });
    expect(() => setTaskBlocked(db, taskC.id, '   ')).toThrow('阻塞原因不能为空');

    const bypass = recordDependencyBypass(db, taskC.id, [dependency.id], '先处理可独立部分');
    expect(listDependencyBypasses(db, taskC.id)).toEqual([bypass]);
    expect(bypass.dependency_ids).toEqual([dependency.id]);
    taskA.status = 'completed';
    expect(() => recordDependencyBypass(db, taskC.id, [dependency.id], '前置任务已完成')).toThrow('只能绕过未完成依赖');
    expect(() => recordDependencyBypass(db, taskC.id, ['unknown-dependency'], '未知依赖')).toThrow('依赖记录不属于当前任务');
    expect(() => recordDependencyBypass(db, taskC.id, [dependency.id, 'unknown-dependency'], '混合依赖')).toThrow('依赖记录不属于当前任务');
    expect(() => recordDependencyBypass(db, taskC.id, [dependency.id], '   ')).toThrow('绕过原因不能为空');

    clearTaskBlocked(db, taskC.id);
    expect(getTaskBlockers(db, taskC.id).externalReason).toBeNull();
    expect(listDependencyBypasses(db, taskC.id)).toHaveLength(1);
  });

});

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
      }, {
        id: 'task-2',
        project_id: 'project-1',
        title: '前置任务',
        description: '',
        status: 'todo',
        priority: 'medium',
        due_date: null,
        start_date: null,
        position: 1,
        target_minutes: 25,
        estimate_minutes: 25,
        dependency_mode: 'all',
        is_blocked: false,
        blocked_reason: null,
        blocked_at: null,
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
    expect(db.taskDependencies[0]).toMatchObject({
      task_id: 'task-1', depends_on_task_id: 'task-2',
    });
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

  it('drops invalid imported dependency graph rows and bypass references', () => {
    const db = emptyDB();
    const project = createProject(db, {
      name: '项目', description: '', color: '#5EEAD4', target_date: null, start_date: null,
    });
    const otherProject = createProject(db, {
      name: '其他', description: '', color: '#7DD3FC', target_date: null, start_date: null,
    });
    const taskA = createTask(db, {
      project_id: project.id, title: '一', description: '', status: 'todo', priority: 'medium',
      due_date: null, start_date: null,
    });
    const taskB = createTask(db, {
      project_id: project.id, title: '二', description: '', status: 'todo', priority: 'medium',
      due_date: null, start_date: null,
    });
    const otherTask = createTask(db, {
      project_id: otherProject.id, title: '跨项目', description: '', status: 'todo', priority: 'medium',
      due_date: null, start_date: null,
    });
    importBackup(db, {
      version: 1, exported_at: '2026-07-31T00:00:00.000Z', projects: [], tasks: [], subtasks: [], timeEntries: [],
      taskDependencies: [
        { id: 'dep-valid', task_id: taskA.id, depends_on_task_id: taskB.id, created_at: '2026-07-31T00:00:00.000Z' },
        { id: 'dep-duplicate', task_id: taskA.id, depends_on_task_id: taskB.id, created_at: '2026-07-31T00:00:00.000Z' },
        { id: 'dep-cross', task_id: taskA.id, depends_on_task_id: otherTask.id, created_at: '2026-07-31T00:00:00.000Z' },
        { id: 'dep-self', task_id: taskA.id, depends_on_task_id: taskA.id, created_at: '2026-07-31T00:00:00.000Z' },
        { id: 'dep-cycle', task_id: taskB.id, depends_on_task_id: taskA.id, created_at: '2026-07-31T00:00:00.000Z' },
      ],
      dependencyBypasses: [
        { id: 'bypass-valid', task_id: taskA.id, dependency_ids: ['dep-valid'], reason: '原因', created_at: '2026-07-31T00:00:00.000Z' },
        { id: 'bypass-unknown', task_id: taskA.id, dependency_ids: ['missing'], reason: '原因', created_at: '2026-07-31T00:00:00.000Z' },
      ],
    });
    expect(db.taskDependencies.map((item) => item.id)).toEqual(['dep-valid']);
    expect(db.dependencyBypasses.map((item) => item.id)).toEqual(['bypass-valid']);

    getTaskEntity(db, taskB.id)!.status = 'completed';
    importBackup(db, {
      version: 1, exported_at: '2026-07-31T00:00:00.000Z', projects: [], tasks: [], subtasks: [], timeEntries: [],
      dependencyBypasses: [{
        id: 'bypass-completed', task_id: taskA.id, dependency_ids: ['dep-valid'], reason: '已完成',
        created_at: '2026-07-31T00:00:00.000Z',
      }],
    });
    expect(db.dependencyBypasses.map((item) => item.id)).toEqual(['bypass-valid']);
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
    const project = createProject(source, {
      name: '项目', description: '', color: '#5EEAD4', target_date: null, start_date: null,
    });
    createTask(source, {
      project_id: project.id, title: '任务一', description: '', status: 'todo', priority: 'medium',
      due_date: null, start_date: null,
    }).id;
    createTask(source, {
      project_id: project.id, title: '任务二', description: '', status: 'todo', priority: 'medium',
      due_date: null, start_date: null,
    }).id;
    const sourceTasks = source.tasks;
    source.taskDependencies.push({
      id: 'dep-1', task_id: sourceTasks[0].id, depends_on_task_id: sourceTasks[1].id,
      created_at: '2026-07-31T00:00:00.000Z',
    });
    source.dependencyBypasses.push({
      id: 'bypass-1', task_id: sourceTasks[0].id, dependency_ids: ['dep-1'], reason: '原因',
      created_at: '2026-07-31T00:00:00.000Z',
    });
    const backup = exportBackup(source);
    expect(backup.taskDependencies).toHaveLength(1);
    expect(backup.dependencyBypasses).toHaveLength(1);
    const target = emptyDB();
    importBackup(target, exportBackup(source));
    expect(target.taskDependencies).toHaveLength(1);
    expect(target.dependencyBypasses).toHaveLength(1);
  });

  it('accepts empty dependency ids for external-only bypasses', () => {
    const db = emptyDB();
    const project = createProject(db, {
      name: '项目', description: '', color: '#5EEAD4', target_date: null, start_date: null,
    });
    const task = createTask(db, {
      project_id: project.id, title: '任务', description: '', status: 'todo', priority: 'medium',
      due_date: null, start_date: null,
    });
    importBackup(db, {
      version: 1,
      exported_at: '2026-07-31T00:00:00.000Z',
      projects: [],
      tasks: [],
      subtasks: [],
      timeEntries: [],
      dependencyBypasses: [{
        id: 'bypass-external', task_id: task.id, dependency_ids: [], reason: '外部阻塞',
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
