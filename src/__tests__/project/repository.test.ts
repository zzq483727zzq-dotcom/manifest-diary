import { describe, expect, it } from 'vitest';
import { emptyDB } from '@/lib/store/store';
import type { ClarityDB } from '@/lib/store/store';
import type { Project, TaskWithMeta } from '@/types/project';
import { parseSubtaskInput } from '@/lib/project/validation';
import {
  createProject,
  createTask,
  createSubtask,
  createTimeEntry,
  deleteTimeEntry,
  getTaskEntity,
  listTimeEntries,
  listSubtasks,
  listTasks,
  moveTaskPosition,
  updateTask,
  updateSubtask,
  updateProject,
  setProjectStatus,
  getProjectSummary,
  weekMinutes,
  addTaskDependency,
  removeTaskDependency,
  listTaskDependencies,
  canTaskStart,
  getTaskBlockers,
  setTaskBlocked,
  clearTaskBlocked,
  recordDependencyBypass,
  listDependencyBypasses,
  startTaskFocus,
  finishTaskFocus,
  deleteTask,
} from '@/lib/store/repository';

interface FixtureData {
  db: ClarityDB;
  project: Project;
  taskA: TaskWithMeta;
  taskB: TaskWithMeta;
  taskC: TaskWithMeta;
}

function fixtureDb(): FixtureData {
  const db = emptyDB();
  const project = createProject(db, {
    name: '测试项目',
    description: '',
    color: '#5EEAD4',
    target_date: null,
    start_date: null,
  });
  const taskA = createTask(db, {
    project_id: project.id,
    title: '任务A',
    description: '',
    status: 'todo',
    priority: 'medium',
    due_date: null,
    start_date: null,
    target_minutes: 25,
  });
  const taskB = createTask(db, {
    project_id: project.id,
    title: '任务B',
    description: '',
    status: 'todo',
    priority: 'medium',
    due_date: null,
    start_date: null,
    target_minutes: 25,
  });
  const taskC = createTask(db, {
    project_id: project.id,
    title: '任务C',
    description: '',
    status: 'todo',
    priority: 'medium',
    due_date: null,
    start_date: null,
    target_minutes: 25,
  });
  return { db, project, taskA, taskB, taskC };
}

// ---------------------------------------------------------------------------
// Dependency graph
// ---------------------------------------------------------------------------

describe('task dependencies', () => {
  it('accepts same-project dependencies', () => {
    const { db, taskA, taskB } = fixtureDb();
    const dep = addTaskDependency(db, taskB.id, taskA.id);
    expect(dep.task_id).toBe(taskB.id);
    expect(dep.depends_on_task_id).toBe(taskA.id);
    expect(dep.id).toBeTruthy();
    expect(dep.created_at).toBeTruthy();
  });

  it('rejects self-dependency', () => {
    const { db, taskA } = fixtureDb();
    expect(() => addTaskDependency(db, taskA.id, taskA.id)).toThrow('不能依赖自己');
  });

  it('rejects cross-project dependency', () => {
    const { db, taskA } = fixtureDb();
    const otherProject = createProject(db, {
      name: '其他项目',
      description: '',
      color: '#7DD3FC',
      target_date: null,
      start_date: null,
    });
    const otherTask = createTask(db, {
      project_id: otherProject.id,
      title: '其他任务',
      description: '',
      status: 'todo',
      priority: 'medium',
      due_date: null,
      start_date: null,
      target_minutes: 25,
    });
    expect(() => addTaskDependency(db, taskA.id, otherTask.id)).toThrow('只能依赖同一项目');
  });

  it('rejects duplicate edges', () => {
    const { db, taskA, taskB } = fixtureDb();
    addTaskDependency(db, taskB.id, taskA.id);
    expect(() => addTaskDependency(db, taskB.id, taskA.id)).toThrow('依赖关系已存在');
  });

  it('rejects cyclic dependencies', () => {
    const { db, taskA, taskB, taskC } = fixtureDb();
    addTaskDependency(db, taskB.id, taskA.id);
    addTaskDependency(db, taskC.id, taskB.id);
    expect(() => addTaskDependency(db, taskA.id, taskC.id)).toThrow('不能形成循环依赖');
  });

  it('rejects dependency on non-existent task', () => {
    const { db, taskA } = fixtureDb();
    expect(() => addTaskDependency(db, taskA.id, 'nonexistent')).toThrow('任务不存在');
  });

  it('removes a dependency', () => {
    const { db, taskA, taskB } = fixtureDb();
    const dep = addTaskDependency(db, taskB.id, taskA.id);
    expect(listTaskDependencies(db, taskB.id)).toHaveLength(1);
    removeTaskDependency(db, dep.id);
    expect(listTaskDependencies(db, taskB.id)).toHaveLength(0);
  });

  it('rejects removing unknown dependency', () => {
    const { db } = fixtureDb();
    expect(() => removeTaskDependency(db, 'unknown')).toThrow('依赖关系不存在');
  });

  it('lists all dependencies for a task', () => {
    const { db, taskA, taskB, taskC } = fixtureDb();
    addTaskDependency(db, taskC.id, taskA.id);
    addTaskDependency(db, taskC.id, taskB.id);
    const deps = listTaskDependencies(db, taskC.id);
    expect(deps).toHaveLength(2);
    expect(deps.map((d) => d.depends_on_task_id).sort()).toEqual([taskA.id, taskB.id].sort());
  });
});

