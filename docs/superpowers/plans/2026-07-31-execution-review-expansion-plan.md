# Clarity 执行复盘扩展 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Clarity 增加同项目任务依赖、外部阻塞、依赖绕过、完整专注状态流转，以及今日台内的范围化执行复盘和投入可视化。

**Architecture:** 继续使用现有静态导出 + localStorage + `useSyncExternalStore` 架构。依赖判断、阻塞判断、计时状态流转和统计聚合全部放在纯客户端仓库函数中，组件只负责展示和调用；新增实体进入 `ClarityDB`，旧 localStorage/JSON 数据通过统一归一化函数兼容。今日台复盘使用一列纵向结构，趋势图和项目排行使用独立的无第三方图表依赖组件，并提供表格数据视图。

**Tech Stack:** Next.js App Router 16, React 19, TypeScript, localStorage, Vitest 4, CSS, static export.

---

## 文件地图

### 数据与领域层

- Modify `src/types/project.ts`: 增加 `TaskDependency`、`DependencyBypass`、任务执行字段、复盘统计类型。
- Modify `src/lib/store/store.ts`: 扩展 `ClarityDB`，为旧本地数据补齐依赖表和任务字段。
- Modify `src/lib/project/validation.ts`: 校验预计总时长、阻塞原因、依赖模式和依赖选择输入。
- Modify `src/lib/store/repository.ts`: 实现依赖图、阻塞、绕过记录、状态计时流程和复盘聚合。
- Modify `src/lib/store/useStore.ts`: 保持现有 mutate/订阅机制；只有在复盘范围状态需要跨组件共享时才增加最小的 selector helper。

### UI 层

- Modify `src/components/project/ProjectBoard.tsx`: 任务卡状态、依赖进度、阻塞提示、直接开始/暂停/提前结束入口，以及任务详情入口。
- Modify `src/components/project/CountdownTimer.tsx`: 增加提前结束动作，统一调用完成计时仓库函数。
- Create `src/components/project/TaskExecutionSection.tsx`: 任务详情中的依赖、依赖模式、外部阻塞和依赖例外管理，避免继续膨胀 `ProjectBoard.tsx`。
- Modify `src/components/project/TodayDesk.tsx`: 保留行动台，增加复盘范围、摘要、详情区和图表组件组合。
- Create `src/components/dashboard/ReviewRangePicker.tsx`: 今天/本周/本月/自定义范围控制。
- Create `src/components/dashboard/ReviewSummary.tsx`: 任务专注、项目专注、总投入、完成、逾期、阻塞指标。
- Create `src/components/dashboard/FocusTrendChart.tsx`: 每日任务/项目投入柱状图和总投入折线，带 tooltip 与表格视图。
- Create `src/components/dashboard/ProjectFocusRanking.tsx`: 项目投入横向排行，带任务投入/项目投入/总投入明细。
- Create `src/components/dashboard/ReviewDetails.tsx`: 预计/实际偏差、完成周期、逾期、阻塞、依赖绕过详情。
- Modify `src/app/globals.css`: 依赖/阻塞徽标、执行条件区、复盘区、图表和响应式默认展开样式。

### 测试层

- Modify `src/__tests__/project/validation.test.ts`: 增加预计时长和阻塞输入校验。
- Modify `src/__tests__/project/repository.test.ts`: 增加依赖图、状态流转、统计聚合和兼容性测试。
- Create `src/__tests__/dashboard/review.test.ts`: 增加范围、趋势、排行和偏差聚合测试。
- Create `tmp`-free Playwright smoke script only during verification; remove it after use.

---

## Task 1: Extend domain types and local data normalization

**Files:**
- Modify `src/types/project.ts`
- Modify `src/lib/store/store.ts`
- Modify `src/lib/project/validation.ts`
- Test `src/__tests__/project/validation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Add tests for the new task fields:

```ts
it('parses estimate and dependency defaults', () => {
  const task = parseTaskInput({ project_id: 'p1', title: '写首页' });
  expect(task).toMatchObject({
    estimate_minutes: 25,
    dependency_mode: 'all',
    is_blocked: false,
    blocked_reason: null,
  });
});

