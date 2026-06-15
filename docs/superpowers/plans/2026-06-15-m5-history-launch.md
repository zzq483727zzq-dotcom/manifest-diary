# M5: 历史回看 + 移动端 + AI 日志 + 上线 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 v1 的最后一英里跑完——实现日历回看 + 关键词搜索、检查移动端响应式、给自己看的 AI 调用日志面板，最后正式上线。

**Architecture:** 复用已有的 Supabase 客户端读取历史数据。日历用一个轻量自研网格组件（不引入外部日历库，避免主题污染）。搜索走 Postgres `ILIKE` 全文匹配（v1 不上 pg_trgm/full-text-search，量小够用）。AI 日志面板是只读的统计页，从 `ai_call_logs` 聚合查询。移动端响应式以 Tailwind 断点为主，逐页核查不重写。

**Tech Stack:** Next.js Server Components (历史 / 搜索 / 日志页) + Client Components (日历交互) + Supabase + Tailwind 响应式 + Vercel 自定义域名。

---

## File Structure

```
src/
├── app/
│   └── (app)/
│       ├── history/
│       │   ├── page.tsx                    # 日历总览
│       │   ├── [date]/
│       │   │   └── page.tsx                # 单日详情
│       │   └── search/
│       │       └── page.tsx                # 搜索结果页
│       └── admin/
│           └── ai-logs/
│               └── page.tsx                # AI 调用日志面板（仅自己看）
├── components/
│   ├── history/
│   │   ├── CalendarGrid.tsx                # 日历网格
│   │   ├── DayCell.tsx                     # 单日格子（含密度指示）
│   │   ├── DayDetailView.tsx               # 单日详情展示
│   │   ├── SearchBar.tsx                   # 历史搜索框
│   │   └── SearchResults.tsx               # 搜索结果列表
│   └── admin/
│       └── AILogsTable.tsx                 # AI 日志表格
├── lib/
│   └── supabase/
│       ├── history.ts                      # 历史数据查询
│       └── ai-logs.ts                      # AI 日志聚合查询
└── docs/
    └── deployment.md                       # 部署说明（最终交付物）
```

---

## Task 1: 历史数据查询函数

**Files:**
- Create: `src/lib/supabase/history.ts`
- Create: `src/__tests__/lib/supabase/history.test.ts`

- [ ] **Step 1: 写测试**

`src/__tests__/lib/supabase/history.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { aggregateMonthEntries, type DailyAggregate } from "@/lib/supabase/history";

describe("aggregateMonthEntries", () => {
  it("groups journal and manifest entries by date", () => {
    const journalEntries = [
      { entry_date: "2026-06-15", id: "j1" },
      { entry_date: "2026-06-15", id: "j2" },
      { entry_date: "2026-06-16", id: "j3" },
    ];
    const manifestEntries = [
      { entry_date: "2026-06-15", id: "m1" },
      { entry_date: "2026-06-17", id: "m2" },
    ];

    const result = aggregateMonthEntries(journalEntries, manifestEntries);

    expect(result["2026-06-15"]).toEqual({
      date: "2026-06-15",
      journalCount: 2,
      manifestCount: 1,
    } satisfies DailyAggregate);
    expect(result["2026-06-16"]).toEqual({
      date: "2026-06-16",
      journalCount: 1,
      manifestCount: 0,
    });
    expect(result["2026-06-17"]).toEqual({
      date: "2026-06-17",
      journalCount: 0,
      manifestCount: 1,
    });
  });

  it("returns empty object when given no entries", () => {
    expect(aggregateMonthEntries([], [])).toEqual({});
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm run test -- history
```

Expected: FAIL with "Cannot find module '@/lib/supabase/history'"

- [ ] **Step 3: 实现 history.ts**

