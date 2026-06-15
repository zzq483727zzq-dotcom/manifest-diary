# M3: 复盘与明日脚本主流程 + 治愈系 UI + 长段语音输入

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 M2 验证好的 AI 人设包装成真正的治愈系产品——夜晚复盘页、长段语音输入、流式渲染、可编辑、保存到数据库、早晨脚本视图勾选完成。

**Architecture:** 主题系统用 CSS 变量 + `data-theme` 属性切换；语音用 Web Speech API `continuous: true` + 心跳保活；AI 流式响应一边累积一边解析（先显示接住层文字，JSON 完整后渲染三张卡片）；保存走 `/api/journal` 写入 `journal_entries` 和 `tomorrow_scripts` 两张表。

**Tech Stack:** Next.js Server/Client Components, Web Speech API, Framer Motion (动画), CSS Variables (主题), Supabase JS (写入)

---

## File Structure (M3 新增)

```
src/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx                # 受保护路由 layout，含主题 Provider 和导航
│   │   ├── page.tsx                  # 替换占位首页 → 早晨脚本视图
│   │   └── reflect/
│   │       └── page.tsx              # 夜间复盘主页
│   └── api/
│       ├── journal/
│       │   └── route.ts              # 复盘 CRUD
│       └── scripts/
│           ├── route.ts              # 脚本列表 / 当日脚本
│           └── [id]/
│               └── steps/
│                   └── [stepIdx]/
│                       └── route.ts  # 单步勾选
├── components/
│   ├── theme/
│   │   ├── ThemeProvider.tsx         # 包根，按时间/路由切换 data-theme
│   │   └── ThemeContext.ts           # React Context
│   ├── voice/
│   │   ├── useVoiceRecorder.ts       # Web Speech API hook
│   │   └── VoiceButton.tsx           # 麦克风按钮 + 状态指示
│   ├── reflection/
│   │   ├── ReflectionInput.tsx       # 文本框 + 语音按钮组合
│   │   ├── EmpathyBubble.tsx         # 接住层气泡（玫瑰金边框光晕）
│   │   ├── HighlightCard.tsx         # ✨ 今日高光卡
│   │   ├── BugCard.tsx               # 🔍 认知 Bug 卡
│   │   └── ScriptCard.tsx            # 📋 明日脚本卡（可编辑）
│   ├── morning/
│   │   ├── MorningGreeting.tsx       # 早安问候
│   │   ├── ScriptStepRow.tsx         # 单步带勾选 checkbox
│   │   └── EmptyState.tsx            # 没有昨晚脚本时的空状态
│   └── ui/
│       ├── Button.tsx                # 通用按钮（继承主题色）
│       ├── Card.tsx                  # 通用卡片（奶油白 + 玫瑰金边框可选）
│       └── StarryBackground.tsx      # 夜晚模式的星点背景
├── lib/
│   ├── ai/
│   │   ├── streaming-parser.ts       # 流式解析器（边接收边切分接住层 vs JSON）
│   │   └── recent-context.ts         # 拉取用户最近 3 天记录摘要
│   └── date.ts                       # entry_date / scheduled_for 计算
└── __tests__/
    ├── lib/
    │   ├── streaming-parser.test.ts
    │   ├── recent-context.test.ts
    │   └── date.test.ts
    └── api/
        ├── journal.test.ts
        └── scripts.test.ts
```

---

## 前置：依赖安装

- [ ] **Step 1: 安装动画库**

```bash
cd manifest-diary
npm install framer-motion
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add framer-motion for UI animations"
```

---

## Task 1: 日期工具与流式解析器（纯函数，TDD）

**Files:**
- Create: `src/lib/date.ts`
- Create: `src/lib/ai/streaming-parser.ts`
- Create: `src/__tests__/lib/date.test.ts`
- Create: `src/__tests__/lib/streaming-parser.test.ts`

### 1.1 entry_date 计算

`entry_date` 的语义：用户在凌晨 0-5 点写的复盘归属"前一天"。

- [ ] **Step 1: 写 date.ts 测试**

创建 `src/__tests__/lib/date.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeEntryDate, computeScheduledFor, formatDateZh } from '@/lib/date';

describe('computeEntryDate', () => {
  it('returns today for normal evening time (e.g. 22:30)', () => {
    const t = new Date('2026-06-15T22:30:00+08:00');
    expect(computeEntryDate(t, 'Asia/Shanghai')).toBe('2026-06-15');
  });

  it('returns yesterday for early morning before 5am (e.g. 02:30)', () => {
    const t = new Date('2026-06-16T02:30:00+08:00');
    expect(computeEntryDate(t, 'Asia/Shanghai')).toBe('2026-06-15');
  });

  it('returns today for 05:00 sharp', () => {
    const t = new Date('2026-06-16T05:00:00+08:00');
    expect(computeEntryDate(t, 'Asia/Shanghai')).toBe('2026-06-16');
  });

  it('returns today for 04:59', () => {
    const t = new Date('2026-06-16T04:59:00+08:00');
    expect(computeEntryDate(t, 'Asia/Shanghai')).toBe('2026-06-15');
  });
});

describe('computeScheduledFor', () => {
  it('returns next day for evening reflection', () => {
    const entryDate = '2026-06-15';
    expect(computeScheduledFor(entryDate)).toBe('2026-06-16');
  });

  it('handles month rollover', () => {
    const entryDate = '2026-06-30';
    expect(computeScheduledFor(entryDate)).toBe('2026-07-01');
  });
});

describe('formatDateZh', () => {
  it('formats ISO date as Chinese', () => {
    expect(formatDateZh('2026-06-15')).toBe('2026年6月15日');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/__tests__/lib/date.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/date'"

- [ ] **Step 3: 实现 date.ts**

创建 `src/lib/date.ts`:

```typescript
/**
 * 用户在凌晨 0-5 点写的复盘归属前一天。
 * 返回 'YYYY-MM-DD' 格式（指定时区）。
 */
