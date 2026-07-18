# Personal Life Management System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing manifestation diary home page into a modern personal life dashboard with quick logging, seven-day trends, achievements, and AI-readable state summaries.

**Architecture:** Add an RLS-protected `life_logs` table for normalized lifestyle events, keep existing journal/manifest/script tables intact, and expose focused Supabase query helpers plus pure aggregation functions. Render the dashboard as a server page with small client components for quick logging and progressive enhancement; AI insight is isolated behind an API route so dashboard data remains useful when AI is unavailable.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase PostgreSQL/RLS, Vitest, OpenAI SDK.

---

## File map

- Create `supabase/migrations/00004_life_logs.sql`: schema, indexes, constraints, and RLS.
- Create `src/types/life.ts`: shared log, metric, trend, achievement, and insight types.
- Create `src/lib/life/aggregate.ts`: pure daily and weekly calculations.
- Create `src/lib/supabase/life.ts`: authenticated persistence and dashboard queries.
- Create `src/app/api/life-logs/route.ts`: validated quick-log API.
- Create `src/app/api/life-insight/route.ts`: AI summary endpoint with deterministic fallback.
- Create `src/components/dashboard/*`: dashboard shell, cards, charts, quick-log sheet, AI insight.
- Modify `src/app/(app)/page.tsx`: replace the single-purpose morning page with the dashboard composition.
- Modify `src/app/(app)/layout.tsx` and `src/components/ui/NavBar.tsx`: introduce responsive desktop sidebar/mobile navigation.
- Modify `src/app/globals.css`: add graphite/ivory/electric-green tokens and reduced-motion-safe effects.
- Create tests under `src/__tests__/life/` and `src/__tests__/api/`.

### Task 1: Add the normalized life-log schema

**Files:**
- Create: `supabase/migrations/00004_life_logs.sql`

- [ ] **Step 1: Write the migration**

```sql
CREATE TABLE public.life_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sleep','focus','mood','exercise','journal','manifest')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  value NUMERIC,
  unit TEXT CHECK (unit IS NULL OR unit IN ('minutes','hours','score')),
  content TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at),
  CHECK (value IS NULL OR value >= 0)
);

CREATE INDEX idx_life_logs_user_date ON public.life_logs(user_id, entry_date DESC);
CREATE INDEX idx_life_logs_user_type_date ON public.life_logs(user_id, type, entry_date DESC);
ALTER TABLE public.life_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own life logs"
  ON public.life_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Validate migration syntax against local Supabase**

Run: `npx supabase db reset`

Expected: migrations `00001` through `00004` complete without SQL errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00004_life_logs.sql
git commit -m "feat(life): add life log schema"
```

### Task 2: Define domain types and aggregation behavior

**Files:**
- Create: `src/types/life.ts`
- Create: `src/lib/life/aggregate.ts`
- Test: `src/__tests__/life/aggregate.test.ts`

- [ ] **Step 1: Write failing aggregation tests**

Cover these exact cases: sleep average ignores missing days; focus minutes sum by day; latest mood wins within a day; completion is `recorded metric count / 4`; streak ends when today and yesterday are both absent; empty input returns zeroed seven-day points.

```ts
expect(buildDashboardSummary(logs, '2026-07-18').today.focusMinutes).toBe(75);
expect(buildDashboardSummary(logs, '2026-07-18').achievements.recordingStreak).toBe(2);
expect(buildDashboardSummary([], '2026-07-18').trend).toHaveLength(7);
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- src/__tests__/life/aggregate.test.ts`

Expected: FAIL because `buildDashboardSummary` does not exist.

- [ ] **Step 3: Add focused shared types**

Define `LifeLogType`, `LifeLog`, `DailyTrendPoint`, `TodayMetrics`, `AchievementSummary`, and `DashboardSummary` in `src/types/life.ts`. Use `number | null` for missing metrics so the UI can distinguish zero from no data.

- [ ] **Step 4: Implement pure aggregation**