`src/lib/supabase/history.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";

export interface DailyAggregate {
  date: string;
  journalCount: number;
  manifestCount: number;
}

export interface DayDetail {
  date: string;
  journalEntries: Array<{
    id: string;
    raw_input: string;
    ai_response: string | null;
    ai_structured: unknown;
    created_at: string;
  }>;
  manifestEntries: Array<{
    id: string;
    intention: string;
    category: string;
    ai_echo: string | null;
    keywords: string[];
    created_at: string;
  }>;
}

export interface SearchHit {
  type: "journal" | "manifest";
  id: string;
  date: string;
  snippet: string;
}

/**
 * Aggregate raw rows by date. Pure function, used by month-view calendar.
 * Exported separately so unit tests don't need Supabase.
 */
export function aggregateMonthEntries(
  journalEntries: Array<{ entry_date: string }>,
  manifestEntries: Array<{ entry_date: string }>
): Record<string, DailyAggregate> {
  const out: Record<string, DailyAggregate> = {};

  const ensure = (date: string): DailyAggregate => {
    if (!out[date]) {
      out[date] = { date, journalCount: 0, manifestCount: 0 };
    }
    return out[date];
  };

  for (const e of journalEntries) ensure(e.entry_date).journalCount += 1;
  for (const e of manifestEntries) ensure(e.entry_date).manifestCount += 1;

  return out;
}

/** Fetch month aggregate for the calendar grid. */
export async function fetchMonthAggregate(
  userId: string,
  year: number,
  month: number // 1-12
): Promise<Record<string, DailyAggregate>> {
  const supabase = await createClient();

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [{ data: journals }, { data: manifests }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("entry_date")
      .eq("user_id", userId)
      .gte("entry_date", start)
      .lte("entry_date", end),
    supabase
      .from("manifest_entries")
      .select("entry_date")
      .eq("user_id", userId)
      .gte("entry_date", start)
      .lte("entry_date", end),
  ]);

  return aggregateMonthEntries(journals ?? [], manifests ?? []);
}

/** Fetch all entries for a single date. */
export async function fetchDayDetail(
  userId: string,
  date: string
): Promise<DayDetail> {
  const supabase = await createClient();

  const [{ data: journals }, { data: manifests }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id, raw_input, ai_response, ai_structured, created_at")
      .eq("user_id", userId)
      .eq("entry_date", date)
      .order("created_at", { ascending: true }),
    supabase
      .from("manifest_entries")
      .select("id, intention, category, ai_echo, keywords, created_at")
      .eq("user_id", userId)
      .eq("entry_date", date)
      .order("created_at", { ascending: true }),
  ]);

  return {
    date,
    journalEntries: journals ?? [],
    manifestEntries: manifests ?? [],
  };
}

/** Keyword search using ILIKE — v1 simple match, no fuzzy. */
export async function searchEntries(
  userId: string,
  query: string,
  limit: number = 30
): Promise<SearchHit[]> {
  const supabase = await createClient();
  const trimmed = query.trim();
  if (!trimmed) return [];
  const pattern = `%${trimmed.replace(/[%_]/g, (c) => `\\${c}`)}%`;

  const [{ data: journalHits }, { data: manifestHits }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id, entry_date, raw_input, ai_response")
      .eq("user_id", userId)
      .or(`raw_input.ilike.${pattern},ai_response.ilike.${pattern}`)
      .order("entry_date", { ascending: false })
      .limit(limit),
    supabase
      .from("manifest_entries")
      .select("id, entry_date, intention, ai_echo")
      .eq("user_id", userId)
      .or(`intention.ilike.${pattern},ai_echo.ilike.${pattern}`)
      .order("entry_date", { ascending: false })
      .limit(limit),
  ]);

  const buildSnippet = (text: string | null): string => {
    if (!text) return "";
    const idx = text.toLowerCase().indexOf(trimmed.toLowerCase());
    if (idx < 0) return text.slice(0, 80);
    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + trimmed.length + 30);
    return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
  };

  const journalResults: SearchHit[] = (journalHits ?? []).map((row) => ({
    type: "journal" as const,
    id: row.id,
    date: row.entry_date,
    snippet: buildSnippet(row.raw_input ?? row.ai_response),
  }));

  const manifestResults: SearchHit[] = (manifestHits ?? []).map((row) => ({
    type: "manifest" as const,
    id: row.id,
    date: row.entry_date,
    snippet: buildSnippet(row.intention ?? row.ai_echo),
  }));

  return [...journalResults, ...manifestResults]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npm run test -- history
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/history.ts src/__tests__/lib/supabase/history.test.ts
git commit -m "feat(history): add month aggregate, day detail, and search queries"
```

---

## Task 2: 日历网格组件

**Files:**
- Create: `src/components/history/CalendarGrid.tsx`
- Create: `src/components/history/DayCell.tsx`

- [ ] **Step 1: 写 DayCell 单日格子**

`src/components/history/DayCell.tsx`:

```typescript
import Link from "next/link";
import type { DailyAggregate } from "@/lib/supabase/history";

interface DayCellProps {
  date: string;            // 'YYYY-MM-DD'
  dayNumber: number;        // 1-31
  isCurrentMonth: boolean;
  isToday: boolean;
  aggregate?: DailyAggregate;
}

export function DayCell({ date, dayNumber, isCurrentMonth, isToday, aggregate }: DayCellProps) {
  const total = (aggregate?.journalCount ?? 0) + (aggregate?.manifestCount ?? 0);
  const hasEntries = total > 0;

  // Density mapping: 1=light, 2-3=medium, 4+=full
  const densityClass = !hasEntries
    ? ""
    : total >= 4
      ? "bg-rose-300/40 ring-1 ring-rose-300/60"
      : total >= 2
        ? "bg-rose-300/25 ring-1 ring-rose-300/40"
        : "bg-rose-300/15 ring-1 ring-rose-300/25";

  const inner = (
    <div
      className={[
        "relative aspect-square rounded-xl flex flex-col items-center justify-center",
        "transition-all duration-150",
        isCurrentMonth ? "text-cream-100" : "text-cream-100/30",
        isToday ? "ring-2 ring-amber-200" : "",
        densityClass,
        hasEntries ? "hover:ring-rose-300 hover:scale-105 cursor-pointer" : "opacity-50",
      ].join(" ")}
    >
      <span className="text-sm font-light">{dayNumber}</span>
      {hasEntries && (
        <div className="absolute bottom-1.5 flex gap-0.5">
          {(aggregate?.journalCount ?? 0) > 0 && (
            <span className="w-1 h-1 rounded-full bg-amber-200/80" aria-label="reflection" />
          )}
          {(aggregate?.manifestCount ?? 0) > 0 && (
            <span className="w-1 h-1 rounded-full bg-rose-300" aria-label="manifest" />
          )}
        </div>
      )}
    </div>
  );

  return hasEntries ? <Link href={`/history/${date}`}>{inner}</Link> : inner;
}
```

