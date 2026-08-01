import { describe, expect, it } from 'vitest';
import { emptyDB } from '@/lib/store/store';
import type { ClarityDB } from '@/lib/store/store';
import type { Project, TaskWithMeta } from '@/types/project';
import type { ReviewStats } from '@/types/project';
import {
  createProject,
  createTask,
  getReviewStats,
  addTaskDependency,
  setTaskBlocked,
  clearTaskBlocked,
  recordDependencyBypass,
  finishTaskFocus,
  startTaskFocus,
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
    estimate_minutes: 60,
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
    estimate_minutes: 30,
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
    estimate_minutes: 90,
  });
  return { db, project, taskA, taskB, taskC };
}

describe('review statistics', () => {
  it('separates task focus, project focus, and total by date range', () => {
    const { db, taskA } = fixtureDb();

    // Simulate focused time via TimeEntry
    db.timeEntries.push(
      { id: 'te1', task_id: taskA.id, minutes: 20, logged_date: '2026-07-27', note: '', created_at: '2026-07-27T10:00:00Z', updated_at: '2026-07-27T10:00:00Z' },
      { id: 'te2', task_id: taskA.id, minutes: 40, logged_date: '2026-07-28', note: '', created_at: '2026-07-28T10:00:00Z', updated_at: '2026-07-28T10:00:00Z' },
    );

    // Project-level time via ProjectTimeEntry
    db.projectTimeEntries.push(
      { id: 'pte1', project_id: db.projects[0].id, minutes: 30, logged_date: '2026-07-28', note: '', created_at: '2026-07-28T10:00:00Z', updated_at: '2026-07-28T10:00:00Z' },
    );

    const result = getReviewStats(db, { start: '2026-07-27', end: '2026-08-02' });
    expect(result.taskMinutes).toBe(60);
    expect(result.projectMinutes).toBe(30);
    expect(result.totalMinutes).toBe(90);
    expect(result.daily).toHaveLength(7);
    expect(result.daily.slice(0, 2)).toEqual([
      { date: '2026-07-27', taskMinutes: 20, projectMinutes: 0, totalMinutes: 20 },
      { date: '2026-07-28', taskMinutes: 40, projectMinutes: 30, totalMinutes: 70 },
    ]);
  });

  it('returns zero-filled days for empty ranges', () => {
    const { db } = fixtureDb();
    const result = getReviewStats(db, { start: '2026-07-27', end: '2026-07-29' });
    expect(result.taskMinutes).toBe(0);
    expect(result.projectMinutes).toBe(0);
    expect(result.totalMinutes).toBe(0);
    expect(result.daily).toHaveLength(3);
    expect(result.daily[0]).toEqual({ date: '2026-07-27', taskMinutes: 0, projectMinutes: 0, totalMinutes: 0 });
    expect(result.daily[2]).toEqual({ date: '2026-07-29', taskMinutes: 0, projectMinutes: 0, totalMinutes: 0 });
  });

  it('normalizes reversed ranges before aggregating review statistics', () => {
    const { db, project, taskA } = fixtureDb();
    db.timeEntries.push({
      id: 'te1',
      task_id: taskA.id,
      minutes: 20,
      logged_date: '2026-07-27',
      note: '',
      created_at: '2026-07-27T10:00:00Z',
      updated_at: '2026-07-27T10:00:00Z',
    });
    db.projectTimeEntries.push({
      id: 'pte1',
      project_id: project.id,
      minutes: 30,
      logged_date: '2026-07-28',
      note: '',
      created_at: '2026-07-28T10:00:00Z',
      updated_at: '2026-07-28T10:00:00Z',
    });

    const forward = getReviewStats(db, { start: '2026-07-27', end: '2026-07-29' });
    const reversed = getReviewStats(db, { start: '2026-07-29', end: '2026-07-27' });

    expect(reversed).toEqual(forward);
    expect(reversed.range).toEqual({ start: '2026-07-27', end: '2026-07-29' });
  });

  it('computes estimate variance and completion cycle', () => {
    const { db, taskA, taskB } = fixtureDb();

    // taskA: estimate 60min, actual 45min → variance -15
    db.timeEntries.push(
      { id: 'te0', task_id: taskA.id, minutes: 15, logged_date: '2026-07-26', note: '', created_at: '2026-07-26T10:00:00Z', updated_at: '2026-07-26T10:00:00Z' },
      { id: 'te1', task_id: taskA.id, minutes: 45, logged_date: '2026-07-28', note: '', created_at: '2026-07-28T10:00:00Z', updated_at: '2026-07-28T10:00:00Z' },
    );

    // Mark taskA completed with a cycle of 3 days (created ~7/26 → completed 7/28)
    const taskEntity = db.tasks.find((t) => t.id === taskA.id)!;
    taskEntity.created_at = '2026-07-25T10:00:00Z';
    taskEntity.status = 'completed';
    taskEntity.completed_at = '2026-07-28T10:30:00Z';

    // taskB: estimate 30min, actual 0, not completed
    // taskB.completed_at is null → not counted in completedCount

    const result = getReviewStats(db, { start: '2026-07-27', end: '2026-08-02' });
    expect(result.estimateMinutes).toBe(60); // only taskA's estimate (completed)
    expect(result.actualTaskMinutes).toBe(60); // all taskA time supports its total estimate
    expect(result.estimateVarianceMinutes).toBe(0); // 60 - 60
    expect(result.completedCount).toBe(1);
    // 3 days 30 min = 3*24*60 + 30 = 4350 min
    expect(result.averageCompletionCycleMinutes).toBe(4350);
  });

  it('uses local calendar dates for ISO timestamp evidence', () => {
    const { db, taskA } = fixtureDb();
    const task = db.tasks.find((candidate) => candidate.id === taskA.id)!;
    task.due_date = '2026-07-27';
    task.status = 'completed';
    task.completed_at = '2026-07-27T23:30:00-02:00';

    const result = getReviewStats(db, { start: '2026-07-28', end: '2026-07-28' });

    expect(result.completedCount).toBe(1);
    expect(result.overdueTasks.map((item) => item.id)).toEqual([taskA.id]);
  });

  it('scopes overdue tasks to their evidence within the selected range', () => {
    const { db, taskA, taskB, taskC } = fixtureDb();

    const openInRange = db.tasks.find((task) => task.id === taskA.id)!;
    openInRange.due_date = '2026-07-27';

    const openBeforeRange = db.tasks.find((task) => task.id === taskB.id)!;
    openBeforeRange.due_date = '2026-07-26';

    const completedLateInRange = db.tasks.find((task) => task.id === taskC.id)!;
    completedLateInRange.due_date = '2026-07-27';
    completedLateInRange.status = 'completed';
    completedLateInRange.completed_at = '2026-07-28T10:00:00Z';

    const completedLateBeforeRange = createTask(db, {
      project_id: db.projects[0].id,
      title: '范围外完成的逾期任务',
      description: '',
      status: 'completed',
      priority: 'medium',
      due_date: '2026-07-20',
      start_date: null,
      target_minutes: 25,
      estimate_minutes: 30,
    });
    db.tasks.find((task) => task.id === completedLateBeforeRange.id)!.completed_at = '2026-07-26T10:00:00Z';

    const result = getReviewStats(db, { start: '2026-07-27', end: '2026-07-29' });

    expect(result.overdueTasks.map((task) => task.id)).toEqual(
      expect.arrayContaining([taskA.id, taskC.id]),
    );
    expect(result.overdueTasks.map((task) => task.id)).not.toEqual(
      expect.arrayContaining([taskB.id, completedLateBeforeRange.id]),
    );
    expect(result.overdueCount).toBe(2);
  });

  it('counts overdue tasks', () => {
    const { db, taskA, taskB } = fixtureDb();

    // taskA: due_date before range end, not completed → overdue
    db.tasks.find((t) => t.id === taskA.id)!.due_date = '2026-07-25';
    db.tasks.find((t) => t.id === taskA.id)!.status = 'todo';

    // taskB: completed after its deadline → overdue
    db.tasks.find((t) => t.id === taskB.id)!.due_date = '2026-07-20';
    db.tasks.find((t) => t.id === taskB.id)!.status = 'completed';
    db.tasks.find((t) => t.id === taskB.id)!.completed_at = '2026-07-28T10:00:00Z';

    const result = getReviewStats(db, { start: '2026-07-27', end: '2026-08-02' });
    expect(result.overdueCount).toBe(1);
    expect(result.overdueTasks).toHaveLength(1);
    expect(result.overdueTasks.map((task) => task.id)).toEqual([taskB.id]);
  });

  it('counts only blockers evidenced within the selected range', () => {
    const { db, taskA, taskB, taskC } = fixtureDb();

    setTaskBlocked(db, taskA.id, '等待反馈');
    db.tasks.find((task) => task.id === taskA.id)!.blocked_at = '2026-07-28T09:00:00Z';
    clearTaskBlocked(db, taskA.id);

    setTaskBlocked(db, taskB.id, '未来阻塞');
    db.tasks.find((task) => task.id === taskB.id)!.blocked_at = '2026-08-03T09:00:00Z';

    const dependency = addTaskDependency(db, taskC.id, taskA.id);
    dependency.created_at = '2026-07-29T09:00:00Z';

    const result = getReviewStats(db, { start: '2026-07-27', end: '2026-08-02' });
    expect(result.blockedCount).toBe(2);
    expect(result.blockedTasks.map((task) => task.id)).toEqual(expect.arrayContaining([taskA.id, taskC.id]));
    expect(result.blockedTasks.map((task) => task.id)).not.toContain(taskB.id);
  });

  it('respects dependency mode when counting range-scoped blockers', () => {
    const { db, taskA, taskB, taskC } = fixtureDb();

    const allMode = addTaskDependency(db, taskC.id, taskA.id);
    allMode.created_at = '2026-07-28T09:00:00Z';

    const anyModeTask = createTask(db, {
      project_id: db.projects[0].id,
      title: '任一依赖即可继续',
      description: '',
      status: 'todo',
      priority: 'medium',
      due_date: null,
      start_date: null,
      target_minutes: 25,
      estimate_minutes: 30,
      dependency_mode: 'any',
    });
    const anyModeA = addTaskDependency(db, anyModeTask.id, taskA.id);
    anyModeA.created_at = '2026-07-28T09:00:00Z';
    const anyModeB = addTaskDependency(db, anyModeTask.id, taskB.id);
    anyModeB.created_at = '2026-07-28T09:00:00Z';

    db.tasks.find((task) => task.id === taskB.id)!.status = 'completed';

    const result = getReviewStats(db, { start: '2026-07-27', end: '2026-07-29' });

    expect(result.blockedTasks.map((task) => task.id)).toContain(taskC.id);
    expect(result.blockedTasks.map((task) => task.id)).not.toContain(anyModeTask.id);
  });

  it('includes only bypasses recorded in the selected range', () => {
    const { db, taskA, taskB } = fixtureDb();

    addTaskDependency(db, taskB.id, taskA.id);
    const inRange = recordDependencyBypass(db, taskB.id, [taskA.id], '先处理');
    inRange.created_at = '2026-07-28T09:00:00Z';
    const outsideRange = recordDependencyBypass(db, taskB.id, [taskA.id], '历史例外');
    outsideRange.created_at = '2026-07-20T09:00:00Z';

    const result = getReviewStats(db, { start: '2026-07-27', end: '2026-08-02' });
    expect(result.bypasses).toHaveLength(1);
    expect(result.bypasses[0].reason).toBe('先处理');
  });

  it('aggregates project rows correctly', () => {
    const { db, project, taskA, taskB } = fixtureDb();

    db.timeEntries.push(
      { id: 'te1', task_id: taskA.id, minutes: 30, logged_date: '2026-07-28', note: '', created_at: '2026-07-28T10:00:00Z', updated_at: '2026-07-28T10:00:00Z' },
    );
    db.projectTimeEntries.push(
      { id: 'pte1', project_id: project.id, minutes: 20, logged_date: '2026-07-28', note: '', created_at: '2026-07-28T10:00:00Z', updated_at: '2026-07-28T10:00:00Z' },
    );

    const result = getReviewStats(db, { start: '2026-07-27', end: '2026-08-02' });
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].projectId).toBe(project.id);
    expect(result.projects[0].projectName).toBe('测试项目');
    expect(result.projects[0].taskMinutes).toBe(30);
    expect(result.projects[0].projectMinutes).toBe(20);
    expect(result.projects[0].totalMinutes).toBe(50);
  });
});