// ---------------------------------------------------------------------------
// Task blockers and readiness
// ---------------------------------------------------------------------------

describe('task blockers and readiness', () => {
  it('reports ready when no dependencies and not blocked', () => {
    const { db, taskA } = fixtureDb();
    const blockers = getTaskBlockers(db, taskA.id);
    expect(blockers.ready).toBe(true);
    expect(blockers.unfinishedDependencyIds).toHaveLength(0);
    expect(blockers.externalReason).toBeNull();
  });

  it('reports unfinished dependencies with all mode', () => {
    const { db, taskA, taskB, taskC } = fixtureDb();
    addTaskDependency(db, taskC.id, taskA.id);
    addTaskDependency(db, taskC.id, taskB.id);
    const blockers = getTaskBlockers(db, taskC.id);
    expect(blockers.ready).toBe(false);
    expect(blockers.unfinishedDependencyIds).toHaveLength(2);
  });

  it('supports any dependency readiness', () => {
    const { db, taskA, taskB, taskC } = fixtureDb();
    addTaskDependency(db, taskC.id, taskA.id);
    addTaskDependency(db, taskC.id, taskB.id);
    // Set to any mode: one completed dependency is enough
    const entity = getTaskEntity(db, taskC.id)!;
    entity.dependency_mode = 'any';
    // Complete taskA
    const taskAEntity = getTaskEntity(db, taskA.id)!;
    taskAEntity.status = 'completed';
    const blockers = getTaskBlockers(db, taskC.id);
    expect(blockers.ready).toBe(true);
    expect(blockers.unfinishedDependencyIds).toHaveLength(1); // taskB still unfinished
  });

  it('reports external blocking', () => {
    const { db, taskA } = fixtureDb();
    setTaskBlocked(db, taskA.id, '等待客户确认');
    const blockers = getTaskBlockers(db, taskA.id);
    expect(blockers.externalReason).toBe('等待客户确认');
    expect(blockers.ready).toBe(false);
  });

  it('canTaskStart returns same info as getTaskBlockers', () => {
    const { db, taskA, taskB } = fixtureDb();
    addTaskDependency(db, taskB.id, taskA.id);
    const blockers = getTaskBlockers(db, taskB.id);
    const canStart = canTaskStart(db, taskB.id);
    expect(canStart).toEqual(blockers);
  });
});

// ---------------------------------------------------------------------------
// External blocking
// ---------------------------------------------------------------------------