it('rejects invalid estimate and dependency mode', () => {
  expect(() => parseTaskInput({
    project_id: 'p1',
    title: '写首页',
    estimate_minutes: 0,
  })).toThrow('预计时长需为 1–600 的整数分钟');
  expect(() => parseTaskInput({
    project_id: 'p1',
    title: '写首页',
    dependency_mode: 'sometimes',
  })).toThrow('依赖模式不支持');
});
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run:

```bash
npx vitest run --pool=forks --maxWorkers=1 src/__tests__/project/validation.test.ts
```

Expected: FAIL because `parseTaskInput` does not yet return `estimate_minutes`, `dependency_mode`, `is_blocked`, or `blocked_reason`.

- [ ] **Step 3: Add the domain types and ClarityDB tables**

In `src/types/project.ts`, add:

```ts
export type DependencyMode = 'all' | 'any';

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
}

export interface DependencyBypass {
  id: string;
  task_id: string;
  dependency_ids: string[];
  reason: string;
  created_at: string;
}
```

Extend `Task` with:

```ts
estimate_minutes: number;
dependency_mode: DependencyMode;
is_blocked: boolean;
blocked_reason: string | null;
blocked_at: string | null;
```

Extend `ClarityDB` with `taskDependencies` and `dependencyBypasses`, and extend backup payload with optional versions of both arrays for old exports.

- [ ] **Step 4: Normalize old localStorage and imported records**

In `src/lib/store/store.ts`, return empty arrays for missing `taskDependencies` and `dependencyBypasses`, and extend `normalizeTasks()` with:

```ts
estimate_minutes: validInteger(t.estimate_minutes, 25, 1, 600),
dependency_mode: t.dependency_mode === 'any' ? 'any' : 'all',
is_blocked: t.is_blocked === true,
blocked_reason: typeof t.blocked_reason === 'string' ? t.blocked_reason : null,
blocked_at: t.blocked_at ?? null,
```

Use the same defaults in `importBackup()` in `src/lib/store/repository.ts`; do not trust imported values without bounds checking.

- [ ] **Step 5: Extend task validation**

In `src/lib/project/validation.ts`, accept optional `estimate_minutes`, `dependency_mode`, `is_blocked`, and `blocked_reason`. Validate estimates as integer 1–600, dependency mode as `all | any`, and blocked reason as trimmed text 1–200 characters when supplied. Creation defaults must be `estimate_minutes: 25`, `dependency_mode: 'all'`, `is_blocked: false`, and `blocked_reason: null`.

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
npx vitest run --pool=forks --maxWorkers=1 src/__tests__/project/validation.test.ts
npx tsc --noEmit
```

Expected: all validation tests pass and TypeScript reports no errors.

- [ ] **Step 7: Commit the domain migration**

```bash
git add src/types/project.ts src/lib/store/store.ts src/lib/project/validation.ts src/__tests__/project/validation.test.ts src/lib/store/repository.ts
git commit -m "feat: add execution review domain fields"
```

---

## Task 2: Implement dependency graph and external blocking repository logic

**Files:**
- Modify `src/lib/store/repository.ts`
- Modify `src/lib/store/store.ts` only if helper normalization needs extraction
- Test `src/__tests__/project/repository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Add tests covering the complete graph contract:

