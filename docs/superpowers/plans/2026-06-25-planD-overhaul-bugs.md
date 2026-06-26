# Plan D: Bug 修复 + 性能优化 + 今日页重设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复日历回看复盘、复盘提交按钮、AI 过渡动画；middleware 优化跳转速度；今日页重设计。

**Architecture:** Bug 修复直接改对应文件；middleware 复用本地 JWT 解码；新增 loading.tsx；今日页扩展为多模块。

**Tech Stack:** Next.js App Router, Framer Motion.

**依赖:** 无（可独立执行）。

---

## 文件结构

```
src/middleware.ts                       -- 修改：用 getSessionUser() 替代 getUser()
src/lib/supabase/auth.ts                -- 已有，复用
src/app/(app)/loading.tsx               -- 已有，复用
src/app/(app)/history/[date]/page.tsx   -- 验证（不修改除非必要）
src/components/history/DayDetailView.tsx -- 验证 journalEntries 渲染
src/components/reflect/SubmitButton.tsx -- 修改：加 ceremonial-tap primary
src/components/reflect/ThinkingDots.tsx -- 新建
src/components/reflect/ReflectForm.tsx   -- 修改：整合 SubmitButton + ThinkingDots
src/app/(app)/page.tsx                  -- 重设计：多模块
src/components/home/MoodQuickLog.tsx    -- 新建
src/components/home/QuickLinks.tsx      -- 新建
src/components/home/RecentReview.tsx    -- 新建
src/components/home/DailyQuote.tsx      -- 新建
```

---

## Task 1: middleware 优化——用 getSessionUser 替代 getUser

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: 查看当前 middleware**

读取 `src/middleware.ts`，确认它当前调用 `supabase.auth.getUser()`（这会阻塞网络请求）。

- [ ] **Step 2: 替换为本地 JWT 解码**

完全替换 `src/middleware.ts` 的内容为：

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/supabase/auth";