- [ ] **Step 2: 写 CalendarGrid 月视图**

`src/components/history/CalendarGrid.tsx`:

```typescript
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DayCell } from "./DayCell";
import type { DailyAggregate } from "@/lib/supabase/history";

interface CalendarGridProps {
  year: number;
  month: number; // 1-12
  aggregates: Record<string, DailyAggregate>;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function CalendarGrid({ year, month, aggregates }: CalendarGridProps) {
  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    // Mon=0..Sun=6 (treat Monday as week start)
    const offset = (firstDay.getDay() + 6) % 7;
    const lastDay = new Date(year, month, 0).getDate();

    const out: Array<{
      date: string;
      day: number;
      isCurrentMonth: boolean;
    }> = [];

    // Leading days from previous month
    if (offset > 0) {
      const prevLastDay = new Date(year, month - 1, 0).getDate();
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonth = month === 1 ? 12 : month - 1;
      for (let i = offset - 1; i >= 0; i--) {
        const d = prevLastDay - i;
        out.push({
          date: `${prevYear}-${pad(prevMonth)}-${pad(d)}`,
          day: d,
          isCurrentMonth: false,
        });
      }
    }

    // Current month
    for (let d = 1; d <= lastDay; d++) {
      out.push({
        date: `${year}-${pad(month)}-${pad(d)}`,
        day: d,
        isCurrentMonth: true,
      });
    }

    // Trailing days
    while (out.length % 7 !== 0) {
      const idx = out.length - lastDay - offset + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonth = month === 12 ? 1 : month + 1;
      out.push({
        date: `${nextYear}-${pad(nextMonth)}-${pad(idx)}`,
        day: idx,
        isCurrentMonth: false,
      });
    }

    return out;
  }, [year, month]);

  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <Link
          href={`/history?year=${prevMonth.y}&month=${prevMonth.m}`}
          className="text-cream-100/70 hover:text-cream-100 text-sm px-3 py-1.5 rounded-lg
                     bg-night-700/40 hover:bg-night-700"
        >
          ← {prevMonth.y}年{prevMonth.m}月
        </Link>
        <h2 className="text-lg font-light text-cream-100">
          {year} · {month}月
        </h2>
        <Link
          href={`/history?year=${nextMonth.y}&month=${nextMonth.m}`}
          className="text-cream-100/70 hover:text-cream-100 text-sm px-3 py-1.5 rounded-lg
                     bg-night-700/40 hover:bg-night-700"
        >
          {nextMonth.y}年{nextMonth.m}月 →
        </Link>
      </header>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs text-cream-100/40 pb-1">
            {d}
          </div>
        ))}
        {cells.map((cell) => (
          <DayCell
            key={cell.date}
            date={cell.date}
            dayNumber={cell.day}
            isCurrentMonth={cell.isCurrentMonth}
            isToday={cell.date === todayIso}
            aggregate={aggregates[cell.date]}
          />
        ))}
      </div>

      <div className="flex gap-4 text-xs text-cream-100/50 justify-center pt-2">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-200/80" /> 复盘
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-300" /> 显化
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/history/CalendarGrid.tsx src/components/history/DayCell.tsx
git commit -m "feat(history): add calendar grid with density-aware day cells"
```

---

## Task 3: 日历总览页 + 搜索栏

**Files:**
- Create: `src/components/history/SearchBar.tsx`
- Create: `src/app/(app)/history/page.tsx`

- [ ] **Step 1: 写 SearchBar**

`src/components/history/SearchBar.tsx`:

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface SearchBarProps {
  initialQuery?: string;
}