```ts
it('accepts same-project dependencies and rejects cross-project, self, and cycles', () => {
  const db = fixtureDbWithProjectsAndTasks();
  const first = addTaskDependency(db, 'task-b', 'task-a');
  expect(first.task_id).toBe('task-b');
  expect(() => addTaskDependency(db, 'task-b', 'task-b')).toThrow('不能依赖自己');
  expect(() => addTaskDependency(db, 'task-c', 'task-a')).toThrow('只能依赖同一项目');
  expect(() => addTaskDependency(db, 'task-a', 'task-b')).toThrow('不能形成循环依赖');
});

it('supports all and any dependency readiness', () => {
  const db = fixtureDbWithProjectsAndTasks();
  addTaskDependency(db, 'task-c', 'task-a');
  addTaskDependency(db, 'task-c', 'task-b');
  expect(canTaskStart(db, 'task-c').ready).toBe(false);
  db.tasks.find((task) => task.id === 'task-c')!.dependency_mode = 'any';
  db.tasks.find((task) => task.id === 'task-a')!.status = 'completed';
  expect(canTaskStart(db, 'task-c').ready).toBe(true);
});

it('records and clears external blocking', () => {
  const db = fixtureDbWithProjectsAndTasks();
  setTaskBlocked(db, 'task-a', '等待客户确认');
  expect(getTaskBlockers(db, 'task-a').externalReason).toBe('等待客户确认');
  clearTaskBlocked(db, 'task-a');
  expect(getTaskBlockers(db, 'task-a').externalReason).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail for missing repository functions**

Run:

```bash
npx vitest run --pool=forks --maxWorkers=1 src/__tests__/project/repository.test.ts
```

Expected: FAIL with missing exports such as `addTaskDependency` and `canTaskStart`.

- [ ] **Step 3: Implement dependency CRUD and graph validation**

Add repository functions:

```ts
export function listTaskDependencies(db: ClarityDB, taskId: string): TaskDependency[];
export function addTaskDependency(db: ClarityDB, taskId: string, dependsOnTaskId: string): TaskDependency;
export function removeTaskDependency(db: ClarityDB, dependencyId: string): void;
```

`addTaskDependency` must verify both tasks exist, belong to the same project, are not identical, and that a DFS from `dependsOnTaskId` cannot reach `taskId` through existing dependency edges. Reject duplicate edges. `removeTaskDependency` must reject unknown IDs and touch the owning project timestamp.

- [ ] **Step 4: Implement readiness and blocker reporting**

Use a stable return type:

```ts
type TaskBlockers = {
  ready: boolean;
  dependencyIds: string[];
  unfinishedDependencyIds: string[];
  externalReason: string | null;
  labels: string[];
};
```

`getTaskBlockers` calculates unfinished dependencies from current task status and includes the external block reason. `canTaskStart` returns the same readiness information without mutating data. A completed dependency counts as satisfied; archived dependencies remain unfinished unless completed.

- [ ] **Step 5: Implement external blocking and bypass recording**

Add:

```ts
export function setTaskBlocked(db: ClarityDB, taskId: string, reason: string): void;
export function clearTaskBlocked(db: ClarityDB, taskId: string): void;
export function listDependencyBypasses(db: ClarityDB, taskId: string): DependencyBypass[];
export function recordDependencyBypass(
  db: ClarityDB,
  taskId: string,
  dependencyIds: string[],
  reason: string,
): DependencyBypass;
```

Validate reason length in the repository as defense in depth. `setTaskBlocked` sets `is_blocked`, `blocked_reason`, and `blocked_at`; clearing keeps historical bypass records but clears current blocking fields.

- [ ] **Step 6: Clean dependencies when deleting tasks and import/export**

Update `deleteTask` to remove edges where either endpoint is the deleted task and remove bypass records for the deleted task. Update backup export/import counts and normalization for both new arrays.

- [ ] **Step 7: Run repository tests, typecheck, and commit**

```bash
npx vitest run --pool=forks --maxWorkers=1 src/__tests__/project/repository.test.ts
npx tsc --noEmit
git add src/lib/store/repository.ts src/lib/store/store.ts src/types/project.ts src/__tests__/project/repository.test.ts
git commit -m "feat: add task dependency and blocking rules"
```

Expected: repository tests pass and no type errors remain.

---

## Task 3: Unify task focus state transitions and task-card controls

**Files:**
- Modify `src/lib/store/repository.ts`
- Modify `src/components/project/CountdownTimer.tsx`
- Modify `src/components/project/ProjectBoard.tsx`
- Test `src/__tests__/project/repository.test.ts`

- [ ] **Step 1: Write failing timer/state tests**

Add tests:

```ts
it('starts focus by moving a todo task to in_progress', () => {
  const db = fixtureDbWithProjectsAndTasks();
  startTaskFocus(db, 'task-a');
  expect(db.tasks.find((task) => task.id === 'task-a')!.status).toBe('in_progress');
  expect(db.tasks.find((task) => task.id === 'task-a')!.started_at).not.toBeNull();
});

it('finishes a task early by saving focus and marking it completed', () => {
  const db = fixtureDbWithProjectsAndTasks();
  const task = db.tasks.find((item) => item.id === 'task-a')!;
  task.elapsed_seconds = 90;
  finishTaskFocus(db, 'task-a', '提前结束');
  expect(task.status).toBe('completed');
  expect(task.started_at).toBeNull();
  expect(db.timeEntries.at(-1)?.task_id).toBe('task-a');
});