Export `buildDashboardSummary(logs, today)` from `src/lib/life/aggregate.ts`. Build the seven ISO dates deterministically, normalize hours to minutes, choose the latest mood/energy log per date, calculate completed metric slots, and derive recording streak without database calls.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/__tests__/life/aggregate.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/life.ts src/lib/life/aggregate.ts src/__tests__/life/aggregate.test.ts
git commit -m "feat(life): aggregate dashboard metrics"
```

### Task 3: Add persistence and validated quick logging

**Files:**
- Create: `src/lib/supabase/life.ts`
- Create: `src/app/api/life-logs/route.ts`
- Test: `src/__tests__/life/validation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Test `parseLifeLogInput` for valid sleep/focus/mood entries and reject unsupported types, scores outside 1–5, negative duration, blank journal content, and end times before start times.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- src/__tests__/life/validation.test.ts`

Expected: FAIL because `parseLifeLogInput` is missing.

- [ ] **Step 3: Implement query helpers**

Add `fetchLifeLogs(userId, startDate, endDate)`, `createLifeLog(userId, input)`, and `deleteLifeLog(userId, id)` to `src/lib/supabase/life.ts`. Always filter by `user_id` even though RLS is enabled, select only needed columns, and return typed results.

- [ ] **Step 4: Implement validation and API route**

Export pure `parseLifeLogInput(value)` for tests. `POST` obtains the authenticated user, returns `401` without one, validates JSON, inserts through `createLifeLog`, and returns `{ log }` with status `201`; invalid payloads return `{ error }` with status `400`.

- [ ] **Step 5: Run tests and lint**

Run: `npm test -- src/__tests__/life/validation.test.ts && npm run lint`

Expected: tests PASS and no new lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/life.ts src/app/api/life-logs/route.ts src/__tests__/life/validation.test.ts
git commit -m "feat(life): add validated quick logging"
```

### Task 4: Establish the modern dashboard shell

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/ui/NavBar.tsx`
- Create: `src/components/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Add design tokens**

Add semantic variables for `--surface-base: #10110f`, `--surface-raised: #171916`, `--surface-soft: #20231f`, `--ink-primary: #f3f1e8`, `--ink-muted: #9b9f96`, `--accent: #b7ff35`, and border/focus colors. Remove dashboard dependence on gold variables while leaving legacy manifest/reflection routes functional.

- [ ] **Step 2: Build responsive shell**

Desktop: 88px sidebar, fluid main column, 320px insight rail. Mobile: single column with a fixed five-item bottom navigation. Use semantic `nav`, `main`, and `aside`; active navigation must be indicated by text/icon treatment, not color alone.

- [ ] **Step 3: Adapt app layout and navigation**

Update the authenticated layout to render `DashboardShell`. Preserve sign-out, existing route links, and `ThemeProvider`; add links for dashboard sections without deleting `/reflect`, `/manifest`, or `/history`.

- [ ] **Step 4: Verify responsive layout**

Run: `npm run dev`

Expected: `/` renders without horizontal overflow at 375px, 768px, and 1440px; keyboard focus is visible; legacy routes remain reachable.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/'(app)'/layout.tsx src/components/ui/NavBar.tsx src/components/dashboard/DashboardShell.tsx
git commit -m "feat(ui): add modern life dashboard shell"
```

### Task 5: Render today metrics, trends, actions, and achievements

**Files:**
- Modify: `src/app/(app)/page.tsx`
- Create: `src/components/dashboard/MetricCard.tsx`
- Create: `src/components/dashboard/TrendChart.tsx`
- Create: `src/components/dashboard/AchievementCard.tsx`
- Create: `src/components/dashboard/TodayActions.tsx`
- Test: `src/__tests__/life/chart.test.ts`

- [ ] **Step 1: Write failing chart projection tests**

Test the pure SVG point projector for constant values, null gaps, and min/max values. Expect no `NaN` coordinates and a stable viewBox.

- [ ] **Step 2: Implement accessible cards and chart**

`MetricCard` displays value, unit, data status, and comparison label. `TrendChart` uses inline SVG, a text summary, and an `aria-label`; empty data renders a record-now action. `AchievementCard` displays recording streak, focus hours, and completed goals with subdued locked states.

- [ ] **Step 3: Compose the server-rendered page**

Fetch the current user’s last seven days of life logs and today’s script in parallel. Pass the result through `buildDashboardSummary` and render four metric cards, `TodayActions`, one combined trend module, achievements, and insight rail placeholders.

- [ ] **Step 4: Run focused tests and type check**

Run: `npm test -- src/__tests__/life/chart.test.ts && npx tsc --noEmit`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/'(app)'/page.tsx src/components/dashboard src/__tests__/life/chart.test.ts
git commit -m "feat(dashboard): show daily state and weekly trends"
```