export function SearchBar({ initialQuery = "" }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/history/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索复盘和显化里的字句…"
        className="w-full px-4 py-2.5 pr-12 rounded-full bg-night-700/40 border border-night-600
                   text-cream-100 placeholder:text-cream-100/40 text-sm
                   focus:outline-none focus:border-rose-300/60 focus:bg-night-700"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-full text-xs
                   bg-rose-300/80 text-night-900 hover:bg-rose-300 disabled:opacity-30"
        disabled={!query.trim()}
      >
        搜
      </button>
    </form>
  );
}
```

- [ ] **Step 2: 写日历总览页**

`src/app/(app)/history/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchMonthAggregate } from "@/lib/supabase/history";
import { CalendarGrid } from "@/components/history/CalendarGrid";
import { SearchBar } from "@/components/history/SearchBar";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function HistoryPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const aggregates = await fetchMonthAggregate(user.id, year, month);

  return (
    <main className="min-h-screen bg-night-900 px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-3">
          <h1 className="text-2xl font-light text-cream-100">
            <span className="bg-gradient-to-r from-rose-300 to-amber-200 bg-clip-text text-transparent">
              ✦
            </span>{" "}
            日历回看
          </h1>
          <SearchBar />
        </header>

        <CalendarGrid year={year} month={month} aggregates={aggregates} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: 启动服务器手动验证**

```bash
npm run dev
```

打开 `http://localhost:3000/history`：
- 应看到当前月份日历，有过记录的天有玫瑰金圆点
- 点击有记录的天 → 跳到 `/history/2026-06-15`（下一个 Task 实现）
- 点击 ← / → 切月
- 输入搜索词 → 跳到搜索页（下下个 Task 实现）

- [ ] **Step 4: Commit**

```bash
git add src/components/history/SearchBar.tsx src/app/\(app\)/history/page.tsx
git commit -m "feat(history): add calendar overview page with month nav and search bar"
```

---

## Task 4: 单日详情页

**Files:**
- Create: `src/components/history/DayDetailView.tsx`
- Create: `src/app/(app)/history/[date]/page.tsx`

- [ ] **Step 1: 写 DayDetailView**

`src/components/history/DayDetailView.tsx`:

```typescript
import type { DayDetail } from "@/lib/supabase/history";

interface ReflectionStructured {
  highlights?: Array<{ fact: string; why_it_counts: string }>;
  cognitive_bugs?: Array<{ user_quote: string; reframe: string }>;
  tomorrow_script?: Array<{ step: number; action: string; duration_minutes: number }>;
}

interface DayDetailViewProps {
  detail: DayDetail;
}

const CATEGORY_LABELS: Record<string, string> = {
  self: "🌱 自我",
  relationship: "💞 关系",
  career: "🎯 事业",
  health: "🌿 身心",
  abundance: "✨ 丰盛",
  other: "🌙 其他",
};

export function DayDetailView({ detail }: DayDetailViewProps) {
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

  const hasContent = detail.journalEntries.length > 0 || detail.manifestEntries.length > 0;

  return (
    <div className="space-y-8">
      {!hasContent && (
        <p className="text-cream-100/50 text-center py-12">这一天没有留下文字。</p>
      )}

      {detail.journalEntries.map((j) => {
        const struct = (j.ai_structured ?? {}) as ReflectionStructured;
        return (
          <article
            key={j.id}
            className="space-y-4 p-5 md:p-6 rounded-2xl bg-night-700/40 border border-night-600"
          >
            <header className="flex items-center justify-between text-xs text-cream-100/50">
              <span>🌙 复盘 · {formatTime(j.created_at)}</span>
            </header>

            <div className="space-y-1 text-sm text-cream-100/60 italic">
              <p>{j.raw_input}</p>
            </div>

            {j.ai_response && (
              <div className="p-4 rounded-xl bg-cream-50/95 text-night-900">
                <p className="text-sm leading-relaxed">{j.ai_response}</p>
              </div>
            )}

            {struct.highlights && struct.highlights.length > 0 && (
              <section>
                <h3 className="text-xs uppercase tracking-wider text-amber-200/80 mb-2">
                  ✨ 今日高光
                </h3>
                <ul className="space-y-2">
                  {struct.highlights.map((h, i) => (
                    <li key={i} className="text-sm text-cream-100">
                      <strong className="text-cream-100">{h.fact}</strong>
                      <span className="block text-cream-100/60 mt-0.5">{h.why_it_counts}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {struct.cognitive_bugs && struct.cognitive_bugs.length > 0 && (
              <section>
                <h3 className="text-xs uppercase tracking-wider text-rose-300/80 mb-2">
                  🔍 心理 Bug
                </h3>
                <ul className="space-y-3">
                  {struct.cognitive_bugs.map((b, i) => (
                    <li key={i} className="text-sm">
                      <p className="text-cream-100/50 italic">「{b.user_quote}」</p>
                      <p className="text-cream-100 mt-1">{b.reframe}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {struct.tomorrow_script && struct.tomorrow_script.length > 0 && (
              <section>
                <h3 className="text-xs uppercase tracking-wider text-amber-200/80 mb-2">
                  📋 明日脚本
                </h3>
                <ol className="space-y-1.5">
                  {struct.tomorrow_script.map((s) => (
                    <li key={s.step} className="text-sm text-cream-100 flex gap-3">
                      <span className="text-amber-200/80 font-mono">{s.step}.</span>
                      <span>{s.action}</span>
                      <span className="text-cream-100/40 text-xs">
                        · {s.duration_minutes}min
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </article>
        );
      })}

      {detail.manifestEntries.map((m) => (
        <article
          key={m.id}
          className="space-y-3 p-5 md:p-6 rounded-2xl bg-purple-900/20 border border-rose-300/20"
        >
          <header className="flex items-center justify-between text-xs text-cream-100/60">
            <span>{CATEGORY_LABELS[m.category] ?? m.category} · {formatTime(m.created_at)}</span>
          </header>

          <p className="text-sm leading-relaxed text-cream-100">{m.intention}</p>

          {m.ai_echo && (
            <p className="text-sm leading-relaxed text-rose-200 italic border-l-2 border-rose-300/40 pl-3">
              {m.ai_echo}
            </p>
          )}

          {m.keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {m.keywords.map((k, i) => (
                <span
                  key={i}
                  className="px-2.5 py-0.5 text-xs rounded-full bg-rose-300/15 text-rose-200"
                >
                  {k}
                </span>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 写单日详情页**

`src/app/(app)/history/[date]/page.tsx`:

```typescript
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchDayDetail } from "@/lib/supabase/history";
import { DayDetailView } from "@/components/history/DayDetailView";

