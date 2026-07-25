# Health Status System Repositioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition Clarity from a manifestation/reflection product into a personal **health & status** management system: sleep / exercise / energy as primary metrics, health-first navigation and copy, resume-demoable end-to-end flow.

**Architecture:** Keep existing `life_logs` storage, API, and dashboard shell. Change the **aggregation contract** so primary metrics are sleep + exercise + energy (mood), with completion = coverage of those three types. Update types, pure aggregate functions (TDD), then wire UI (home, nav, trend, achievements, quick log, log page) and health-oriented insight fallback copy. Do not delete manifestation routes; remove them from primary navigation only.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, existing SQLite/local life-log helpers, optional AI insight route.

**Spec:** `docs/superpowers/specs/2026-07-25-health-status-system-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `src/types/life.ts` | Dashboard types: `exerciseMinutes` / `exerciseHours` replace focus-primary fields |
| `src/lib/life/aggregate.ts` | Pure summary: exercise sum, completion over sleep/exercise/mood |
| `src/__tests__/life/aggregate.test.ts` | Aggregation contract tests |
| `src/lib/ai/life-insight.ts` | Health-oriented fallback insight + input serialization of exercise fields |
| `src/__tests__/ai/life-insight.test.ts` | Insight tests stay green with new summary shape |
| `src/components/dashboard/DashboardShell.tsx` | Brand + primary nav (no focus/manifest/reflect) |
| `src/app/(app)/page.tsx` | Home metrics: sleep / exercise / energy / completion |
| `src/components/dashboard/TrendChart.tsx` | 7-day **exercise** trend (not focus) |
| `src/components/dashboard/AchievementCard.tsx` | Exercise hours instead of focus hours |
| `src/components/dashboard/QuickLogSheet.tsx` | Health-first types; default sleep or exercise |
| `src/app/(app)/log/page.tsx` | Primary forms: sleep, exercise, mood |
| `src/app/(app)/exercise/page.tsx` | New exercise module page (replace focus in nav) |
| `src/app/(app)/sleep/page.tsx` | Health-framed sleep copy |
| `src/app/(app)/insights/page.tsx` | Health insight framing |
| `package.json` | Product description → 健康与状态 |

**Out of scope for this plan (P1+):** exercise kind metadata UI, habit streaks, CSV export, deleting old manifest code, full README rewrite beyond description if time-boxed.

---

### Task 1: Change dashboard type contract to exercise-primary

**Files:**
- Modify: `src/types/life.ts`
- Test: `src/__tests__/life/aggregate.test.ts` (will fail until Task 2)

- [ ] **Step 1: Update shared types**

Replace focus-primary metric fields with exercise-primary ones. Keep `LifeLogType` including `focus` and `manifest` for storage compatibility.

```ts
export type LifeLogType = 'sleep' | 'focus' | 'mood' | 'exercise' | 'journal' | 'manifest';
export type LifeLogUnit = 'minutes' | 'hours' | 'score';