it('refuses ordinary start while blocked but allows an explicit bypass', () => {
  const db = fixtureDbWithProjectsAndTasks();
  setTaskBlocked(db, 'task-a', '等待反馈');
  expect(() => startTaskFocus(db, 'task-a')).toThrow('任务当前被阻塞');
  startTaskFocus(db, 'task-a', { bypass: true, reason: '先处理可独立部分' });
  expect(db.tasks.find((task) => task.id === 'task-a')!.status).toBe('in_progress');
  expect(db.dependencyBypasses).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests to verify missing transition functions**

Run:

```bash
npx vitest run --pool=forks --maxWorkers=1 src/__tests__/project/repository.test.ts
```

Expected: FAIL because `startTaskFocus` and `finishTaskFocus` do not exist.

- [ ] **Step 3: Implement `startTaskFocus` and `finishTaskFocus`**

Add repository functions:

```ts
export function startTaskFocus(
  db: ClarityDB,
  taskId: string,
  options: { bypass?: boolean; reason?: string } = {},
): void;

export function finishTaskFocus(
  db: ClarityDB,
  taskId: string,
  note?: string,
): TimeEntry | null;
```

`startTaskFocus` checks completed/archived state, calls `getTaskBlockers`, requires `bypass: true` when not ready, records the bypass, sets status to `in_progress`, and starts the timer. `finishTaskFocus` calls the existing stop/entry logic, then sets status to `completed` and `completed_at`; zero-time completion must still clear running state without creating a fake minute entry.

Update `startTimer` to remain a low-level primitive but make all UI start actions call `startTaskFocus`. Update `finishTimer` to call `finishTaskFocus` so countdown-zero and early-finish behavior share one path.

- [ ] **Step 4: Update task card buttons**

In `ProjectBoard.tsx`, replace direct `startTimer`/`pauseTimer` usage in `toggleTaskTimer` with `startTaskFocus` and blocker handling:

- ready task: start immediately;
- blocked task: show blocker text in a confirmation dialog, then call `startTaskFocus(..., { bypass: true, reason })` only after confirmation;
- running task: pause without changing `in_progress`;
- completed task: render no start button.

Keep task status badge and timer chip synchronized from the store.

- [ ] **Step 5: Add early-finish button to `CountdownTimer`**

Replace “停止并保存” as the completion action with “提前结束”. Keep “暂停” separate. On confirmation call `finishTaskFocus` and show the completed read-only state after the store update. The countdown-zero effect must call the same finish function and chime once.

- [ ] **Step 6: Run timer tests and typecheck**

```bash
npx vitest run --pool=forks --maxWorkers=1 src/__tests__/project/repository.test.ts
npx tsc --noEmit
```

- [ ] **Step 7: Commit the task execution flow**

```bash
git add src/lib/store/repository.ts src/components/project/CountdownTimer.tsx src/components/project/ProjectBoard.tsx src/__tests__/project/repository.test.ts
git commit -m "feat: connect focus timer to task execution state"
```

---

## Task 4: Build review-range statistics and aggregation tests

**Files:**
- Modify `src/types/project.ts`
- Modify `src/lib/store/repository.ts`
- Create `src/__tests__/dashboard/review.test.ts`

- [ ] **Step 1: Write failing aggregation tests**

Create a fixture with task entries and project entries on different dates, then assert:

```ts
it('separates task focus, project focus, and total by date range', () => {
  const result = getReviewStats(db, { start: '2026-07-27', end: '2026-08-02' });
  expect(result.taskMinutes).toBe(60);
  expect(result.projectMinutes).toBe(30);
  expect(result.totalMinutes).toBe(90);
  expect(result.daily).toEqual([
    { date: '2026-07-27', taskMinutes: 20, projectMinutes: 0, totalMinutes: 20 },
    { date: '2026-07-28', taskMinutes: 40, projectMinutes: 30, totalMinutes: 70 },
  ]);
});

it('computes estimate variance and completion cycle', () => {
  const result = getReviewStats(db, { start: '2026-07-27', end: '2026-08-02' });
  expect(result.estimateVarianceMinutes).toBe(30);
  expect(result.completedCount).toBe(1);
  expect(result.averageCompletionCycleMinutes).toBe(180);
});
```

- [ ] **Step 2: Run the new tests and verify expected missing export failure**

```bash
npx vitest run --pool=forks --maxWorkers=1 src/__tests__/dashboard/review.test.ts
```

Expected: FAIL because `getReviewStats` is not defined.

- [ ] **Step 3: Define review result types**

Add to `src/types/project.ts`:

```ts
export interface ReviewRange { start: string; end: string; }
export interface DailyReviewPoint {
  date: string;
  taskMinutes: number;
  projectMinutes: number;
  totalMinutes: number;
}
export interface ProjectReviewRow {
  projectId: string;
  projectName: string;
  color: ProjectColor;
  taskMinutes: number;
  projectMinutes: number;
  totalMinutes: number;
}
export interface ReviewStats {
  range: ReviewRange;
  taskMinutes: number;
  projectMinutes: number;
  totalMinutes: number;
  completedCount: number;
  overdueCount: number;
  blockedCount: number;
  estimateMinutes: number;
  actualTaskMinutes: number;
  estimateVarianceMinutes: number;
  averageCompletionCycleMinutes: number;
  daily: DailyReviewPoint[];
  projects: ProjectReviewRow[];
  overdueTasks: TaskWithMeta[];
  blockedTasks: TaskWithMeta[];
  bypasses: DependencyBypass[];
}
```

- [ ] **Step 4: Implement `getReviewStats`**

Add a pure repository function that normalizes inclusive date ranges, aggregates `TimeEntry` and `ProjectTimeEntry` separately, fills every day in the range with zeroes, calculates project rows, completed cycles, variance, overdue tasks, blocker tasks, and bypasses. Use local date strings for entries and ISO date prefixes for task created/completed timestamps. Do not add project entries to `weekMinutes`; preserve the existing TodayDesk metric contract.

- [ ] **Step 5: Run aggregation tests and typecheck**

```bash
npx vitest run --pool=forks --maxWorkers=1 src/__tests__/dashboard/review.test.ts
npx tsc --noEmit
```

- [ ] **Step 6: Commit the review aggregation**

```bash
git add src/types/project.ts src/lib/store/repository.ts src/__tests__/dashboard/review.test.ts
 git commit -m "feat: add execution review statistics"
```

---

## Task 5: Add TodayDesk review controls and summary/details components

**Files:**
- Modify `src/components/project/TodayDesk.tsx`
- Create `src/components/dashboard/ReviewRangePicker.tsx`
- Create `src/components/dashboard/ReviewSummary.tsx`
- Create `src/components/dashboard/ReviewDetails.tsx`
- Modify `src/app/globals.css`

- [ ] **Step 1: Write component contract tests or DOM smoke assertions**

Add a focused test or browser assertion that for a populated database:

```ts
expect(page.getByRole('region', { name: '执行复盘' })).toBeVisible();
expect(page.getByRole('button', { name: '本周' })).toHaveAttribute('aria-pressed', 'true');
expect(page.getByText('任务专注')).toBeVisible();
expect(page.getByText('项目整体专注')).toBeVisible();
```

- [ ] **Step 2: Implement `ReviewRangePicker`**

Keep range state local to `TodayDesk`; expose `value` and `onChange`. Render `今天`、`本周`、`本月` segmented buttons plus two date inputs when `自定义` is selected. Normalize start/end so end cannot precede start. Store only the selected preset and custom dates in localStorage under `clarity-review-range`.

- [ ] **Step 3: Implement summary cards**

`ReviewSummary` receives `ReviewStats` and renders six compact metrics in a semantic region: task focus, project focus, total focus, completed, overdue, blocked. Values use `formatMinutes`; no metric relies on color alone.

- [ ] **Step 4: Implement review details**

`ReviewDetails` renders desktop-expanded/mobile-collapsed content with a button whose `aria-expanded` state is persisted under `clarity-review-details-open`. Sections include estimate variance, completion cycle, overdue task list, blocked task list, and bypass list. Empty states must be explicit and compact.

- [ ] **Step 5: Integrate into `TodayDesk`**

Keep existing `listTodayGroups` and `getWeekStats` action-desk computation unchanged. Add `reviewRange` and `reviewStats` memoized from the live DB, mount review controls below the action desk, and ensure mutations trigger the existing `useStore` rerender.

- [ ] **Step 6: Add responsive CSS**

Add one-column review layout, compact metric grid, range controls, detail disclosure, badges for dependency/external blocking, and media rules: desktop details open by default, mobile details closed by default. Keep existing palette tokens and avoid nested cards inside cards.

- [ ] **Step 7: Run typecheck, tests, and build**

```bash
npx vitest run --pool=forks --maxWorkers=1
npx tsc --noEmit
BASE_PATH="" npm run build
```

- [ ] **Step 8: Commit TodayDesk review UI**

```bash
git add src/components/project/TodayDesk.tsx src/components/dashboard/ReviewRangePicker.tsx src/components/dashboard/ReviewSummary.tsx src/components/dashboard/ReviewDetails.tsx src/app/globals.css
git commit -m "feat: add TodayDesk execution review"
```

---

## Task 6: Add trend chart and project ranking with accessible table views

**Files:**
- Create `src/components/dashboard/FocusTrendChart.tsx`
- Create `src/components/dashboard/ProjectFocusRanking.tsx`
- Modify `src/components/project/TodayDesk.tsx`
- Modify `src/app/globals.css`
- Test `src/__tests__/dashboard/review.test.ts`

- [ ] **Step 1: Add data-shape tests for zero-filled days and stable project identity**

Assert that `getReviewStats` includes every calendar date in the selected range and that project rows retain their project color/name after sorting by total minutes.

- [ ] **Step 2: Implement `FocusTrendChart`**

Use inline SVG/HTML rather than adding a chart dependency. Render one shared y-axis, two bar series (`taskMinutes`, `projectMinutes`) and one 2px total line. Add a fixed legend, per-day hover/focus tooltip, accessible `aria-label`, and a visually available table below or behind a “查看数据表” toggle. The table must contain date, task focus, project focus, and total.

Use fixed series identity colors from existing tokens; do not assign colors by rank. Keep the chart bounded with `viewBox`, CSS aspect ratio, and overflow handling.

- [ ] **Step 3: Implement `ProjectFocusRanking`**

Render sorted horizontal rows with project color rail, project name, task minutes, project minutes, total minutes, and proportional bar width based on the maximum total. Provide a table view for screen readers and small screens. Clicking a project uses the existing `/projects/detail?id=...` route.

- [ ] **Step 4: Integrate charts into TodayDesk**

Mount the trend chart before project ranking inside the one-column review section. Keep project ranking bounded to the top 8 rows and show a “其余项目” aggregate row when more exist so the chart never creates an unbounded page.

- [ ] **Step 5: Run visual and automated checks**

```bash
npx vitest run --pool=forks --maxWorkers=1
npx tsc --noEmit
BASE_PATH="" npm run build
```

Start the static build and use Playwright to verify desktop and mobile screenshots, no chart label overlap, tooltip visibility, table toggles, and horizontal overflow absence.

- [ ] **Step 6: Validate chart palette and commit**

Run the dataviz palette validator against the final chart series colors and the light surface. Fix any contrast/CVD failure before committing:

```bash
node C:/Users/86157/AppData/Local/Temp/claude/bundled-skills/2.1.220/6f1ec53592df124b4ddbfbdb76e1448a/dataviz/scripts/validate_palette.js "#0f766e,#0284c7,#64748b" --mode light
```

Then commit:

```bash
git add src/components/dashboard/FocusTrendChart.tsx src/components/dashboard/ProjectFocusRanking.tsx src/components/project/TodayDesk.tsx src/app/globals.css src/__tests__/dashboard/review.test.ts
git commit -m "feat: add focus trends and project ranking"
```

---

## Task 7: Complete task dependency and blocking UI

**Files:**
- Create `src/components/project/TaskExecutionSection.tsx`
- Modify `src/components/project/ProjectBoard.tsx`
- Modify `src/app/globals.css`
- Test `src/__tests__/project/repository.test.ts`

- [ ] **Step 1: Add repository-backed UI interaction tests**

Verify the UI path with Playwright against the static build:

```py
page.get_by_role('button', name='新建任务').click()
page.get_by_label('标题').fill('后置任务')
page.get_by_label('预计总时长').fill('90')
page.get_by_role('button', name='创建任务').click()
page.locator('.pb-title').filter(has_text='后置任务').click()
assert page.get_by_text('执行条件').count() == 1
```

- [ ] **Step 2: Implement `TaskExecutionSection`**

Accept `task`, `projectId`, and `readOnly` props. Render same-project candidates excluding the current task and already-selected dependencies; add/remove controls; `all/any` selector; dependency progress; external block reason input; block/clear buttons; bypass history. Call `mutate` only through repository functions and surface thrown errors in the section.

- [ ] **Step 3: Integrate section in TaskDrawer**

Remove dependency-related state from `ProjectBoard.tsx`, render the new section after the task description and before subtasks, and pass the live task so dependency status refreshes after every mutation. Keep task timer and “提前结束” visible in the drawer.

- [ ] **Step 4: Add blocker badges and start confirmation**

Use `getTaskBlockers` in task cards. Show dependency progress and external blocker badge. `toggleTaskTimer` should ask for confirmation when blocked and record a bypass reason; when unblocked it starts immediately. Completed cards never show the focus control.

- [ ] **Step 5: Run browser smoke flow**

Verify:

1. Create two tasks in one project.
2. Open the second task, add the first as a dependency.
3. Attempt to start the second task and confirm it is blocked.
4. Choose “仍然开始”; verify it enters `in_progress` and records a bypass.
5. Pause, click “提前结束”, verify task enters completed and a task time entry exists.
6. Verify TodayDesk task focus changes while project focus remains separate.

- [ ] **Step 6: Run checks and commit**

```bash
npx vitest run --pool=forks --maxWorkers=1
npx tsc --noEmit
BASE_PATH="" npm run build
git add src/components/project/TaskExecutionSection.tsx src/components/project/ProjectBoard.tsx src/app/globals.css src/__tests__/project/repository.test.ts
git commit -m "feat: add task execution conditions"
```

---

## Task 8: Final responsive polish, review, and release verification

**Files:**
- Modify `src/app/globals.css`
- Modify affected dashboard/project components only when visual review identifies a concrete issue
- Create temporary Playwright smoke script outside the repository or remove it before commit

- [ ] **Step 1: Run the full verification suite**

```bash
npx vitest run --pool=forks --maxWorkers=1
npx tsc --noEmit
BASE_PATH="" npm run build
git diff --check
```

Expected: all tests pass, build completes with every route statically generated, and diff check has no errors.

- [ ] **Step 2: Run the static site and browser verification**

Start:

```bash
npx serve out -l 3001
```

Verify desktop (1440x1100) and mobile (390x844):

- action desk remains first;
- review range changes all metrics;
- desktop details start open and mobile details start closed;
- chart tooltips and table views work;
- project ranking links open the existing detail route;
- dependency and blocker labels do not overflow;
- task start, pause, bypass, early finish, and automatic completion update columns;
- no horizontal scrolling or clipped buttons.

- [ ] **Step 3: Run an Impeccable audit on the changed UI**

Use the `impeccable` plugin audit against the changed dashboard/project UI. Fix only concrete findings related to hierarchy, spacing, contrast, responsive overflow, or interaction clarity. Re-run typecheck/build after any fix.

- [ ] **Step 4: Review the final diff against the design spec**

Confirm every approved rule has a corresponding implementation or test:

- same-project dependency only;
- all/any readiness;
- external blocking;
- explicit bypass record;
- task/project focus separation;
- review range and chart/table parity;
- desktop/mobile disclosure behavior;
- old data and backup compatibility.

- [ ] **Step 5: Commit final polish and push only after user approval**

```bash
git status --short
git diff --check
git add src/app/globals.css src/components/dashboard/ReviewRangePicker.tsx src/components/dashboard/ReviewSummary.tsx src/components/dashboard/ReviewDetails.tsx src/components/dashboard/FocusTrendChart.tsx src/components/dashboard/ProjectFocusRanking.tsx src/components/project/ProjectBoard.tsx src/components/project/CountdownTimer.tsx src/components/project/TaskExecutionSection.tsx
git commit -m "feat: complete execution review expansion"
git push origin master
```

Do not push an intermediate stage unless the user explicitly asks for incremental deployment.