interface PageProps {
  params: Promise<{ date: string }>;
}

export default async function DayDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { date } = await params;
  // Validate format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const detail = await fetchDayDetail(user.id, date);

  const [y, m, d] = date.split("-");
  const formatted = `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;

  return (
    <main className="min-h-screen bg-night-900 px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-2">
          <Link
            href={`/history?year=${y}&month=${Number(m)}`}
            className="text-sm text-cream-100/60 hover:text-cream-100"
          >
            ← 回到日历
          </Link>
          <h1 className="text-xl font-light text-cream-100">{formatted}</h1>
        </header>

        <DayDetailView detail={detail} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: 手动验证**

```bash
npm run dev
```

- 访问 `/history` → 点一个有内容的天
- 验证显示了复盘和显化记录
- 验证非法日期 `/history/abc` 返回 404

- [ ] **Step 4: Commit**

```bash
git add src/components/history/DayDetailView.tsx "src/app/(app)/history/[date]/page.tsx"
git commit -m "feat(history): add day detail page with full reflection and manifest cards"
```

---

## Task 5: 搜索结果页

**Files:**
- Create: `src/components/history/SearchResults.tsx`
- Create: `src/app/(app)/history/search/page.tsx`

- [ ] **Step 1: 写 SearchResults**

`src/components/history/SearchResults.tsx`:

```typescript
import Link from "next/link";
import type { SearchHit } from "@/lib/supabase/history";

interface SearchResultsProps {
  query: string;
  hits: SearchHit[];
}

function highlightMatch(snippet: string, query: string) {
  if (!query) return snippet;
  const idx = snippet.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return snippet;
  return (
    <>
      {snippet.slice(0, idx)}
      <mark className="bg-amber-200/30 text-amber-100 rounded px-0.5">
        {snippet.slice(idx, idx + query.length)}
      </mark>
      {snippet.slice(idx + query.length)}
    </>
  );
}