export interface LifeLog {
  id: string;
  user_id: string;
  entry_date: string;
  type: LifeLogType;
  start_at: string | null;
  end_at: string | null;
  value: number | null;
  unit: LifeLogUnit | null;
  content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DailyTrendPoint {
  date: string;
  label: string;
  sleepHours: number | null;
  exerciseMinutes: number | null;
  energy: number | null;
  recorded: number;
}

export interface TodayMetrics {
  sleepHours: number | null;
  exerciseMinutes: number | null;
  energy: number | null;
  completionRate: number;
}

export interface AchievementSummary {
  recordingStreak: number;
  exerciseHours: number;
  recordedDays: number;
}

export interface DashboardSummary {
  today: TodayMetrics;
  trend: DailyTrendPoint[];
  achievements: AchievementSummary;
  coverageDays: number;
}

/** Types that count toward daily health completion. */
export const HEALTH_COMPLETION_TYPES: readonly LifeLogType[] = ['sleep', 'exercise', 'mood'];
```

- [ ] **Step 2: Commit types**

```bash
git add src/types/life.ts
git commit -m "refactor(life): make exercise a primary dashboard metric type"
```

---

### Task 2: TDD aggregation for health metrics

**Files:**
- Modify: `src/lib/life/aggregate.ts`
- Modify: `src/__tests__/life/aggregate.test.ts`

- [ ] **Step 1: Rewrite failing tests for the new contract**

Replace `src/__tests__/life/aggregate.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { buildDashboardSummary } from '@/lib/life/aggregate';
import type { LifeLog } from '@/types/life';

const log = (overrides: Partial<LifeLog>): LifeLog => ({
  id: crypto.randomUUID(),
  user_id: 'u',
  entry_date: '2026-07-18',
  type: 'exercise',
  start_at: null,
  end_at: null,
  value: 45,
  unit: 'minutes',
  content: null,
  metadata: {},
  created_at: '2026-07-18T09:00:00Z',
  ...overrides,
});

describe('buildDashboardSummary (health)', () => {
  it('aggregates sleep average, exercise sum, latest energy, and 3-type completion', () => {
    const result = buildDashboardSummary(
      [
        log({ entry_date: '2026-07-17', type: 'mood', value: 3, unit: 'score' }),
        log({ entry_date: '2026-07-18', type: 'exercise', value: 45, unit: 'minutes' }),
        log({ entry_date: '2026-07-18', type: 'exercise', value: 15, unit: 'minutes' }),
        log({ entry_date: '2026-07-18', type: 'sleep', value: 7, unit: 'hours' }),
        log({ entry_date: '2026-07-18', type: 'mood', value: 4, unit: 'score', created_at: '2026-07-18T08:00:00Z' }),
        log({ entry_date: '2026-07-18', type: 'mood', value: 5, unit: 'score', created_at: '2026-07-18T20:00:00Z' }),
        log({ entry_date: '2026-07-18', type: 'focus', value: 90, unit: 'minutes' }),
      ],
      '2026-07-18',
    );

    expect(result.today.sleepHours).toBe(7);
    expect(result.today.exerciseMinutes).toBe(60);
    expect(result.today.energy).toBe(5);
    // sleep + exercise + mood present → 3/3
    expect(result.today.completionRate).toBe(1);
    // focus must NOT inflate primary exercise metric
    expect(result.today.exerciseMinutes).not.toBe(150);
    expect(result.achievements.recordingStreak).toBe(2);
    expect(result.achievements.exerciseHours).toBe(1); // 60 min today only in 7d window for this fixture's exercise days
  });

  it('completion ignores non-critical types and focus-only days', () => {
    const result = buildDashboardSummary(
      [log({ type: 'focus', value: 100, unit: 'minutes' }), log({ type: 'journal', value: null, unit: null, content: 'x' })],
      '2026-07-18',
    );
    expect(result.today.completionRate).toBe(0);
    expect(result.today.exerciseMinutes).toBeNull();
  });

  it('returns seven points and empty values without data', () => {
    const result = buildDashboardSummary([], '2026-07-18');
    expect(result.trend).toHaveLength(7);
    expect(result.today.exerciseMinutes).toBeNull();
    expect(result.today.sleepHours).toBeNull();
    expect(result.today.energy).toBeNull();
    expect(result.today.completionRate).toBe(0);
    expect(result.achievements.exerciseHours).toBe(0);
  });
});
```

Note on `exerciseHours` expectation: after implementing aggregate, if the fixture only has 60 exercise minutes on 2026-07-18, `exerciseHours` should be `1`. If implementation rounds differently (`Math.round(x * 10) / 10`), keep `1`.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- src/__tests__/life/aggregate.test.ts
```

Expected: FAIL (missing `exerciseMinutes` / old `focusMinutes` behavior).

- [ ] **Step 3: Implement `buildDashboardSummary`**

Replace `src/lib/life/aggregate.ts` with:

```ts
import type { DashboardSummary, DailyTrendPoint, LifeLog } from '@/types/life';
import { HEALTH_COMPLETION_TYPES } from '@/types/life';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateRange(today: string, days: number): string[] {
  const end = new Date(`${today}T00:00:00Z`).getTime();
  return Array.from({ length: days }, (_, index) =>
    new Date(end - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10),
  );
}

function minutes(log: LifeLog): number {
  if (log.unit === 'hours' && log.value != null) return log.value * 60;
  if (log.value != null) return log.value;
  if (log.start_at && log.end_at) {
    return Math.max(0, (Date.parse(log.end_at) - Date.parse(log.start_at)) / 60000);
  }
  return 0;
}

function sleepHoursFromLog(log: LifeLog): number {
  if (log.unit === 'minutes' && log.value != null) return log.value / 60;
  return minutes(log) / 60;
}

function healthCompletion(dayLogs: LifeLog[]): number {
  const types = new Set(dayLogs.map((log) => log.type));
  const hit = HEALTH_COMPLETION_TYPES.filter((type) => types.has(type)).length;
  return hit / HEALTH_COMPLETION_TYPES.length;
}

export function buildDashboardSummary(logs: LifeLog[], today: string): DashboardSummary {
  const dates = dateRange(today, 7);
  const trend: DailyTrendPoint[] = dates.map((date) => {
    const dayLogs = logs.filter((log) => log.entry_date === date);
    const sleeps = dayLogs.filter((log) => log.type === 'sleep').map(sleepHoursFromLog);
    const exercise = dayLogs
      .filter((log) => log.type === 'exercise')
      .reduce((sum, log) => sum + minutes(log), 0);
    const moods = dayLogs
      .filter((log) => log.type === 'mood')
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const recordedCritical = HEALTH_COMPLETION_TYPES.filter((type) =>
      dayLogs.some((log) => log.type === type),
    ).length;

    return {
      date,
      label: date.slice(5).replace('-', '/'),
      sleepHours: sleeps.length
        ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length) * 10) / 10
        : null,
      exerciseMinutes: exercise || null,
      energy: moods.length ? moods[moods.length - 1].value : null,
      recorded: recordedCritical,
    };
  });

  const current = trend[trend.length - 1];
  let streak = 0;
  for (let i = trend.length - 1; i >= 0 && trend[i].recorded > 0; i -= 1) streak += 1;

  const exerciseMinutesWeek = trend.reduce((sum, point) => sum + (point.exerciseMinutes ?? 0), 0);

  return {
    today: {
      sleepHours: current.sleepHours,
      exerciseMinutes: current.exerciseMinutes,
      energy: current.energy,
      completionRate: healthCompletion(logs.filter((log) => log.entry_date === today)),
    },
    trend,
    achievements: {
      recordingStreak: streak,
      exerciseHours: Math.round((exerciseMinutesWeek / 60) * 10) / 10,
      recordedDays: trend.filter((point) => point.recorded > 0).length,
    },
    coverageDays: trend.filter((point) => point.recorded > 0).length,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- src/__tests__/life/aggregate.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/life/aggregate.ts src/__tests__/life/aggregate.test.ts src/types/life.ts
git commit -m "feat(life): aggregate sleep, exercise, and energy for health dashboard"
```

---

### Task 3: Update AI insight helpers for exercise fields + health copy

**Files:**
- Modify: `src/lib/ai/life-insight.ts`
- Modify: `src/__tests__/ai/life-insight.test.ts`

- [ ] **Step 1: Update serialization and fallback copy**

```ts
import type { DashboardSummary } from '@/types/life';

export interface LifeInsight {
  summary: string;
  suggestions: [string, string];
  confidence: 'low' | 'medium' | 'high';
}

export function buildLifeInsightInput(summary: DashboardSummary, windowDays: number) {
  return {
    windowDays,
    coverageDays: summary.coverageDays,
    today: summary.today,
    trend: summary.trend.map(({ date, sleepHours, exerciseMinutes, energy, recorded }) => ({
      date,
      sleepHours,
      exerciseMinutes,
      energy,
      recorded,
    })),
  };
}

export function fallbackLifeInsight(summary: DashboardSummary): LifeInsight {
  if (summary.coverageDays < 3) {
    return {
      summary: '健康样本还在积累。先从睡眠或一次短运动开始记录。',
      suggestions: ['今晚记下睡眠时长', '今天完成一次 20 分钟步行或拉伸'],
      confidence: 'low',
    };
  }

  if ((summary.achievements.exerciseHours ?? 0) >= 2) {
    return {
      summary: '这周你已经为身体活动留出了可见的时间。继续保持轻量、可重复的节奏。',
      suggestions: ['固定一个最容易开始的运动时段', '睡前用 1–5 分记录今天的能量'],
      confidence: 'medium',
    };
  }

  return {
    summary: '你的健康记录正在变得清晰。下一步可以优先守住睡眠规律，并补上短时运动。',
    suggestions: ['尽量固定入睡窗口', '把运动拆成每天 15–30 分钟'],
    confidence: 'medium',
  };
}

export function parseLifeInsight(value: unknown, fallback: LifeInsight): LifeInsight {
  if (!value || typeof value !== 'object') return fallback;
  const item = value as Record<string, unknown>;
  const suggestions = item.suggestions;
  if (typeof item.summary !== 'string' || !Array.isArray(suggestions) || suggestions.length < 2) {
    return fallback;
  }
  const summary = item.summary.slice(0, 180);
  const clean = suggestions.slice(0, 2).map((suggestion) => String(suggestion).slice(0, 120)) as [
    string,
    string,
  ];
  if (/诊断|治愈|一定是|因果|处方|疾病/.test(summary + clean.join(''))) return fallback;
  return {
    summary,
    suggestions: clean,
    confidence:
      item.confidence === 'high' ? 'high' : item.confidence === 'medium' ? 'medium' : 'low',
  };
}
```

- [ ] **Step 2: Ensure insight tests still pass**

```bash
npm test -- src/__tests__/ai/life-insight.test.ts
```

Expected: PASS. If any assertion still mentions focus language, update only the assertion text, not the safety rules.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/life-insight.ts src/__tests__/ai/life-insight.test.ts
git commit -m "feat(insight): frame AI fallback around health metrics"
```

---

### Task 4: Primary navigation and brand (health shell)

**Files:**
- Modify: `src/components/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Replace nav items and brand copy**

```tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/browser';
import type { ReactNode } from 'react';

const items = [
  { href: '/', label: '今日', short: '01' },
  { href: '/log', label: '记录', short: '02' },
  { href: '/sleep', label: '睡眠', short: '03' },
  { href: '/exercise', label: '运动', short: '04' },
  { href: '/insights', label: '洞察', short: '05' },
  { href: '/timeline', label: '时间线', short: '06' },
  { href: '/history', label: '日历', short: '07' },
];

export function DashboardShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createBrowserClient().auth.signOut();
    router.push('/login');
  }

  return (
    <div className="dashboard-frame">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <span className="brand-mark">◒</span>
          <span>
            CLARITY
            <br />
            <em>健康与状态</em>
          </span>
        </div>
        <nav className="dashboard-nav" aria-label="主导航">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'active' : ''}
            >
              <span>{item.short}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="dashboard-sidebar-foot">
          <span className="status-dot" /> 数据只属于你
          <br />
          <small>{userEmail.split('@')[0]}</small>
          <button className="dashboard-signout" onClick={signOut}>
            退出登录 ↗
          </button>
        </div>
      </aside>
      <div className="dashboard-content">{children}</div>
      <nav className="dashboard-mobile-nav" aria-label="移动端导航">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? 'active' : ''}
          >
            <span>{item.short}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
```

Notes:
- `/focus`, `/manifest`, `/reflect` stay routable if bookmarked, but **not** in primary nav.
- If `/history` layout depends on a different chrome, still include it; if broken at runtime, keep the link and fix only if layout already wraps via `(app)/layout.tsx`.

- [ ] **Step 2: Manual check**

With `npm run dev`, open any app page: sidebar shows 今日/记录/睡眠/运动/洞察/时间线/日历, brand says「健康与状态」.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardShell.tsx
git commit -m "feat(nav): switch shell to health-first navigation"
```

---

### Task 5: Home dashboard metrics + trend + achievements

**Files:**
- Modify: `src/app/(app)/page.tsx`
- Modify: `src/components/dashboard/TrendChart.tsx`
- Modify: `src/components/dashboard/AchievementCard.tsx`

- [ ] **Step 1: Update home page metrics**

In `src/app/(app)/page.tsx`, change header and four cards:

```tsx
<header className="dashboard-topbar">
  <div>
    <div className="eyebrow">{today.replaceAll('-', '.')} · 个人健康与状态</div>
    <h1>今天，先照顾好身体的节奏。</h1>
  </div>
  <QuickLogSheet />
</header>
{/* ... */}
<section className="metrics-grid">
  <MetricCard
    label="昨夜睡眠"
    value={summary.today.sleepHours?.toFixed(1) ?? '—'}
    unit={summary.today.sleepHours == null ? '' : 'h'}
    hint={summary.today.sleepHours == null ? '记录后建立睡眠基线' : '你的恢复时间'}
  />
  <MetricCard
    label="今日运动"
    value={String(summary.today.exerciseMinutes ?? '—')}
    unit={summary.today.exerciseMinutes == null ? '' : 'min'}
    hint="活动比完美计划更重要"
  />
  <MetricCard
    label="当前能量"
    value={String(summary.today.energy ?? '—')}
    unit={summary.today.energy == null ? '' : '/5'}
    hint="允许状态有起伏"
  />
  <MetricCard
    label="今日记录"
    value={`${Math.round(summary.today.completionRate * 100)}`}
    unit="%"
    hint="睡眠 · 运动 · 能量"
  />
</section>
```

- [ ] **Step 2: Update TrendChart to exercise minutes**

```tsx
import type { DailyTrendPoint } from '@/types/life';

export function TrendChart({ points }: { points: DailyTrendPoint[] }) {
  const values = points.map((point) =>
    point.exerciseMinutes == null ? null : Math.min(120, point.exerciseMinutes),
  );
  const present = values.filter((value): value is number => value != null);
  const max = Math.max(60, ...present);
  const path = values
    .map((value, index) =>
      value == null ? '' : `${index === 0 ? 'M' : 'L'} ${24 + index * 52} ${112 - (value / max) * 82}`,
    )
    .filter(Boolean)
    .join(' ');
  const totalMinutes = present.reduce((a, b) => a + b, 0);

  return (
    <article className="life-card trend-card">
      <div className="card-heading">
        <div>
          <div className="eyebrow">运动节奏 · 近 7 天</div>
          <h2>把活动写进可见的趋势</h2>
        </div>
        <span className="trend-total">
          {present.length ? `${Math.round((totalMinutes / 60) * 10) / 10}h` : '—'}
        </span>
      </div>
      {present.length ? (
        <svg
          className="trend-svg"
          viewBox="0 0 336 138"
          role="img"
          aria-label={`近七天运动趋势，共 ${totalMinutes} 分钟`}
        >
          <path className="trend-grid" d="M24 30H336M24 71H336M24 112H336" />
          <path className="trend-line" d={path} />
          <path className="trend-fill" d={`${path} L 336 112 L 24 112 Z`} />
          {values.map(
            (value, i) =>
              value != null && (
                <circle
                  key={i}
                  cx={24 + i * 52}
                  cy={112 - (value / max) * 82}
                  r="4"
                  className="trend-dot"
                />
              ),
          )}
          {points.map((point, i) => (
            <text key={point.date} x={24 + i * 52} y="132" textAnchor="middle">
              {point.label}
            </text>
          ))}
        </svg>
      ) : (
        <div className="empty-chart">记录几次运动后，这里会出现你的活动节奏。</div>
      )}
    </article>
  );
}
```

- [ ] **Step 3: Update AchievementCard**

```tsx
import type { AchievementSummary } from '@/types/life';

export function AchievementCard({ achievements }: { achievements: AchievementSummary }) {
  const items = [
    ['连续记录', `${achievements.recordingStreak} 天`],
    ['运动投入', `${achievements.exerciseHours} 小时`],
    ['有记录的日子', `${achievements.recordedDays} / 7`],
  ];
  return (
    <article className="life-card achievement-card">
      <div className="eyebrow">微小但真实的进步</div>
      <h2>你正在建立健康节奏</h2>
      <div className="achievement-list">
        {items.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Typecheck / tests**

```bash
npm test -- src/__tests__/life/aggregate.test.ts src/__tests__/ai/life-insight.test.ts
npx tsc --noEmit
```

Expected: tests PASS; `tsc` clean for renamed fields (fix any remaining `focusMinutes` / `focusHours` references under `src/`).

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/page.tsx src/components/dashboard/TrendChart.tsx src/components/dashboard/AchievementCard.tsx
git commit -m "feat(dashboard): show sleep, exercise, energy on home"
```

---

### Task 6: Quick log + log page + exercise module page

**Files:**
- Modify: `src/components/dashboard/QuickLogSheet.tsx`
- Modify: `src/app/(app)/log/page.tsx`
- Create: `src/app/(app)/exercise/page.tsx`
- Modify: `src/app/(app)/sleep/page.tsx`
- Modify: `src/app/(app)/insights/page.tsx`

- [ ] **Step 1: Health-first QuickLogSheet**

Key behavior changes:
- Options order: sleep, exercise, mood, focus (optional), journal
- Default type: `'sleep'`
- Labels/placeholders already mostly fine; ensure exercise path says 运动时长（分钟）

```tsx
const options: Array<[LifeLogType, string]> = [
  ['sleep', '睡眠'],
  ['exercise', '运动'],
  ['mood', '能量'],
  ['focus', '专注'],
  ['journal', '日记'],
];
// useState<LifeLogType>('sleep')
```

Update the dynamic label branch so `exercise` is explicit and `focus` remains secondary:

```ts
type === 'journal'
  ? '写下此刻'
  : type === 'mood'
    ? '能量评分（1–5）'
    : type === 'sleep'
      ? '睡眠时长（小时）'
      : type === 'exercise'
        ? '运动时长（分钟）'
        : type === 'focus'
          ? '专注时长（分钟）'
          : '数值'
```

- [ ] **Step 2: Log page primary forms**

```tsx
import { LifeLogForm } from '@/components/dashboard/LifeLogForm';

export default function LogPage() {
  return (
    <div className="module-page">
      <header className="module-header">
        <div className="eyebrow">记录 · DAILY INPUT</div>
        <h1>把今天的身体状态留下来。</h1>
        <p>优先记录睡眠、运动和能量。真实比完美更有用。</p>
      </header>
      <div className="module-grid">
        <LifeLogForm type="sleep" title="昨夜睡眠" helper="记录大概小时数，建立自己的睡眠基线。" />
        <LifeLogForm type="exercise" title="今日运动" helper="步行、力量、拉伸都可以，记下分钟数即可。" />
        <LifeLogForm type="mood" title="此刻的能量" helper="用 1–5 分描述你现在的能量，不需要解释。" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create exercise page**

Create `src/app/(app)/exercise/page.tsx`:

```tsx
import { LifeLogForm } from '@/components/dashboard/LifeLogForm';

export default function ExercisePage() {
  return (
    <div className="module-page">
      <header className="module-header">
        <div className="eyebrow">运动 · MOVE</div>
        <h1>让身体活动变得可见。</h1>
        <p>不追求完美训练计划。先记录真实发生过的活动时间。</p>
      </header>
      <div className="module-grid">
        <LifeLogForm
          type="exercise"
          title="完成一段运动"
          helper="哪怕只有 15 分钟步行，也值得被看见。"
        />
        <article className="life-card module-note">
          <div className="eyebrow">运动记录建议</div>
          <h2>短一点，连续一点。</h2>
          <p>比起偶尔一次高强度，更重要的是建立一个你愿意重复的开始方式。</p>
        </article>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Soft-update sleep + insights copy**

`sleep/page.tsx` header: emphasize recovery/health, remove “注意力” efficiency framing if present.

`insights/page.tsx`:

```tsx
<div className="eyebrow">洞察 · HEALTH BRIEF</div>
<h1>看见状态，而不是评判自己。</h1>
<p>AI 只读取你的健康记录和聚合趋势，帮助你发现值得保留的节奏。</p>
```

Keep the “这是描述，不是诊断” note.

- [ ] **Step 5: Smoke the write path**

With dev server:
1. Open `/log`, save sleep `7`, exercise `30`, mood `4`
2. Open `/` — cards should show values; completion 100%
3. Open `/exercise` — form works
4. Confirm `/focus` still loads if navigated manually (optional legacy)

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/QuickLogSheet.tsx src/app/(app)/log/page.tsx src/app/(app)/exercise/page.tsx src/app/(app)/sleep/page.tsx src/app/(app)/insights/page.tsx
git commit -m "feat(health): prioritize sleep, exercise, and energy logging"
```

---

### Task 7: Product metadata + residual focus-primary references

**Files:**
- Modify: `package.json`
- Grep/fix remaining UI strings if any

- [ ] **Step 1: Update package description**

```json
"description": "澄境 · CLARITY 个人健康与状态管理系统"
```

Optionally leave `productName` as `澄境`.

- [ ] **Step 2: Grep for leftover primary focus metrics**

```bash
rg -n "focusMinutes|focusHours|今日专注|生活操作系统|个人状态中心" src package.json
```

Expected after fixes: no `focusMinutes` / `focusHours` in types/UI; focus may remain as optional log type and `/focus` page.

- [ ] **Step 3: Full test run**

```bash
npm test
npx tsc --noEmit
```

Expected: all tests pass; no type errors.

- [ ] **Step 4: Commit**

```bash
git add package.json src
git commit -m "chore: rebrand package copy for health status system"
```

---

### Task 8: P0 acceptance checklist (manual)

- [ ] **Step 1: Walk the resume demo script**

1. Open app → unlock/setup if needed  
2. Home shows **睡眠 / 运动 / 能量 / 完成度**  
3. Nav has no 显化 / 复盘 / 专注 as primary items  
4. Record sleep + exercise (+ energy)  
5. Home numbers update  
6. Trend empty-state or exercise series works  
7. Insights page loads; AI failure still leaves dashboard usable  

- [ ] **Step 2: Spec checklist**

Confirm against `docs/superpowers/specs/2026-07-25-health-status-system-design.md` §九:
- [ ] 主导航仅健康相关入口  
- [ ] 首页四指标正确  
- [ ] 可录入 sleep/exercise/mood  
- [ ] 7 日趋势与空态  
- [ ] 解锁与本地数据路径可演示  
- [ ] AI 失败不阻断记录  

- [ ] **Step 3: Final commit only if small copy fixes remain**

```bash
git add -A
git status
# commit only intentional P0 leftovers, not unrelated WIP
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| Product reposition health | Tasks 4–7 |
| P0 metrics sleep/exercise/energy/completion | Tasks 1–2, 5 |
| Hide manifest/reflect from primary nav | Task 4 |
| Focus demoted | Tasks 2, 4, 6 |
| 7-day trend | Task 5 |
| Logging path | Task 6 |
| AI non-blocking + non-diagnostic | Task 3, 6 insights note |
| Resume demo path | Task 8 |
| No medical claims | Task 3 filter + insights copy |
| Do not delete old tables/routes | Explicitly preserved |

**Placeholder scan:** none intentional.  
**Type consistency:** `exerciseMinutes` / `exerciseHours` / `HEALTH_COMPLETION_TYPES` used consistently across tasks 1–5.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-25-health-status-system.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — run tasks in this session with executing-plans and checkpoints  

Which approach?