export function computeEntryDate(now: Date, timeZone: string): string {
  // 把时间转到目标时区的字符串，再解析
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;

  const y = parseInt(get('year'));
  const m = parseInt(get('month'));
  const d = parseInt(get('day'));
  const h = parseInt(get('hour'));

  if (h < 5) {
    // 减一天
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().split('T')[0];
  }
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * 给定 entry_date，返回它对应的 tomorrow_script.scheduled_for（即下一天）。
 */
export function computeScheduledFor(entryDate: string): string {
  const [y, m, d] = entryDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().split('T')[0];
}

/** 'YYYY-MM-DD' → '2026年6月15日' */
export function formatDateZh(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

/** 默认时区，统一用上海时区。 */
export const APP_TIMEZONE = 'Asia/Shanghai';
```

- [ ] **Step 4: 运行测试，确认全部通过**

```bash
npx vitest run src/__tests__/lib/date.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/date.ts src/__tests__/lib/date.test.ts
git commit -m "feat: add entry_date/scheduled_for date utilities with tests"
```

### 1.2 流式解析器

边接收边切分：在收到第一个 `{` 之前的内容算"接住层"，之后算 JSON。需要容忍 JSON 还没完整。

- [ ] **Step 6: 写 streaming-parser 测试**

创建 `src/__tests__/lib/streaming-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { StreamingReflectionParser } from '@/lib/ai/streaming-parser';

describe('StreamingReflectionParser', () => {
  it('emits empathy text incrementally before JSON arrives', () => {
    const parser = new StreamingReflectionParser();
    const states: { empathy: string; structured: any }[] = [];

    parser.append('凌晨三点');
    states.push({ ...parser.state });
    parser.append('你还能起来洗澡。');
    states.push({ ...parser.state });

    expect(states[0].empathy).toBe('凌晨三点');
    expect(states[0].structured).toBeNull();
    expect(states[1].empathy).toBe('凌晨三点你还能起来洗澡。');
    expect(states[1].structured).toBeNull();
  });

  it('parses structured JSON after empathy text', () => {
    const parser = new StreamingReflectionParser();
    parser.append('凌晨三点你还能起来洗澡。\n\n{');
    parser.append('"highlights":[],"cognitive_bugs":[],');
    parser.append('"tomorrow_script":[{"step":1,"action":"喝水","duration_minutes":1}]}');

    expect(parser.state.empathy).toBe('凌晨三点你还能起来洗澡。');
    expect(parser.state.structured).not.toBeNull();
    expect(parser.state.structured!.tomorrow_script).toHaveLength(1);
    expect(parser.state.structured!.tomorrow_script[0].action).toBe('喝水');
  });

  it('handles JSON wrapped in ```json fences', () => {
    const parser = new StreamingReflectionParser();
    parser.append('嗯，今天还行。\n\n```json\n');
    parser.append('{"highlights":[],"cognitive_bugs":[],"tomorrow_script":[]}\n```');

    expect(parser.state.empathy).toBe('嗯，今天还行。');
    expect(parser.state.structured).not.toBeNull();
  });

  it('keeps structured null when JSON is incomplete', () => {
    const parser = new StreamingReflectionParser();
    parser.append('嗯。\n\n{"highlights":[');
    expect(parser.state.empathy).toBe('嗯。');
    expect(parser.state.structured).toBeNull();
  });

  it('exposes finalize() to throw on incomplete final state', () => {
    const parser = new StreamingReflectionParser();
    parser.append('嗯。');
    expect(() => parser.finalize()).toThrow();
  });

  it('finalize() returns the full parsed reflection when complete', () => {
    const parser = new StreamingReflectionParser();
    parser.append('嗯。\n\n{"highlights":[],"cognitive_bugs":[],"tomorrow_script":[]}');
    const final = parser.finalize();
    expect(final.empathy).toBe('嗯。');
    expect(final.structured.highlights).toEqual([]);
  });
});
```

- [ ] **Step 7: 运行测试，确认失败**

```bash
npx vitest run src/__tests__/lib/streaming-parser.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 8: 实现 streaming-parser**

创建 `src/lib/ai/streaming-parser.ts`:

```typescript
import type { ReflectionStructured, ParsedReflection } from './parse-response';

interface StreamState {
  empathy: string;
  structured: ReflectionStructured | null;
}

export class StreamingReflectionParser {
  private buffer = '';
  public state: StreamState = { empathy: '', structured: null };

  append(chunk: string): void {
    this.buffer += chunk;
    this.recompute();
  }

  finalize(): ParsedReflection {
    if (!this.state.structured) {
      throw new Error('Stream ended before structured JSON was complete');
    }
    return {
      empathy: this.state.empathy,
      structured: this.state.structured,
    };
  }

  private recompute(): void {
    // Find where JSON starts: either ```json marker or first '{' after a '\n\n'
    const fenceIdx = this.buffer.indexOf('```json');
    let jsonStart = -1;

    if (fenceIdx !== -1) {
      jsonStart = this.buffer.indexOf('\n', fenceIdx) + 1;
      this.state.empathy = this.buffer.slice(0, fenceIdx).trim();
    } else {
      // Look for first '{' that comes after at least one newline (heuristic: JSON starts on its own block)
      const firstBrace = this.buffer.indexOf('{');
      if (firstBrace === -1) {
        this.state.empathy = this.buffer.trim();
        this.state.structured = null;
        return;
      }
      jsonStart = firstBrace;
      this.state.empathy = this.buffer.slice(0, firstBrace).trim();
    }

    // Try to parse JSON from jsonStart
    const remaining = this.buffer.slice(jsonStart);
    const closingFence = remaining.indexOf('```');
    const candidate = closingFence !== -1
      ? remaining.slice(0, closingFence).trim()
      : remaining.trim();

    try {
      const parsed = JSON.parse(candidate);
      // Validate basic shape
      if (
        Array.isArray(parsed.highlights) &&
        Array.isArray(parsed.cognitive_bugs) &&
        Array.isArray(parsed.tomorrow_script)
      ) {
        this.state.structured = parsed as ReflectionStructured;
      }
    } catch {
      // JSON not yet complete — keep structured as null
      this.state.structured = null;
    }
  }
}
```

- [ ] **Step 9: 运行测试，全部通过**

```bash
npx vitest run src/__tests__/lib/streaming-parser.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 10: Commit**

```bash
git add src/lib/ai/streaming-parser.ts src/__tests__/lib/streaming-parser.test.ts
git commit -m "feat: add incremental streaming parser for reflection responses"
```

---

## Task 2: 主题系统（CSS 变量 + Provider）

**Files:**
- Create: `src/components/theme/ThemeContext.ts`
- Create: `src/components/theme/ThemeProvider.tsx`
- Modify: `src/app/globals.css`（已有，扩展三套主题变量）

### 2.1 主题 Provider

- [ ] **Step 1: 创建 ThemeContext**

创建 `src/components/theme/ThemeContext.ts`:

```typescript
'use client';

import { createContext, useContext } from 'react';

export type Theme = 'night' | 'garden' | 'cosmos';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'night',
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 2: 创建 ThemeProvider**

创建 `src/components/theme/ThemeProvider.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { ThemeContext, type Theme } from './ThemeContext';

interface ThemeProviderProps {
  defaultTheme?: Theme;
  children: React.ReactNode;
}

export function ThemeProvider({ defaultTheme = 'night', children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * 根据当前小时返回默认主题：
 * - 06:00-09:00 → garden（早晨花园）
 * - 09:00-18:00 → garden（白天延续花园）
 * - 18:00-06:00 → night（夜晚暖光）
 * 显化页面单独切到 cosmos，由路由层覆盖。
 */
export function autoTheme(now: Date = new Date()): Theme {
  const h = now.getHours();
  if (h >= 6 && h < 18) return 'garden';
  return 'night';
}
```

- [ ] **Step 3: 扩展全局 CSS（三套主题已在 M1 写过基础，这里补全细节）**

修改 `src/app/globals.css`，在三个主题下补足 `--shadow`、`--bg-card-glow` 等高级变量。在文件末尾追加：

```css
/* 通用深度变量 */
[data-theme="night"] {
  --shadow-soft: 0 4px 24px rgba(0, 0, 0, 0.35);
  --shadow-glow: 0 0 32px rgba(244, 114, 182, 0.18);
  --bg-card-glow: rgba(254, 252, 232, 0.05);
  --noise-opacity: 0.03;
}

[data-theme="garden"] {
  --shadow-soft: 0 2px 16px rgba(34, 197, 94, 0.08);
  --shadow-glow: 0 0 24px rgba(244, 114, 182, 0.15);
  --bg-card-glow: rgba(255, 255, 255, 0.6);
  --noise-opacity: 0;
}

[data-theme="cosmos"] {
  --shadow-soft: 0 4px 32px rgba(67, 56, 202, 0.4);
  --shadow-glow: 0 0 40px rgba(244, 114, 182, 0.3);
  --bg-card-glow: rgba(49, 46, 129, 0.4);
  --noise-opacity: 0.04;
}

/* 顺滑切换 */
html {
  transition: background-color 0.4s ease;
}
html[data-theme] body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.4s ease, color 0.4s ease;
}

/* 玫瑰金渐变文字工具类 */
.text-rose-gold {
  background: var(--accent-rose-gold);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* 玫瑰金光晕边框 */
.glow-border {
  position: relative;
}
.glow-border::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: var(--accent-rose-gold);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0.6;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/theme src/app/globals.css
git commit -m "feat: add theme provider with night/garden/cosmos themes"
```

---

## Task 3: 受保护路由布局 + 导航

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/ui/NavBar.tsx`

- [ ] **Step 1: 创建受保护路由 layout**

创建 `src/app/(app)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { NavBar } from '@/components/ui/NavBar';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <ThemeProvider defaultTheme="night">
      <div
        className="min-h-screen"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        <NavBar userEmail={user.email!} />
        <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      </div>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: 创建 NavBar**

创建 `src/components/ui/NavBar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/browser';
import { useTheme } from '@/components/theme/ThemeContext';
import { autoTheme } from '@/components/theme/ThemeProvider';

interface NavBarProps {
  userEmail: string;
}

export function NavBar({ userEmail }: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // 路由感知的主题切换
  useEffect(() => {
    if (pathname.startsWith('/manifest')) {
      setTheme('cosmos');
    } else if (pathname.startsWith('/reflect')) {
      setTheme('night');
    } else {
      setTheme(autoTheme());
    }
  }, [pathname, setTheme]);

  const handleSignOut = async () => {
    const sb = createBrowserClient();
    await sb.auth.signOut();
    router.push('/login');
  };

  const link = (href: string, label: string) => (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-full text-sm transition-opacity"
      style={{
        backgroundColor: pathname === href ? 'var(--bg-card-glow)' : 'transparent',
        color: pathname === href ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      {label}
    </Link>
  );

  return (
    <nav
      className="border-b backdrop-blur-md sticky top-0 z-30"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-rose-gold font-medium tracking-wider text-sm">
            ✦ MANIFEST DIARY
          </span>
        </div>
        <div className="flex items-center gap-1">
          {link('/', '今日')}
          {link('/reflect', '复盘')}
          {link('/manifest', '显化')}
          {link('/history', '日历')}
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          {userEmail.split('@')[0]} ↗
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: 把首页和反思页移到 (app) 路由组**

由于 M1 的 `src/app/page.tsx` 已经存在并做了登录跳转，把它替换为 `src/app/(app)/page.tsx`，同时删除原来的 `src/app/page.tsx`。

```bash
git mv src/app/page.tsx src/app/\(app\)/page.tsx
```

如果重命名报错（路径有特殊符号），删除原文件并直接新建即可。

- [ ] **Step 4: 替换首页内容（占位，后面 Task 6 重写）**

`src/app/(app)/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <div className="text-center py-12">
      <h1 className="text-2xl font-light" style={{ color: 'var(--text-primary)' }}>
        晚上好 ✨
      </h1>
      <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
        准备好今晚的复盘了吗？
      </p>
    </div>
  );
}
```

- [ ] **Step 5: 启动开发服务器并验证**

```bash
npm run dev
```

打开 `http://localhost:3000`，确认：
- 未登录跳转 /login
- 登录后看到顶部 NavBar
- 点击「显化」时主题应切到 cosmos（即使页面还没做，背景色应该变了）
- 点击「复盘」时切回 night

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add protected route layout with theme-aware navigation"
```

---

## Task 4: 长段语音输入 Hook 与按钮

**Files:**
- Create: `src/components/voice/useVoiceRecorder.ts`
- Create: `src/components/voice/VoiceButton.tsx`

### 4.1 语音录入 Hook

- [ ] **Step 1: 创建 useVoiceRecorder hook**

创建 `src/components/voice/useVoiceRecorder.ts`:

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Web Speech API 类型在 TS 默认 lib 里只有部分覆盖，这里补充
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

export interface VoiceRecorderState {
  isRecording: boolean;
  finalTranscript: string;   // 已确认的文本，会持续累加
  interimTranscript: string; // 当前正在识别的部分
  error: string | null;
  isSupported: boolean;
}

export interface VoiceRecorderControls {
  start: () => void;
  stop: () => void;
  clear: () => void;
}

export function useVoiceRecorder(lang = 'zh-CN'): VoiceRecorderState & VoiceRecorderControls {
  const [isRecording, setIsRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isManuallyStopped = useRef(false);

  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const createRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.continuous = true;       // 关键 1：不要在停顿时自动结束
    rec.interimResults = true;   // 关键 2：边说边显示
    rec.lang = lang;
    return rec;
  }, [lang]);

  const start = useCallback(() => {
    if (!isSupported) {
      setError('当前浏览器不支持语音识别');
      return;
    }

    setError(null);
    isManuallyStopped.current = false;

    const rec = createRecognition();
    if (!rec) {
      setError('无法初始化语音识别');
      return;
    }

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalDelta = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) finalDelta += transcript;
        else interim += transcript;
      }
      if (finalDelta) {
        setFinalTranscript((prev) => prev + finalDelta);
      }
      setInterimTranscript(interim);
    };

    rec.onerror = (event: Event) => {
      const err = (event as unknown as { error?: string }).error || 'unknown';
      // 'no-speech' 是正常停顿，不报错
      if (err !== 'no-speech' && err !== 'aborted') {
        setError(`录音错误：${err}`);
      }
    };

    rec.onend = () => {
      // 关键 3：心跳保活——浏览器会自动断开 continuous 会话，这里自动重连
      if (!isManuallyStopped.current) {
        try {
          rec.start();
        } catch {
          // 极小概率重连失败
          setIsRecording(false);
        }
      } else {
        setIsRecording(false);
        setInterimTranscript('');
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setIsRecording(true);
    } catch (e) {
      setError(`启动失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }, [createRecognition, isSupported]);

  const stop = useCallback(() => {
    isManuallyStopped.current = true;
    recognitionRef.current?.stop();
  }, []);

  const clear = useCallback(() => {
    setFinalTranscript('');
    setInterimTranscript('');
  }, []);

  // 卸载时清理
  useEffect(() => {
    return () => {
      isManuallyStopped.current = true;
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    isRecording,
    finalTranscript,
    interimTranscript,
    error,
    isSupported,
    start,
    stop,
    clear,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/voice/useVoiceRecorder.ts
git commit -m "feat: add long-form voice recorder hook with auto-restart"
```

### 4.2 语音按钮组件

- [ ] **Step 3: 创建 VoiceButton**

创建 `src/components/voice/VoiceButton.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';

interface VoiceButtonProps {
  isRecording: boolean;
  isSupported: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function VoiceButton({ isRecording, isSupported, onStart, onStop }: VoiceButtonProps) {
  if (!isSupported) {
    return (
      <button
        disabled
        title="当前浏览器不支持语音识别"
        className="w-12 h-12 rounded-full flex items-center justify-center opacity-30 cursor-not-allowed"
        style={{ borderColor: 'var(--border)', borderWidth: 1 }}
      >
        🎤
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={isRecording ? onStop : onStart}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="w-12 h-12 rounded-full flex items-center justify-center relative"
      style={{
        background: isRecording ? 'var(--accent-rose-gold)' : 'transparent',
        borderColor: 'var(--border)',
        borderWidth: 1,
      }}
      title={isRecording ? '点击停止录音（说多久都行）' : '点击开始语音输入（不会因停顿断开）'}
    >
      <span className="text-xl">{isRecording ? '⏸' : '🎤'}</span>
      {isRecording && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: 'var(--accent-rose-gold)' }}
          animate={{ opacity: [0.6, 0.2, 0.6], scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/voice/VoiceButton.tsx
git commit -m "feat: add voice recorder button with pulsing recording indicator"
```

---

## Task 5: 复盘页 UI 与三件套渲染

**Files:**
- Create: `src/components/reflection/ReflectionInput.tsx`
- Create: `src/components/reflection/EmpathyBubble.tsx`
- Create: `src/components/reflection/HighlightCard.tsx`
- Create: `src/components/reflection/BugCard.tsx`
- Create: `src/components/reflection/ScriptCard.tsx`
- Create: `src/app/(app)/reflect/page.tsx`

### 5.1 输入组件

- [ ] **Step 1: 创建 ReflectionInput**

创建 `src/components/reflection/ReflectionInput.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useVoiceRecorder } from '@/components/voice/useVoiceRecorder';
import { VoiceButton } from '@/components/voice/VoiceButton';

interface ReflectionInputProps {
  onSubmit: (text: string, inputMethod: 'voice' | 'text' | 'mixed') => void;
  disabled?: boolean;
}

export function ReflectionInput({ onSubmit, disabled }: ReflectionInputProps) {
  const [text, setText] = useState('');
  const [usedVoice, setUsedVoice] = useState(false);
  const [usedText, setUsedText] = useState(false);

  const voice = useVoiceRecorder('zh-CN');

  // 录音得到的文本流入文本框
  useEffect(() => {
    if (voice.finalTranscript) {
      setText((prev) => {
        const sep = prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : '';
        const next = prev + sep + voice.finalTranscript;
        return next;
      });
      voice.clear();
      setUsedVoice(true);
    }
  }, [voice.finalTranscript, voice]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setUsedText(true);
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    const method: 'voice' | 'text' | 'mixed' =
      usedVoice && usedText ? 'mixed' : usedVoice ? 'voice' : 'text';
    onSubmit(text, method);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <textarea
          value={text + (voice.interimTranscript ? ` ${voice.interimTranscript}` : '')}
          onChange={handleTextChange}
          placeholder="说一段也行、打字也行——把今天倒在这里。
不用整齐，不用客观，骂自己也行。"
          disabled={disabled}
          rows={10}
          className="w-full p-4 rounded-2xl resize-none focus:outline-none transition-colors"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border)',
            borderWidth: 1,
            fontFamily: 'inherit',
            lineHeight: 1.7,
          }}
        />
        {voice.interimTranscript && (
          <div
            className="absolute bottom-3 right-3 text-xs px-2 py-1 rounded-full"
            style={{ background: 'var(--accent-rose-gold)', color: 'var(--bg-primary)' }}
          >
            正在听...
          </div>
        )}
      </div>

      {voice.error && (
        <p className="text-xs" style={{ color: 'var(--accent-rose)' }}>
          {voice.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <VoiceButton
          isRecording={voice.isRecording}
          isSupported={voice.isSupported}
          onStart={voice.start}
          onStop={voice.stop}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className="flex-1 py-3 rounded-full font-medium transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent-rose-gold)', color: '#1a1a2e' }}
        >
          ✨ 让 AI 梳理
        </button>
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
        🎤 长按支持 10+ 分钟连续语音 · 中途沉默不会断开
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reflection/ReflectionInput.tsx
git commit -m "feat: add reflection input component with voice + text"
```

### 5.2 接住层气泡

- [ ] **Step 3: 创建 EmpathyBubble**

创建 `src/components/reflection/EmpathyBubble.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';

interface EmpathyBubbleProps {
  text: string;
  isStreaming?: boolean;
}

export function EmpathyBubble({ text, isStreaming }: EmpathyBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glow-border relative p-5 rounded-3xl"
      style={{
        backgroundColor: 'var(--bg-card-glow)',
        boxShadow: 'var(--shadow-glow)',
      }}
    >
      <p
        className="text-base leading-relaxed"
        style={{ color: 'var(--text-primary)' }}
      >
        {text}
        {isStreaming && (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="inline-block w-2 h-4 ml-1 align-middle"
            style={{ background: 'var(--accent)' }}
          />
        )}
      </p>
    </motion.div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/reflection/EmpathyBubble.tsx
git commit -m "feat: add empathy bubble with rose-gold glow"
```

### 5.3 三张结构卡片

- [ ] **Step 5: 创建 HighlightCard**

创建 `src/components/reflection/HighlightCard.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import type { Highlight } from '@/lib/ai/parse-response';

interface HighlightCardProps {
  highlights: Highlight[];
  index?: number;
}

export function HighlightCard({ highlights, index = 0 }: HighlightCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="rounded-3xl p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        color: '#5d4e37',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <h3 className="text-xs tracking-widest uppercase mb-3" style={{ color: '#c9a96e' }}>
        ✦ 今日高光
      </h3>
      {highlights.length === 0 ? (
        <p className="text-sm" style={{ color: '#9b8b75' }}>
          今天能撑过来本身就是一种高光。
        </p>
      ) : (
        <ul className="space-y-3">
          {highlights.map((h, i) => (
            <li key={i}>
              <p className="font-medium">{h.fact}</p>
              <p className="text-sm mt-1" style={{ color: '#9b8b75' }}>
                {h.why_it_counts}
              </p>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
```

- [ ] **Step 6: 创建 BugCard**

创建 `src/components/reflection/BugCard.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import type { CognitiveBug } from '@/lib/ai/parse-response';

interface BugCardProps {
  bugs: CognitiveBug[];
  index?: number;
}

export function BugCard({ bugs, index = 0 }: BugCardProps) {
  if (bugs.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="rounded-3xl p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        color: '#5d4e37',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <h3 className="text-xs tracking-widest uppercase mb-3" style={{ color: '#d4956a' }}>
        🔍 心理 Bug 诊断
      </h3>
      <ul className="space-y-4">
        {bugs.map((b, i) => (
          <li key={i}>
            <p className="text-sm italic" style={{ color: '#9b8b75' }}>
              「{b.user_quote}」
            </p>
            <p className="mt-2">{b.reframe}</p>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
```

- [ ] **Step 7: 创建 ScriptCard（可编辑）**

创建 `src/components/reflection/ScriptCard.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { TomorrowStep } from '@/lib/ai/parse-response';

interface ScriptCardProps {
  steps: TomorrowStep[];
  index?: number;
  onChange?: (steps: TomorrowStep[]) => void;
  readOnly?: boolean;
}

export function ScriptCard({ steps, index = 0, onChange, readOnly }: ScriptCardProps) {
  const [localSteps, setLocalSteps] = useState(steps);

  useEffect(() => {
    setLocalSteps(steps);
  }, [steps]);

  const updateAction = (idx: number, value: string) => {
    const next = localSteps.map((s, i) => (i === idx ? { ...s, action: value } : s));
    setLocalSteps(next);
    onChange?.(next);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="rounded-3xl p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        color: '#5d4e37',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <h3 className="text-xs tracking-widest uppercase mb-3" style={{ color: '#7d9d7c' }}>
        📋 明早无脑脚本
      </h3>
      <ol className="space-y-3">
        {localSteps.map((s, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
              style={{ background: '#7d9d7c', color: 'white' }}
            >
              {s.step}
            </span>
            {readOnly ? (
              <span className="flex-1 leading-relaxed">{s.action}</span>
            ) : (
              <input
                type="text"
                value={s.action}
                onChange={(e) => updateAction(i, e.target.value)}
                className="flex-1 bg-transparent border-b focus:outline-none focus:border-b-2 leading-relaxed"
                style={{ borderColor: 'rgba(125,157,124,0.3)', color: '#5d4e37' }}
              />
            )}
            <span className="text-xs" style={{ color: '#9b8b75' }}>
              {s.duration_minutes}分钟
            </span>
          </li>
        ))}
      </ol>
    </motion.section>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/reflection
git commit -m "feat: add highlight, bug, and script cards with animations"
```

### 5.4 复盘页面集成

- [ ] **Step 9: 创建 reflect 页面**

创建 `src/app/(app)/reflect/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReflectionInput } from '@/components/reflection/ReflectionInput';
import { EmpathyBubble } from '@/components/reflection/EmpathyBubble';
import { HighlightCard } from '@/components/reflection/HighlightCard';
import { BugCard } from '@/components/reflection/BugCard';
import { ScriptCard } from '@/components/reflection/ScriptCard';
import { StreamingReflectionParser } from '@/lib/ai/streaming-parser';
import type { ReflectionStructured, TomorrowStep } from '@/lib/ai/parse-response';

export default function ReflectPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'streaming' | 'editing' | 'saving'>('idle');
  const [empathy, setEmpathy] = useState('');
  const [structured, setStructured] = useState<ReflectionStructured | null>(null);
  const [rawInput, setRawInput] = useState('');
  const [inputMethod, setInputMethod] = useState<'voice' | 'text' | 'mixed'>('text');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (text: string, method: 'voice' | 'text' | 'mixed') => {
    setRawInput(text);
    setInputMethod(method);
    setPhase('streaming');
    setError(null);
    setEmpathy('');
    setStructured(null);

    const parser = new StreamingReflectionParser();

    try {
      const res = await fetch('/api/ai/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: text }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`API error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              parser.append(parsed.content);
              setEmpathy(parser.state.empathy);
              setStructured(parser.state.structured);
            }
            if (parsed.error) throw new Error(parsed.error);
          } catch (parseErr) {
            // 流中间的非数据行忽略
          }
        }
      }

      setPhase('editing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('idle');
    }
  };

  const handleSave = async () => {
    if (!structured) return;
    setPhase('saving');
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawInput,
          inputMethod,
          aiResponse: empathy,
          aiStructured: structured,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Save failed');
      }

      router.push('/?saved=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setPhase('editing');
    }
  };

  const updateScript = (steps: TomorrowStep[]) => {
    if (!structured) return;
    setStructured({ ...structured, tomorrow_script: steps });
  };

  return (
    <div className="space-y-6">
      <header className="text-center pt-4">
        <h1 className="text-2xl font-light" style={{ color: 'var(--text-primary)' }}>
          今夜，先深呼吸
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          说也行，写也行——它会接住你
        </p>
      </header>

      {phase === 'idle' && (
        <ReflectionInput onSubmit={handleSubmit} />
      )}

      {phase !== 'idle' && (
        <div className="space-y-4">
          {empathy && <EmpathyBubble text={empathy} isStreaming={phase === 'streaming'} />}
          {structured && (
            <>
              <HighlightCard highlights={structured.highlights} index={0} />
              <BugCard bugs={structured.cognitive_bugs} index={1} />
              <ScriptCard
                steps={structured.tomorrow_script}
                index={2}
                onChange={updateScript}
                readOnly={phase !== 'editing'}
              />
            </>
          )}

          {phase === 'editing' && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setPhase('idle');
                  setEmpathy('');
                  setStructured(null);
                }}
                className="flex-1 py-3 rounded-full"
                style={{
                  borderColor: 'var(--border)',
                  borderWidth: 1,
                  color: 'var(--text-secondary)',
                }}
              >
                重新写
              </button>
              <button
                onClick={handleSave}
                className="flex-[2] py-3 rounded-full font-medium"
                style={{ background: 'var(--accent-rose-gold)', color: '#1a1a2e' }}
              >
                ✨ 保存今晚的复盘
              </button>
            </div>
          )}
          {phase === 'saving' && (
            <p className="text-center" style={{ color: 'var(--text-secondary)' }}>
              正在保存...
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-center" style={{ color: 'var(--accent-rose)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 10: 启动开发服务器，端到端验证**

```bash
npm run dev
```

打开 `http://localhost:3000/reflect`：
- 输入一段话 / 用语音说一段
- 点「让 AI 梳理」
- 接住层先出现，然后三张卡片依次浮现
- 修改脚本中的某一步动作
- 点「保存」会跳到 `/`（保存接口下个 Task 实现，这一步可能报 404，是预期）

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add full reflection page with streaming render and editable script"
```

---

## Task 6: Journal CRUD API

**Files:**
- Create: `src/app/api/journal/route.ts`
- Create: `src/lib/ai/recent-context.ts`
- Create: `src/__tests__/api/journal.test.ts`
- Create: `src/__tests__/lib/recent-context.test.ts`

### 6.1 最近上下文摘要（动态注入 prompt）

- [ ] **Step 1: 写测试**

创建 `src/__tests__/lib/recent-context.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { summarizeRecentEntries } from '@/lib/ai/recent-context';

describe('summarizeRecentEntries', () => {
  it('returns empty string for no entries', () => {
    expect(summarizeRecentEntries([])).toBe('');
  });

  it('summarizes 3 recent entries with date and key facts', () => {
    const entries = [
      {
        entry_date: '2026-06-13',
        ai_structured: {
          highlights: [{ fact: '跑了 3km', why_it_counts: '' }],
          cognitive_bugs: [],
          tomorrow_script: [],
        },
      },
      {
        entry_date: '2026-06-14',
        ai_structured: {
          highlights: [{ fact: '看了书', why_it_counts: '' }],
          cognitive_bugs: [{ type: 'all_or_nothing', user_quote: '我废了', reframe: '' }],
          tomorrow_script: [],
        },
      },
    ];

    const result = summarizeRecentEntries(entries);
    expect(result).toContain('2026-06-13');
    expect(result).toContain('跑了 3km');
    expect(result).toContain('2026-06-14');
    expect(result).toContain('看了书');
    expect(result).toContain('all_or_nothing');
  });
});
```

- [ ] **Step 2: 实现**

创建 `src/lib/ai/recent-context.ts`:

```typescript
import type { ReflectionStructured } from './parse-response';

export interface RecentEntry {
  entry_date: string;
  ai_structured: ReflectionStructured | null;
}

/**
 * 把最近 3 天的记录摘成短上下文，给 AI 做个性化参考。
 */
export function summarizeRecentEntries(entries: RecentEntry[]): string {
  if (entries.length === 0) return '';

  const lines = entries.map((e) => {
    if (!e.ai_structured) return `- ${e.entry_date}：（未处理）`;
    const facts = e.ai_structured.highlights.map((h) => h.fact).join('、') || '无明显高光';
    const bugs = e.ai_structured.cognitive_bugs.map((b) => b.type).join('、') || '无';
    return `- ${e.entry_date}：高光 [${facts}]；认知 bug [${bugs}]`;
  });

  return ['用户最近 3 天的记录摘要：', ...lines].join('\n');
}
```

- [ ] **Step 3: 跑测试，全部通过**

```bash
npx vitest run src/__tests__/lib/recent-context.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/recent-context.ts src/__tests__/lib/recent-context.test.ts
git commit -m "feat: add recent context summarizer for AI prompt injection"
```

### 6.2 Journal API Route

- [ ] **Step 5: 创建 journal API**

创建 `src/app/api/journal/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeEntryDate, computeScheduledFor, APP_TIMEZONE } from '@/lib/date';
import type { ReflectionStructured } from '@/lib/ai/parse-response';

interface CreateBody {
  rawInput: string;
  inputMethod: 'voice' | 'text' | 'mixed';
  aiResponse: string;
  aiStructured: ReflectionStructured;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as CreateBody;
  if (!body.rawInput?.trim() || !body.aiStructured) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const entryDate = computeEntryDate(new Date(), APP_TIMEZONE);

  // 1) 写入 journal_entries
  const { data: journal, error: journalErr } = await supabase
    .from('journal_entries')
    .insert({
      user_id: user.id,
      entry_date: entryDate,
      raw_input: body.rawInput,
      input_method: body.inputMethod,
      ai_response: body.aiResponse,
      ai_structured: body.aiStructured,
      status: 'finalized',
    })
    .select()
    .single();

  if (journalErr || !journal) {
    return NextResponse.json({ error: journalErr?.message || 'insert failed' }, { status: 500 });
  }

  // 2) 把 tomorrow_script 拆出来写入 tomorrow_scripts
  const scheduledFor = computeScheduledFor(entryDate);
  const stepsWithCompleted = body.aiStructured.tomorrow_script.map((s) => ({
    ...s,
    completed_at: null,
  }));

  const { error: scriptErr } = await supabase.from('tomorrow_scripts').insert({
    user_id: user.id,
    source_entry_id: journal.id,
    scheduled_for: scheduledFor,
    steps: stepsWithCompleted,
  });

  if (scriptErr) {
    // journal 写入成功，script 失败不算致命
    return NextResponse.json(
      { id: journal.id, warning: `script create failed: ${scriptErr.message}` },
      { status: 201 }
    );
  }

  return NextResponse.json({ id: journal.id, scheduledFor }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get('date');

  let query = supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false });

  if (date) query = query.eq('entry_date', date);
  else query = query.limit(30);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data });
}
```

- [ ] **Step 6: 端到端测试 — 完整走一遍**

```bash
npm run dev
```

1. 登录账号
2. 打开 /reflect，输入文字 → 让 AI 梳理 → 编辑脚本 → 保存
3. 跳转回 / 应该看到 `?saved=1`（首页待 Task 7 实现）
4. 在 Supabase Dashboard → Table Editor → `journal_entries`，确认刚才那条记录写入成功
5. 在 `tomorrow_scripts`，确认脚本写入了，`scheduled_for` 是明天

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add journal POST/GET endpoints with auto tomorrow_scripts creation"
```

---

## Task 7: 早晨脚本视图（首页）

**Files:**
- Create: `src/app/api/scripts/route.ts`
- Create: `src/app/api/scripts/[id]/steps/[stepIdx]/route.ts`
- Create: `src/components/morning/MorningGreeting.tsx`
- Create: `src/components/morning/ScriptStepRow.tsx`
- Create: `src/components/morning/EmptyState.tsx`
- Modify: `src/app/(app)/page.tsx`（彻底重写）

### 7.1 Scripts API

- [ ] **Step 1: 创建 scripts list API**

创建 `src/app/api/scripts/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeEntryDate, APP_TIMEZONE } from '@/lib/date';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const today = url.searchParams.get('date') || computeEntryDate(new Date(), APP_TIMEZONE);

  const { data, error } = await supabase
    .from('tomorrow_scripts')
    .select('*')
    .eq('user_id', user.id)
    .eq('scheduled_for', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ script: data });
}
```

- [ ] **Step 2: 创建 step 勾选 API**

创建 `src/app/api/scripts/[id]/steps/[stepIdx]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface PatchBody {
  completed: boolean;
}

interface Step {
  step: number;
  action: string;
  duration_minutes: number;
  completed_at: string | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepIdx: string }> }
) {
  const { id, stepIdx } = await params;
  const idx = parseInt(stepIdx);
  if (isNaN(idx)) return NextResponse.json({ error: 'invalid step index' }, { status: 400 });

  const body = (await req.json()) as PatchBody;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 读取当前 script
  const { data: script, error: readErr } = await supabase
    .from('tomorrow_scripts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (readErr || !script) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const steps = script.steps as Step[];
  if (idx < 0 || idx >= steps.length) {
    return NextResponse.json({ error: 'step out of range' }, { status: 400 });
  }

  steps[idx] = { ...steps[idx], completed_at: body.completed ? new Date().toISOString() : null };

  const allDone = steps.every((s) => s.completed_at !== null);

  const { error: updateErr } = await supabase
    .from('tomorrow_scripts')
    .update({
      steps,
      completed_at: allDone ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, allDone });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/scripts
git commit -m "feat: add scripts API with per-step toggle"
```

### 7.2 Morning UI

- [ ] **Step 4: 创建 MorningGreeting**

创建 `src/components/morning/MorningGreeting.tsx`:

```tsx
'use client';

interface MorningGreetingProps {
  hasScript: boolean;
  date: string;
}

export function MorningGreeting({ hasScript, date }: MorningGreetingProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 9 ? '早安' : hour < 18 ? '下午好' : '晚上好';

  return (
    <header className="text-center py-6">
      <p className="text-xs tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        {date}
      </p>
      <h1
        className="text-3xl font-light mt-2"
        style={{ color: 'var(--text-primary)', fontFamily: 'serif' }}
      >
        {greeting}，今天是你的一天 ✨
      </h1>
      {hasScript && (
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          昨晚的你给今天的你留了几步路
        </p>
      )}
    </header>
  );
}
```

- [ ] **Step 5: 创建 ScriptStepRow**

创建 `src/components/morning/ScriptStepRow.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface ScriptStepRowProps {
  scriptId: string;
  stepIdx: number;
  step: number;
  action: string;
  durationMin: number;
  initiallyDone: boolean;
}

export function ScriptStepRow({
  scriptId,
  stepIdx,
  step,
  action,
  durationMin,
  initiallyDone,
}: ScriptStepRowProps) {
  const [done, setDone] = useState(initiallyDone);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    const next = !done;
    setDone(next);
    setPending(true);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/steps/${stepIdx}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: next }),
      });
      if (!res.ok) {
        setDone(!next);
      }
    } catch {
      setDone(!next);
    } finally {
      setPending(false);
    }
  };

  return (
    <motion.button
      onClick={toggle}
      disabled={pending}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-opacity"
      style={{
        backgroundColor: 'var(--bg-card)',
        opacity: done ? 0.5 : 1,
        boxShadow: 'var(--shadow-soft)',
        color: '#5d4e37',
      }}
    >
      <span
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all"
        style={{
          background: done ? '#7d9d7c' : 'transparent',
          color: done ? 'white' : '#7d9d7c',
          borderColor: '#7d9d7c',
          borderWidth: 2,
        }}
      >
        {done ? '✓' : step}
      </span>
      <span className={`flex-1 ${done ? 'line-through' : ''}`}>{action}</span>
      <span className="text-xs" style={{ color: '#9b8b75' }}>
        {durationMin} 分钟
      </span>
    </motion.button>
  );
}
```

- [ ] **Step 6: 创建 EmptyState**

创建 `src/components/morning/EmptyState.tsx`:

```tsx
'use client';

import Link from 'next/link';

export function EmptyState() {
  return (
    <div className="text-center py-12 space-y-4">
      <p style={{ color: 'var(--text-secondary)' }}>
        昨晚没写复盘，今天没有为你准备的脚本。
      </p>
      <Link
        href="/reflect"
        className="inline-block px-6 py-3 rounded-full font-medium"
        style={{ background: 'var(--accent-rose-gold)', color: '#1a1a2e' }}
      >
        ✨ 现在写一段
      </Link>
    </div>
  );
}
```

- [ ] **Step 7: 重写首页**

替换 `src/app/(app)/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { computeEntryDate, formatDateZh, APP_TIMEZONE } from '@/lib/date';
import { MorningGreeting } from '@/components/morning/MorningGreeting';
import { ScriptStepRow } from '@/components/morning/ScriptStepRow';
import { EmptyState } from '@/components/morning/EmptyState';

interface Step {
  step: number;
  action: string;
  duration_minutes: number;
  completed_at: string | null;
}

export default async function HomePage() {
  const supabase = await createClient();
  const today = computeEntryDate(new Date(), APP_TIMEZONE);

  const { data: script } = await supabase
    .from('tomorrow_scripts')
    .select('*')
    .eq('scheduled_for', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const steps = (script?.steps as Step[] | undefined) ?? [];

  return (
    <div>
      <MorningGreeting hasScript={steps.length > 0} date={formatDateZh(today)} />
      {steps.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3 max-w-xl mx-auto">
          {steps.map((s, i) => (
            <ScriptStepRow
              key={i}
              scriptId={script!.id}
              stepIdx={i}
              step={s.step}
              action={s.action}
              durationMin={s.duration_minutes}
              initiallyDone={s.completed_at !== null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: 端到端验证完整夜→晨流程**

```bash
npm run dev
```

1. 登录
2. 去 `/reflect` 写一段复盘并保存
3. **手动改数据库**：把 `tomorrow_scripts.scheduled_for` 改成今天日期（因为脚本默认是写给"明天"的）
4. 回到 `/` 应看到脚本步骤列表
5. 勾选某一步 → 应被划去并打上对勾
6. 刷新页面 → 勾选状态保留

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add morning home page with script step checkbox"
```

---

## M3 完成标准

- [x] `npm run dev` 跑通完整夜→晨流程
- [x] 长段语音输入支持 10+ 分钟，中途沉默不断
- [x] 流式渲染：接住层先出，三张卡片依次浮现
- [x] 脚本可编辑，保存后写入 `journal_entries` + `tomorrow_scripts`
- [x] 早晨首页展示昨晚生成的脚本
- [x] 步骤勾选持久化
- [x] 主题按路由自动切（夜晚/花园/星空）
- [x] 所有单元测试通过