describe('external blocking', () => {
  it('records and clears external blocking', () => {
    const { db, taskA } = fixtureDb();
    setTaskBlocked(db, taskA.id, '等待客户确认');
    const entity = getTaskEntity(db, taskA.id)!;
    expect(entity.is_blocked).toBe(true);
    expect(entity.blocked_reason).toBe('等待客户确认');
    expect(entity.blocked_at).toBeTruthy();

    clearTaskBlocked(db, taskA.id);
    expect(entity.is_blocked).toBe(false);
    expect(entity.blocked_reason).toBeNull();
    expect(entity.blocked_at).toBeTruthy();
  });

  it('validates blocked reason length', () => {
    const { db, taskA } = fixtureDb();
    expect(() => setTaskBlocked(db, taskA.id, '')).toThrow('阻塞原因不能为空');
    expect(() => setTaskBlocked(db, taskA.id, 'a'.repeat(201))).toThrow('不能超过 200 个字符');
  });

  it('clearing non-blocked task is a no-op', () => {
    const { db, taskA } = fixtureDb();
    expect(() => clearTaskBlocked(db, taskA.id)).not.toThrow();
    const entity = getTaskEntity(db, taskA.id)!;
    expect(entity.is_blocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dependency bypass
// ---------------------------------------------------------------------------

describe('dependency bypass', () => {
  it('records a dependency bypass', () => {
    const { db, taskA, taskB, taskC } = fixtureDb();
    addTaskDependency(db, taskC.id, taskA.id);
    addTaskDependency(db, taskC.id, taskB.id);
    const bypass = recordDependencyBypass(db, taskC.id, [taskA.id, taskB.id], '先处理可独立部分');
    expect(bypass.task_id).toBe(taskC.id);
    expect(bypass.dependency_ids).toEqual([taskA.id, taskB.id]);
    expect(bypass.reason).toBe('先处理可独立部分');
  });

  it('validates bypass reason length', () => {
    const { db, taskA } = fixtureDb();
    expect(() => recordDependencyBypass(db, taskA.id, [], '')).toThrow('绕过原因不能为空');
    expect(() => recordDependencyBypass(db, taskA.id, [], 'a'.repeat(201))).toThrow('不能超过 200 个字符');
  });

  it('lists bypasses for a task', () => {
    const { db, taskA, taskB, taskC } = fixtureDb();
    addTaskDependency(db, taskC.id, taskA.id);
    addTaskDependency(db, taskC.id, taskB.id);
    recordDependencyBypass(db, taskC.id, [taskA.id], '先处理部分');
    const bypasses = listDependencyBypasses(db, taskC.id);
    expect(bypasses).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Focus state transitions
// ---------------------------------------------------------------------------

describe('task focus transitions', () => {
  it('starts focus by moving a todo task to in_progress', () => {
    const { db, taskA } = fixtureDb();
    startTaskFocus(db, taskA.id);
    const entity = getTaskEntity(db, taskA.id)!;
    expect(entity.status).toBe('in_progress');
    expect(entity.started_at).not.toBeNull();
  });

  it('finishes a task early by saving focus and marking it completed', () => {
    const { db, taskA } = fixtureDb();
    const entity = getTaskEntity(db, taskA.id)!;
    entity.elapsed_seconds = 90;
    const entry = finishTaskFocus(db, taskA.id, '提前结束');
    expect(entity.status).toBe('completed');
    expect(entity.started_at).toBeNull();
    expect(entry).not.toBeNull();
    expect(entry!.task_id).toBe(taskA.id);
    expect(entry!.note).toBe('提前结束');
  });

  it('refuses ordinary start while blocked', () => {
    const { db, taskA } = fixtureDb();
    setTaskBlocked(db, taskA.id, '等待反馈');
    expect(() => startTaskFocus(db, taskA.id)).toThrow('任务当前被阻塞');
  });

  it('allows start with bypass option when blocked', () => {
    const { db, taskA } = fixtureDb();
    setTaskBlocked(db, taskA.id, '等待反馈');
    startTaskFocus(db, taskA.id, { bypass: true, reason: '先处理可独立部分' });
    const entity = getTaskEntity(db, taskA.id)!;
    expect(entity.status).toBe('in_progress');
    expect(db.dependencyBypasses).toHaveLength(1);
  });

  it('refuses start on completed task', () => {
    const { db, taskA } = fixtureDb();
    const entity = getTaskEntity(db, taskA.id)!;
    entity.status = 'completed';
    expect(() => startTaskFocus(db, taskA.id)).toThrow('已完成的任务不能开始专注');
  });

  it('refuses start on archived project task', () => {
    const { db, taskA } = fixtureDb();
    const project = db.projects.find((p) => p.id === taskA.project_id)!;
    project.status = 'archived';
    expect(() => startTaskFocus(db, taskA.id)).toThrow('已归档');
  });

  it('finishTaskFocus with zero elapsed time clears state without creating entry', () => {
    const { db, taskA } = fixtureDb();
    const entry = finishTaskFocus(db, taskA.id, '没专注就完成了');
    const entity = getTaskEntity(db, taskA.id)!;
    expect(entity.status).toBe('completed');
    expect(entity.started_at).toBeNull();
    expect(entity.elapsed_seconds).toBe(0);
    expect(entry).toBeNull();
  });

  it('startTaskFocus checks dependency blockers and rejects without bypass', () => {
    const { db, taskA, taskB, taskC } = fixtureDb();
    addTaskDependency(db, taskC.id, taskA.id);
    addTaskDependency(db, taskC.id, taskB.id);
    expect(() => startTaskFocus(db, taskC.id)).toThrow('依赖未完成');
  });

  it('startTaskFocus allows bypass for dependency blockers', () => {
    const { db, taskA, taskB, taskC } = fixtureDb();
    addTaskDependency(db, taskC.id, taskA.id);
    addTaskDependency(db, taskC.id, taskB.id);
    startTaskFocus(db, taskC.id, { bypass: true, reason: '独立处理' });
    const entity = getTaskEntity(db, taskC.id)!;
    expect(entity.status).toBe('in_progress');
    expect(db.dependencyBypasses).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Cleanup on delete
// ---------------------------------------------------------------------------

describe('task deletion cleanup', () => {
  it('removes dependencies when a task is deleted', () => {
    const { db, taskA, taskB } = fixtureDb();
    const dep = addTaskDependency(db, taskB.id, taskA.id);
    deleteTask(db, taskA.id);
    expect(db.taskDependencies.find((d) => d.id === dep.id)).toBeUndefined();
  });

  it('removes bypasses when a task is deleted', () => {
    const { db, taskA } = fixtureDb();
    recordDependencyBypass(db, taskA.id, [], '绕过');
    deleteTask(db, taskA.id);
    expect(db.dependencyBypasses.find((b) => b.task_id === taskA.id)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Existing test: task focus completion
// ---------------------------------------------------------------------------

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
});

// ---------------------------------------------------------------------------
// Project editing and status transitions
// ---------------------------------------------------------------------------

describe('project editing', () => {
  it('updateProject persists name/description/color/dates', () => {
    const db = emptyDB();
    const project = createProject(db, {
      name: '旧名',
      description: '旧描述',
      color: '#5EEAD4',
      target_date: null,
      start_date: null,
    });

    updateProject(db, project.id, {
      name: '新名',
      description: '新描述',
      color: '#7DD3FC',
      target_date: '2026-12-31',
      start_date: '2026-09-01',
    });

    const entity = getProjectSummary(db, project.id)!;
    expect(entity.name).toBe('新名');
    expect(entity.description).toBe('新描述');
    expect(entity.color).toBe('#7DD3FC');
    expect(entity.target_date).toBe('2026-12-31');
    expect(entity.start_date).toBe('2026-09-01');
    // 状态字段不被 updateProject 改动。
    expect(entity.status).toBe('active');
    // updated_at 仍是一个合法 ISO 时间戳。
    expect(Number.isNaN(Date.parse(entity.updated_at))).toBe(false);
  });

  it('updateProject rejects unknown project', () => {
    const db = emptyDB();
    expect(() =>
      updateProject(db, 'nonexistent', {
        name: 'x',
        description: '',
        color: '#5EEAD4',
        target_date: null,
        start_date: null,
      }),
    ).toThrow('项目不存在');
  });

  it('setProjectStatus marks completed and records completed_at', () => {
    const db = emptyDB();
    const project = createProject(db, {
      name: '项目',
      description: '',
      color: '#5EEAD4',
      target_date: null,
      start_date: null,
    });
    setProjectStatus(db, project.id, 'completed');
    const entity = getProjectSummary(db, project.id)!;
    expect(entity.status).toBe('completed');
    expect(entity.completed_at).toBeTruthy();
  });

  it('setProjectStatus back to active clears completed_at', () => {
    const db = emptyDB();
    const project = createProject(db, {
      name: '项目',
      description: '',
      color: '#5EEAD4',
      target_date: null,
      start_date: null,
    });
    setProjectStatus(db, project.id, 'completed');
    setProjectStatus(db, project.id, 'active');
    const entity = getProjectSummary(db, project.id)!;
    expect(entity.status).toBe('active');
    expect(entity.completed_at).toBeNull();
  });

  it('setProjectStatus archives without error', () => {
    const db = emptyDB();
    const project = createProject(db, {
      name: '项目',
      description: '',
      color: '#5EEAD4',
      target_date: null,
      start_date: null,
    });
    setProjectStatus(db, project.id, 'archived');
    const entity = getProjectSummary(db, project.id)!;
    expect(entity.status).toBe('archived');
  });

  it('setProjectStatus rejects unknown project', () => {
    const db = emptyDB();
    expect(() => setProjectStatus(db, 'nonexistent', 'completed')).toThrow('项目不存在');
  });
});

// ---------------------------------------------------------------------------
// Manual task re-order (moveTaskPosition)
// ---------------------------------------------------------------------------

describe('task position reorder', () => {
  // nextTaskPosition 给每个新任务一个比前面更小的 position（min-1），
  // 因此 fixture 里 taskC(-2) < taskB(-1) < taskA(0)，listTasks 排序后是
  // [taskC, taskB, taskA]。moveTaskPosition 交换的是「排序结果里的前后邻居」，
  // 测试以排序后的相对位置为准，而不是原始 position 数值。

  function orderOf(db: ClarityDB, ids: string[]): string[] {
    const tasks = listTasks(db, db.tasks[0].project_id).filter((t) => ids.includes(t.id));
    return tasks.map((t) => t.id);
  }

  it('moving a task up swaps it with its preceding sibling in sorted order', () => {
    const { db, taskA, taskB, taskC } = fixtureDb();
    expect(orderOf(db, [taskA.id, taskB.id, taskC.id])).toEqual([taskC.id, taskB.id, taskA.id]);
    moveTaskPosition(db, taskA.id, 'up');
    // A 和 B(now 前邻居) 交换 → B 沉到末、A 中间
    expect(orderOf(db, [taskA.id, taskB.id, taskC.id])).toEqual([taskC.id, taskA.id, taskB.id]);
  });

  it('moving the first sibling up is a no-op', () => {
    const { db, taskC } = fixtureDb();
    const before = orderOf(db, [taskC.id]);
    moveTaskPosition(db, taskC.id, 'up');
    expect(orderOf(db, [taskC.id])).toEqual(before);
    expect(getTaskEntity(db, taskC.id)!.position).toBe(-2);
  });

  it('moving a task down swaps it with its next sibling', () => {
    const { db, taskA, taskB, taskC } = fixtureDb();
    moveTaskPosition(db, taskC.id, 'down');
    // C(首) 下移 → 与 B 交换
    expect(orderOf(db, [taskA.id, taskB.id, taskC.id])).toEqual([taskB.id, taskC.id, taskA.id]);
  });

  it('rejects unknown task', () => {
    const { db } = fixtureDb();
    expect(() => moveTaskPosition(db, 'nonexistent', 'up')).toThrow('任务不存在');
  });
});

describe('subtask rename and time entries', () => {
  it('updateSubtask renames a subtask', () => {
    const { db, taskA } = fixtureDb();
    const sub = createSubtask(db, taskA.id, { title: '初稿' });
    updateSubtask(db, sub.id, { title: '修订稿' });
    const after = listSubtasks(db, taskA.id).find((s) => s.id === sub.id)!;
    expect(after.title).toBe('修订稿');
  });

  it('parseSubtaskInput rejects blank title', () => {
    expect(() => parseSubtaskInput({ title: '   ' })).toThrow();
  });

  it('updateSubtask accepts blank storage path without crashing', () => {
    const { db, taskA } = fixtureDb();
    const sub = createSubtask(db, taskA.id, { title: '初稿' });
    // 仓储层不校验 title，只透传；UI 走 parseSubtaskInput 把关。这里只保证不崩。
    expect(() => updateSubtask(db, sub.id, { title: '' })).not.toThrow();
  });

  it('createTimeEntry + listTimeEntries + deleteTimeEntry round-trip', () => {
    const { db, taskA } = fixtureDb();
    const entry = createTimeEntry(db, taskA.id, { minutes: 25, logged_date: '2026-08-02', note: '手动补录' });
    expect(listTimeEntries(db, taskA.id)).toHaveLength(1);
    deleteTimeEntry(db, entry.id);
    expect(listTimeEntries(db, taskA.id)).toHaveLength(0);
  });

  it('createTimeEntry rejects archived project', () => {
    const { db, taskA, project } = fixtureDb();
    setProjectStatus(db, project.id, 'archived');
    expect(() =>
      createTimeEntry(db, taskA.id, { minutes: 25, logged_date: '2026-08-02', note: '' }),
    ).toThrow('已归档项目不能记录耗时');
  });
});