export async function middleware(request: NextRequest) {
  const user = await getSessionUser(request.cookies);

  const supabaseResponse = NextResponse.next({ request });

  // 如果未登录且访问受保护路由，重定向到 /login
  const protectedPaths = ["/", "/reflect", "/manifest", "/manifest-board", "/history", "/mood", "/reports"];
  const isProtected = protectedPaths.some(
    (p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(p + "/")
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 3: 检查 getSessionUser 签名**

读取 `src/lib/supabase/auth.ts`，确认 `getSessionUser` 接受一个 cookies 参数（ReadonlyRequestCookies 类型）。

如果签名是 `getSessionUser()` 不带参数，需要修改它接受 cookies 参数：

```typescript
export async function getSessionUser(cookies?: ReadonlyRequestCookies): Promise<SessionUser | null> {
  // ... 现有实现，使用传入的 cookies 或从 next/headers 取
}
```

- [ ] **Step 4: 验证 TypeScript**

```bash
cd D:\projects\manifest-diary
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add src/middleware.ts src/lib/supabase/auth.ts
git commit -m "perf(middleware): use local JWT decode to eliminate network round-trip"
```

---

## Task 2: 新增 ThinkingDots 组件

**Files:**
- Create: `src/components/reflect/ThinkingDots.tsx`

- [ ] **Step 1: 创建组件**

```tsx
"use client";
import { motion } from "framer-motion";

interface ThinkingDotsProps {
  message?: string;
}

export function ThinkingDots({ message = "哥正在想……" }: ThinkingDotsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mx-auto max-w-md px-6 py-4 rounded-2xl flex items-center justify-center gap-3 text-sm tracking-wide"
      style={{
        backgroundColor: "var(--bg-card-glow)",
        border: "1px solid var(--border-soft)",
        backdropFilter: "blur(6px)",
        color: "var(--text-secondary)",
      }}
    >
      <span className="inline-flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block rounded-full"
            style={{
              width: 5,
              height: 5,
              background: "var(--gold-bright)",
              boxShadow: "0 0 8px rgba(245,215,122,0.7)",
            }}
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.2, 0.7] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          />
        ))}
      </span>
      <span>{message}</span>
    </motion.div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/reflect/ThinkingDots.tsx
git commit -m "feat(reflect): add ThinkingDots transition component"
```

---

## Task 3: 复盘提交按钮 + 整合 ThinkingDots

**Files:**
- Modify: 找到复盘的提交按钮组件（可能在 `src/components/reflect/` 或 `src/app/(app)/reflect/page.tsx`）
- Create: `src/components/reflect/SubmitButton.tsx`（如果不存在）

- [ ] **Step 1: 查看现有复盘提交按钮**

```bash
grep -rl "封存这次复盘\|提交复盘\|saveReflection" src/ --include="*.tsx"
```

确认提交按钮的位置和现有样式。

- [ ] **Step 2: 添加 ceremonial-tap primary 类**

找到 `<button>` 或 `<motion.button>` 元素，修改 className：

```tsx
className="ceremonial-tap primary"
```

确保 style 包含：
```tsx
style={{
  background: "var(--gold-gradient)",
  color: "#1a120b",
  boxShadow: "var(--btn-glow-spread)",
}}
```

- [ ] **Step 3: 在 isAnalyzing 状态下显示 ThinkingDots**

找到复盘 form，找到 isAnalyzing 状态（如果不存在，加一个 state）：

```tsx
const [isAnalyzing, setIsAnalyzing] = useState(false);

// 在提交流程中
setIsAnalyzing(true);
// 等待 AI 响应完成后
setIsAnalyzing(false);
```

在 form 上方或下方显示：

```tsx
{isAnalyzing && <ThinkingDots message="哥正在想……" />}
```

- [ ] **Step 4: 验证 TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add src/components/reflect/
git commit -m "feat(reflect): add ceremonial-tap primary to submit button + ThinkingDots"
```

---

## Task 4: 验证日历回看复盘

**Files:**
- 可能修改: `src/app/(app)/history/[date]/page.tsx`
- 可能修改: `src/components/history/DayDetailView.tsx`

- [ ] **Step 1: 查看历史详情页**

读取 `src/app/(app)/history/[date]/page.tsx`，确认它调用 `fetchDayDetail()` 并传入 user.id。

- [ ] **Step 2: 查看 fetchDayDetail 实现**

读取 `src/lib/supabase/history.ts` 的 `fetchDayDetail()` 函数，确认它返回了 `journalEntries: [...]`。

- [ ] **Step 3: 查看 DayDetailView**

读取 `src/components/history/DayDetailView.tsx`，确认它渲染了 `journalEntries.map(...)`（不仅渲染 manifestEntries）。

**如果已正确实现**：跳过此 Task

**如果未正确实现**：
1. 在 fetchDayDetail 增加 journalEntries 查询（如果没有）
2. 在 DayDetailView 增加 journalEntries 渲染（如果没有）

- [ ] **Step 4: 验证**

启动 dev server，进 `/history`，点一个日期，看是否同时显示该日的复盘和显化。

- [ ] **Step 5: 提交**

```bash
git add src/app/(app)/history/ src/components/history/
git commit -m "fix(calendar): ensure history detail shows journal + manifest entries"
```

---

## Task 5: 今日页重设计——新增 4 个模块组件

**Files:**
- Create: `src/components/home/QuickLinks.tsx`
- Create: `src/components/home/MoodQuickLog.tsx`
- Create: `src/components/home/DailyQuote.tsx`
- Create: `src/components/home/RecentReview.tsx`
- Modify: `src/app/(app)/page.tsx`

- [ ] **Step 1: 创建 QuickLinks 组件**

```tsx
import Link from "next/link";

export function QuickLinks() {
  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4 max-w-2xl mx-auto">
      <Link
        href="/reflect"
        className="ceremonial-tap primary block px-5 py-4 rounded-2xl text-center transition-all"
        style={{
          background: "var(--gold-gradient)",
          color: "#1a120b",
          boxShadow: "var(--btn-glow-spread)",
        }}
      >
        <div className="text-2xl mb-1">🌙</div>
        <div className="text-sm font-medium" style={{ letterSpacing: "0.1em" }}>写复盘</div>
      </Link>
      <Link
        href="/manifest"
        className="ceremonial-tap primary block px-5 py-4 rounded-2xl text-center transition-all"
        style={{
          background: "var(--gold-gradient)",
          color: "#1a120b",
          boxShadow: "var(--btn-glow-spread)",
        }}
      >
        <div className="text-2xl mb-1">✨</div>
        <div className="text-sm font-medium" style={{ letterSpacing: "0.1em" }}>写下显化</div>
      </Link>
      <Link
        href="/history"
        className="ceremonial-tap block px-5 py-4 rounded-2xl text-center transition-all"
        style={{
          background: "var(--bg-card-glow)",
          border: "1px solid var(--border-soft)",
          color: "var(--text-primary)",
        }}
      >
        <div className="text-2xl mb-1">📖</div>
        <div className="text-sm font-medium" style={{ letterSpacing: "0.1em" }}>看看历史</div>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: 创建 MoodQuickLog 组件**

```tsx
"use client";
import { useState } from "react";

const MOODS = [
  { value: 1, emoji: "😔" },
  { value: 2, emoji: "😐" },
  { value: 3, emoji: "😊" },
  { value: 4, emoji: "😄" },
  { value: 5, emoji: "🤩" },
];

export function MoodQuickLog() {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = async (value: number) => {
    setSelected(value);
    try {
      await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: value }),
      });
    } catch (e) {
      console.error("Mood save failed:", e);
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 py-4 rounded-2xl" style={{ background: "var(--bg-card-glow)", border: "1px solid var(--border-soft)" }}>
      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)", letterSpacing: "0.15em" }}>今天心情</p>
      <div className="flex justify-between gap-2">
        {MOODS.map((m) => (
          <button
            key={m.value}
            onClick={() => handleSelect(m.value)}
            className="ceremonial-tap text-2xl flex-1 py-2 rounded-xl transition-all"
            style={{
              background: selected === m.value ? "var(--gold-gradient)" : "transparent",
              opacity: selected === null || selected === m.value ? 1 : 0.4,
            }}
          >
            {m.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 DailyQuote 组件**

```tsx
import { reflectionSubtitle } from "@/lib/time-greeting";

interface DailyQuoteProps {
  quote?: string;
}

export function DailyQuote({ quote }: DailyQuoteProps) {
  return (
    <p
      className="font-ai text-center text-sm md:text-base italic max-w-md mx-auto"
      style={{
        color: "var(--gold-bright)",
        opacity: 0.85,
        letterSpacing: "0.06em",
      }}
    >
      {quote ?? reflectionSubtitle(new Date())}
    </p>
  );
}
```

- [ ] **Step 4: 创建 RecentReview 组件**

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function RecentReview() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const [{ data: journals }, { data: manifests }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id, entry_date, raw_input, ai_response")
      .eq("user_id", user.id)
      .gte("entry_date", threeDaysAgo.toISOString().split("T")[0])
      .order("entry_date", { ascending: false })
      .limit(3),
    supabase
      .from("manifest_entries")
      .select("id, entry_date, intention")
      .eq("user_id", user.id)
      .gte("entry_date", threeDaysAgo.toISOString().split("T")[0])
      .order("entry_date", { ascending: false })
      .limit(3),
  ]);

  if ((journals?.length ?? 0) === 0 && (manifests?.length ?? 0) === 0) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-2">
      <p className="text-xs" style={{ color: "var(--text-secondary)", letterSpacing: "0.15em" }}>最近 3 天</p>
      {journals?.map((j) => (
        <Link
          key={`j-${j.id}`}
          href={`/history/${j.entry_date}`}
          className="block px-4 py-3 rounded-xl transition-colors"
          style={{
            background: "var(--bg-card-glow)",
            border: "1px solid var(--border-soft)",
          }}
        >
          <span className="text-xs mr-2" style={{ color: "var(--gold-bright)" }}>🌙 复盘</span>
          <span className="text-sm line-clamp-1" style={{ color: "var(--text-primary)" }}>{j.raw_input.slice(0, 60)}</span>
        </Link>
      ))}
      {manifests?.map((m) => (
        <Link
          key={`m-${m.id}`}
          href={`/history/${m.entry_date}`}
          className="block px-4 py-3 rounded-xl transition-colors"
          style={{
            background: "var(--bg-card-glow)",
            border: "1px solid var(--border-soft)",
          }}
        >
          <span className="text-xs mr-2" style={{ color: "var(--gold-solid)" }}>✨ 显化</span>
          <span className="text-sm line-clamp-1" style={{ color: "var(--text-primary)" }}>{m.intention}</span>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: 重写首页 page.tsx**

完全替换 `src/app/(app)/page.tsx` 内容：

```tsx
import { greetingText, formatDateZh } from "@/lib/time-greeting";
import { MorningGreeting } from "@/components/morning/MorningGreeting";
import { QuickLinks } from "@/components/home/QuickLinks";
import { MoodQuickLog } from "@/components/home/MoodQuickLog";
import { DailyQuote } from "@/components/home/DailyQuote";
import { RecentReview } from "@/components/home/RecentReview";

export default function HomePage() {
  return (
    <div className="space-y-10 max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 animate-fade-in">
      <MorningGreeting
        greeting={greetingText(new Date())}
        date={formatDateZh(new Date())}
        subtitle="今夜还没写——什么时候想倒，随时来。"
      />
      <DailyQuote />
      <QuickLinks />
      <MoodQuickLog />
      <RecentReview />
    </div>
  );
}
```

- [ ] **Step 6: 验证**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 7: 提交**

```bash
git add src/components/home/ src/app/\(app\)/page.tsx
git commit -m "feat(home): redesign home page with 4 modules (quick links, mood, quote, recent)"
```

---

## 实施检查清单

完成所有 Task 后，确认：

- [ ] middleware 用 getSessionUser 替代 getUser（不再发网络请求）
- [ ] ThinkingDots 组件存在并可显示
- [ ] 复盘提交按钮是金色仪式感（ceremonial-tap primary）
- [ ] 复盘提交时显示 ThinkingDots
- [ ] 历史详情页同时显示复盘和显化
- [ ] 首页有 4 个模块：快速入口 / 心情 / 格言 / 最近回顾
- [ ] 所有 5 个 Task 的 git commit 均已执行

---

## Spec 覆盖率自查

| Spec 章节 | 对应 Task |
|-----------|----------|
| 3.1 Bug 修复（日历回看复盘） | Task 4 |
| 3.1 Bug 修复（复盘提交按钮颜色） | Task 3 |
| 3.1 Bug 修复（AI 过渡动画） | Task 2 + Task 3 |
| 3.2 性能优化（middleware） | Task 1 |
| 3.2 性能优化（loading） | 复用现有（不修改） |
| 3.3 今日页面重设计 | Task 5 |