### Task 6: Build the quick-record sheet

**Files:**
- Create: `src/components/dashboard/QuickLogButton.tsx`
- Create: `src/components/dashboard/QuickLogSheet.tsx`
- Create: `src/components/dashboard/QuickLogForm.tsx`
- Test: `src/__tests__/life/quick-log.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Verify opening/closing, Escape handling, focus return, type selection, submit disabled state, optimistic pending state, success reset, and readable server errors.

- [ ] **Step 2: Implement the accessible sheet**

Use a client component with `role="dialog"`, `aria-modal="true"`, labelled heading, focus management, Escape close, and background scroll lock. Present sleep, focus, mood, exercise, and journal options; fields change by type while producing the normalized API payload.

- [ ] **Step 3: Submit and refresh data**

POST to `/api/life-logs`, show inline failure text, close on success, and call `router.refresh()` so server-rendered metrics update without a full navigation.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/__tests__/life/quick-log.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/QuickLogButton.tsx src/components/dashboard/QuickLogSheet.tsx src/components/dashboard/QuickLogForm.tsx src/__tests__/life/quick-log.test.tsx
git commit -m "feat(life): add quick record workflow"
```

### Task 7: Add bounded AI state insight

**Files:**
- Create: `src/lib/ai/life-insight.ts`
- Create: `src/app/api/life-insight/route.ts`
- Create: `src/components/dashboard/LifeInsightCard.tsx`
- Test: `src/__tests__/ai/life-insight.test.ts`

- [ ] **Step 1: Write failing prompt and parser tests**

Assert the prompt includes the analysis window and aggregated metrics but excludes email/user identifiers. Assert parsing requires `{ summary: string, suggestions: string[2], confidence: 'low'|'medium'|'high' }` and rejects medical diagnoses or causal certainty phrases.

- [ ] **Step 2: Implement a safe insight builder**

`buildLifeInsightInput(summary, windowDays)` serializes only aggregates. `parseLifeInsight` validates the JSON shape, caps each suggestion at 120 Chinese characters, and falls back to a deterministic low-confidence summary when fewer than three days contain data.

- [ ] **Step 3: Implement isolated API route**

Authenticate, fetch 7 or 30 days, aggregate, return the deterministic fallback for insufficient data, otherwise call the existing OpenAI client pattern. Return `503` with a retryable error when the provider fails; never block dashboard data.

- [ ] **Step 4: Build the insight card**

Show window, generated time, summary, two suggestions, confidence/data-coverage label, loading state, insufficient-data state, and retry button. Avoid medical language in UI labels.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/__tests__/ai/life-insight.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/life-insight.ts src/app/api/life-insight/route.ts src/components/dashboard/LifeInsightCard.tsx src/__tests__/ai/life-insight.test.ts
git commit -m "feat(ai): add bounded life state insights"
```

### Task 8: Integrate history and finish verification

**Files:**
- Modify: `src/lib/supabase/history.ts`
- Modify: `src/components/history/DayDetailView.tsx`
- Modify: `src/app/(app)/loading.tsx`
- Test: `src/__tests__/lib/supabase/history.test.ts`

- [ ] **Step 1: Extend history aggregation tests**

Add life-log counts and types to `DailyAggregate` and `DayDetail`; verify existing journal/manifest counts remain unchanged and life logs sort chronologically.

- [ ] **Step 2: Add life logs to history queries and UI**

Fetch `life_logs` in parallel with existing tables. Render compact sleep/focus/mood/exercise entries without altering manifest witness controls or existing journal detail behavior.

- [ ] **Step 3: Add dashboard loading skeleton**

Match the final three-column geometry, reserve stable card heights to avoid layout shift, and disable shimmer under reduced-motion preferences.

- [ ] **Step 4: Run complete verification**

Run: `npm test`

Expected: all Vitest suites pass.

Run: `npm run lint`

Expected: no ESLint errors.

Run: `npm run build`

Expected: production build completes and all app routes compile.

- [ ] **Step 5: Manual acceptance check**

Verify desktop and mobile dashboard, keyboard-only quick logging, empty and populated charts, all five record types, AI insufficient-data and provider-error states, sign-out, `/reflect`, `/manifest`, and `/history`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/history.ts src/components/history/DayDetailView.tsx src/app/'(app)'/loading.tsx src/__tests__/lib/supabase/history.test.ts
git commit -m "feat(history): include life activity timeline"
```