export function SearchResults({ query, hits }: SearchResultsProps) {
  if (hits.length === 0) {
    return (
      <p className="text-cream-100/50 text-center py-12">
        没有找到包含「{query}」的记录。
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {hits.map((hit) => (
        <li key={`${hit.type}-${hit.id}`}>
          <Link
            href={`/history/${hit.date}`}
            className="block p-4 rounded-xl bg-night-700/40 border border-night-600
                       hover:border-rose-300/40 transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-cream-100/50 mb-2">
              <span>{hit.type === "journal" ? "🌙 复盘" : "✨ 显化"}</span>
              <span>{hit.date}</span>
            </div>
            <p className="text-sm leading-relaxed text-cream-100">
              {highlightMatch(hit.snippet, query)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: 写搜索结果页**

`src/app/(app)/history/search/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { searchEntries } from "@/lib/supabase/history";
import { SearchBar } from "@/components/history/SearchBar";
import { SearchResults } from "@/components/history/SearchResults";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const hits = query ? await searchEntries(user.id, query) : [];

  return (
    <main className="min-h-screen bg-night-900 px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-3">
          <h1 className="text-xl font-light text-cream-100">
            搜索：<span className="text-rose-200">{query || "—"}</span>
          </h1>
          <SearchBar initialQuery={query} />
        </header>

        {query ? (
          <SearchResults query={query} hits={hits} />
        ) : (
          <p className="text-cream-100/50 text-center py-12">输入关键词开始搜索。</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: 手动验证**

- 在日历页搜索一个曾经写过的词
- 跳转到 `/history/search?q=xxx` → 看到带高亮的结果列表
- 点击结果 → 跳到对应日期详情页
- 搜不到的词 → 显示空状态

- [ ] **Step 4: Commit**

```bash
git add src/components/history/SearchResults.tsx "src/app/(app)/history/search/page.tsx"
git commit -m "feat(history): add search results page with snippet highlighting"
```

---

## Task 6: AI 调用日志面板

**Files:**
- Create: `src/lib/supabase/ai-logs.ts`
- Create: `src/components/admin/AILogsTable.tsx`
- Create: `src/app/(app)/admin/ai-logs/page.tsx`

- [ ] **Step 1: 写 AI 日志聚合查询**

`src/lib/supabase/ai-logs.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";

export interface AILogSummary {
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostEstimate: number;
  avgLatencyMs: number;
  byMode: Record<string, { count: number; tokensIn: number; tokensOut: number; cost: number }>;
}

export interface AILogRow {
  id: string;
  created_at: string;
  mode: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost_estimate: number;
}

/**
 * Aggregate logs over a recent window.
 * `sinceDays` = 7 means last 7 days.
 */
export async function fetchAILogSummary(
  userId: string,
  sinceDays: number = 7
): Promise<{ summary: AILogSummary; rows: AILogRow[] }> {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const { data, error } = await supabase
    .from("ai_call_logs")
    .select("id, created_at, mode, tokens_in, tokens_out, latency_ms, cost_estimate")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const rows = (data ?? []) as AILogRow[];

  const summary: AILogSummary = {
    totalCalls: rows.length,
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCostEstimate: 0,
    avgLatencyMs: 0,
    byMode: {},
  };

  let latencySum = 0;

  for (const r of rows) {
    summary.totalTokensIn += r.tokens_in ?? 0;
    summary.totalTokensOut += r.tokens_out ?? 0;
    summary.totalCostEstimate += Number(r.cost_estimate ?? 0);
    latencySum += r.latency_ms ?? 0;

    if (!summary.byMode[r.mode]) {
      summary.byMode[r.mode] = { count: 0, tokensIn: 0, tokensOut: 0, cost: 0 };
    }
    summary.byMode[r.mode].count += 1;
    summary.byMode[r.mode].tokensIn += r.tokens_in ?? 0;
    summary.byMode[r.mode].tokensOut += r.tokens_out ?? 0;
    summary.byMode[r.mode].cost += Number(r.cost_estimate ?? 0);
  }

  summary.avgLatencyMs = rows.length > 0 ? Math.round(latencySum / rows.length) : 0;

  return { summary, rows };
}
```

- [ ] **Step 2: 写 AILogsTable 组件**

`src/components/admin/AILogsTable.tsx`:

```typescript
import type { AILogSummary, AILogRow } from "@/lib/supabase/ai-logs";

interface AILogsTableProps {
  summary: AILogSummary;
  rows: AILogRow[];
}

const MODE_LABELS: Record<string, string> = {
  reflection: "🌙 复盘梳理",
  manifest_echo: "✨ 显化回响",
  manifest_analysis: "🔮 显化分析",
};

export function AILogsTable({ summary, rows }: AILogsTableProps) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="调用次数" value={summary.totalCalls.toString()} />
        <SummaryCard
          label="输入 tokens"
          value={summary.totalTokensIn.toLocaleString()}
        />
        <SummaryCard
          label="输出 tokens"
          value={summary.totalTokensOut.toLocaleString()}
        />
        <SummaryCard
          label="估算费用"
          value={`¥${summary.totalCostEstimate.toFixed(2)}`}
        />
      </div>

      {/* By-mode Breakdown */}
      {Object.keys(summary.byMode).length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm text-cream-100/70">按模式分类</h3>
          <div className="space-y-1.5">
            {Object.entries(summary.byMode).map(([mode, m]) => (
              <div
                key={mode}
                className="flex items-center justify-between p-3 rounded-lg bg-night-700/40 border border-night-600"
              >
                <span className="text-sm text-cream-100">{MODE_LABELS[mode] ?? mode}</span>
                <div className="text-xs text-cream-100/60 flex gap-4">
                  <span>{m.count} 次</span>
                  <span>{m.tokensIn + m.tokensOut} tokens</span>
                  <span>¥{m.cost.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Detail Table */}
      <section>
        <h3 className="text-sm text-cream-100/70 mb-2">最近 500 条调用</h3>
        <div className="rounded-lg border border-night-600 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-night-700/60 text-cream-100/60">
              <tr>
                <th className="text-left p-2">时间</th>
                <th className="text-left p-2">模式</th>
                <th className="text-right p-2">输入</th>
                <th className="text-right p-2">输出</th>
                <th className="text-right p-2">延迟</th>
                <th className="text-right p-2">费用</th>
              </tr>
            </thead>
            <tbody className="text-cream-100">
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-night-600">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-2">{MODE_LABELS[r.mode] ?? r.mode}</td>
                  <td className="p-2 text-right">{r.tokens_in}</td>
                  <td className="p-2 text-right">{r.tokens_out}</td>
                  <td className="p-2 text-right">{r.latency_ms} ms</td>
                  <td className="p-2 text-right">¥{Number(r.cost_estimate ?? 0).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="p-8 text-center text-cream-100/40">还没有 AI 调用记录</div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-night-700/40 border border-night-600">
      <div className="text-xs text-cream-100/50">{label}</div>
      <div className="text-lg text-cream-100 mt-1 font-light">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: 写 AI 日志页面**

`src/app/(app)/admin/ai-logs/page.tsx`:

```typescript
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAILogSummary } from "@/lib/supabase/ai-logs";
import { AILogsTable } from "@/components/admin/AILogsTable";

interface PageProps {
  searchParams: Promise<{ days?: string }>;
}

export default async function AILogsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const days = Math.max(1, Math.min(90, Number(params.days) || 7));

  const { summary, rows } = await fetchAILogSummary(user.id, days);

  return (
    <main className="min-h-screen bg-night-900 px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-xl font-light text-cream-100">🔧 AI 调用日志</h1>
          <p className="text-xs text-cream-100/50">最近 {days} 天 · 给自己看的成本面板</p>
          <nav className="flex gap-2 text-xs pt-1">
            {[1, 7, 30, 90].map((d) => (
              <Link
                key={d}
                href={`/admin/ai-logs?days=${d}`}
                className={`px-3 py-1 rounded-full ${
                  d === days
                    ? "bg-rose-300/80 text-night-900"
                    : "bg-night-700/40 text-cream-100/70 hover:bg-night-700"
                }`}
              >
                {d} 天
              </Link>
            ))}
          </nav>
        </header>

        <AILogsTable summary={summary} rows={rows} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: 手动验证**

```bash
npm run dev
```

- 访问 `/admin/ai-logs` → 看到调用次数、token、费用统计
- 切换 1/7/30/90 天 → 数字变化
- 表格列出最近 500 条
- 没数据时显示空状态

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/ai-logs.ts src/components/admin/AILogsTable.tsx "src/app/(app)/admin/ai-logs/page.tsx"
git commit -m "feat(admin): add AI call logs dashboard with mode breakdown and detail table"
```

---

## Task 7: 移动端响应式核查

**Files:**
- Modify: `src/app/(app)/layout.tsx` (顶栏)
- Modify: 各页面的容器 padding

逐页核查移动端布局，目标是 iPhone SE (375px) 也舒服。

- [ ] **Step 1: 检查顶部导航是否折行/滑动**

打开 `src/app/(app)/layout.tsx`（M2/M3 已存在），确认底部 / 顶部导航在 375px 宽度下：
- 横向滚动而不是换行
- 文字大小不被挤压
- 触控目标 ≥ 44×44 px

如果发现问题，修改导航容器为：

```tsx
<nav className="
  flex gap-1 overflow-x-auto whitespace-nowrap px-4 py-2
  scrollbar-none
  bg-night-900/95 backdrop-blur-sm
  border-t border-night-700
">
  {/* nav items */}
</nav>
```

并在 `tailwind.config.ts` 添加 `scrollbar-none` 工具类（如未启用 `tailwind-scrollbar` 插件，则在 `globals.css` 内手写）：

```css
/* src/app/globals.css */
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
```

- [ ] **Step 2: 检查复盘页输入框在 375px 下不溢出**

打开 `src/app/(app)/reflect/page.tsx`，确认 textarea 用 `w-full max-w-full`，没有固定宽度。Voice 按钮在小屏要不挡输入。

- [ ] **Step 3: 检查日历页**

`src/components/history/CalendarGrid.tsx` 用了 `gap-1.5`，在 375px 下每格大约 44px——刚好够点。如果觉得太挤，把 `gap-1.5` 改成 `gap-1` + `aspect-square`：

```tsx
<div className="grid grid-cols-7 gap-1 md:gap-1.5">
```

- [ ] **Step 4: 检查显化页表单与卡片**

`src/app/(app)/manifest/page.tsx` 的表单容器加 `max-w-md mx-auto px-4`，在 375px 下边距合理。

- [ ] **Step 5: 检查 AI 日志表**

表格用 `overflow-x-auto` 包一层：

```tsx
<div className="rounded-lg border border-night-600 overflow-x-auto">
  <table className="w-full text-xs min-w-[600px]">
    {/* ... */}
  </table>
</div>
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(mobile): adjust nav, calendar, manifest, and admin layout for 375px"
```

- [ ] **Step 7: 在 Chrome DevTools 用 iPhone SE 模拟器手动验证所有 5 个主页面**

预期：所有页面在 375×667 下都不出现横向滚动条（除了 admin 表格，是有意为之）。

```bash
git commit --allow-empty -m "test(mobile): manual responsive check passed for iPhone SE 375x667"
```

---

## Task 8: 上线 — 生产部署

**Files:**
- Create: `docs/deployment.md`
- Modify: `.env.local.example`

- [ ] **Step 1: 准备生产环境变量样板**

`.env.local.example`:

```
# ── Supabase ──
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# ── AI 后端（DeepSeek via dreamfield 代理）──
ANTHROPIC_AUTH_TOKEN=
ANTHROPIC_BASE_URL=https://www.dreamfield.top
ANTHROPIC_MODEL=DeepSeek-V4-Flash

# ── 仅服务端（不要带 NEXT_PUBLIC_ 前缀）──
SUPABASE_SERVICE_ROLE_KEY=  # 服务器端 admin 操作（如有）
```

- [ ] **Step 2: 写部署文档**

`docs/deployment.md`:

```markdown
# 部署到生产环境

## 前置准备

1. **Supabase 项目**已创建并跑过所有迁移（见 `supabase/migrations/`）
2. **dreamfield AI 代理 token** 已申请（按你的代理商提供）
3. **GitHub 仓库**已推送

## Vercel 部署步骤

1. 打开 https://vercel.com/new
2. 选择本仓库
3. **Framework Preset**: Next.js（自动检测）
4. **Build Command**: 默认 `npm run build`
5. **Environment Variables**: 把 `.env.local.example` 里所有变量填入
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_AUTH_TOKEN`
   - `ANTHROPIC_BASE_URL`
   - `ANTHROPIC_MODEL`
   - `SUPABASE_SERVICE_ROLE_KEY`(如有用到)
6. 点击 **Deploy**

## Supabase 配置——把生产域名加入认证回调

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. **Site URL**: 填入 Vercel 给的 `https://<your-project>.vercel.app`
3. **Redirect URLs**: 加上 `https://<your-project>.vercel.app/auth/callback`

## 自定义域名（可选）

1. Vercel 项目 → **Settings** → **Domains**
2. 添加你的域名（如 `manifest.yourname.com`）
3. 按提示在域名注册商处配置 CNAME / A 记录
4. 等 DNS 生效（一般几分钟到几小时）
5. 回到 Supabase 把 Site URL 与 Redirect URL 更新成新域名

## 上线后冒烟测试

按顺序走：
1. 访问首页 → 应该跳到 `/login`
2. 注册一个测试账号（用真实邮箱）
3. 登录 → 看到首页（早晨视图，可能是空状态）
4. 进入 `/reflect` → 输入文字 → 点 AI 梳理 → 三件套出现
5. 编辑明日脚本 → 保存 → 跳到首页
6. 进入 `/manifest` → 选分类 → 写意图 → 看到玫瑰金光晕回响
7. 进入 `/history` → 看到刚才那天有标记
8. 进入 `/admin/ai-logs` → 看到 2 条 AI 调用记录

任何一步失败：
- F12 看 console
- Vercel → Deployments → 查看 Build & Function 日志
- Supabase → Logs → 看 SQL 错误
```

- [ ] **Step 3: 推到 GitHub**

```bash
git add docs/deployment.md .env.local.example
git commit -m "docs: add deployment guide and environment variable template"
git push origin main
```

- [ ] **Step 4: 在 Vercel 完成部署**

跟着 `docs/deployment.md` 操作。完成后会有一个 `https://xxx.vercel.app` 域名。

- [ ] **Step 5: 跑冒烟测试**

按 `docs/deployment.md` 末尾的清单走一遍。每一步都通过。

- [ ] **Step 6: 把生产 URL 写回 README**

修改 `README.md` 顶部加一行：

```markdown
**Live**: https://your-domain.com (or vercel preview URL)
```

```bash
git add README.md
git commit -m "docs: add live URL to README"
git push
```

---

## Task 9: 灰度给 3-5 个朋友

**Files:** 无

- [ ] **Step 1: 写一段邀请文案**

```
Hi，做了个夜里写复盘的小工具。

不像普通日记本——你乱说一通，AI 会用「闺蜜但业务能力很强」的语气：
- 帮你看见今天真做到的事（不是夸你，是事实）
- 温柔指出你脑子里乱跑的认知偏差
- 把你混乱的明天计划，拆成「睁眼能做」的具体动作

显化日记是另一边——写下意图，AI 会有温柔的回响。
完全为了治愈，不卖课不打广告。

链接：<your-vercel-url>
注册随便用邮箱就行，所有数据只你自己能看。

晚上睡前用最爽。试完告诉我哪里别扭，我改。
```

- [ ] **Step 2: 发给 3-5 个朋友**

挑能给真实反馈的人，不是只会说"挺好的"那种。

- [ ] **Step 3: 收集反馈，记到 GitHub Issues**

每条反馈开一个 issue，标 `feedback-v1` 标签。

- [ ] **Step 4: M5 完结**

```bash
git commit --allow-empty -m "milestone: M5 complete - v1 launched and seeded with 3-5 testers"
git tag v1.0.0
git push --tags
```

---

## M5 完成标志（v1 完成标志）

- ✅ `/history` 可看月度日历，带每日密度指示
- ✅ 单日详情页可展开复盘 + 显化全部内容
- ✅ 关键词搜索可用，结果带高亮
- ✅ `/admin/ai-logs` 可看到调用次数、tokens、费用、按模式分布
- ✅ 所有页面在 iPhone SE 375px 下不错位
- ✅ 已部署到 Vercel + 自定义域名（或 vercel.app）
- ✅ 冒烟测试 8 步全通过
- ✅ 已发给 3-5 个朋友，收到至少 1 条真实反馈

完成后回到 spec 第 §10 节，对照三条成功标准给自己一周时间观察：
1. 你自己每晚都愿意打开用至少一周
2. AI 输出的"接住"部分让你觉得"它真的接住了我"
3. 第二天早上你真的执行了脚本至少 50%

这三条都满足，v1 才算真的成功。否则进入 v1.1 调整阶段。
