# Manifest Diary 视觉重做实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把项目视觉从 deepseek 版的"功能化玫瑰金"重做为 glm-5.2 版的"暖光金 + 深紫天鹅绒贵气"治愈系，只改视觉与交互层，不动数据模型与 AI prompt。

**Architecture:** 用 CSS 变量重写 `globals.css` 的配色系统（暖夜底 + 深紫底 + 暖光金三套），简化 ThemeProvider 为 night(默认) / cosmos(显化页) 两个主题。逐页重做视觉：登录极简留白、首页时间问候、复盘三件套错落浮现、显化贵气金+深紫。动效用已有 Framer Motion + CSS 关键帧。

**Tech Stack:** Next.js 16 App Router, TailwindCSS v4 (@theme), Framer Motion, CSS 变量

**Spec:** [`docs/superpowers/specs/2026-06-16-visual-redesign-design.md`](../specs/2026-06-16-visual-redesign-design.md)

---

## 文件结构

```
src/
├─ app/
│  ├─ globals.css              # 重写配色系统：暖夜/深紫/暖光金
│  ├─ layout.tsx               # 根 layout：移除外部字体依赖（若残留），暖夜底
│  ├─ login/page.tsx           # 重做：极简留白 + 金色开始按钮
│  └─ (app)/
│     ├─ layout.tsx            # 暖夜底 + 台灯光晕背景层
│     ├─ page.tsx              # 重做首页：时间问候 + 脚本卡金描边
│     ├─ reflect/page.tsx      # 重做：三件套错落浮现 + 接住层光晕
│     └─ manifest/page.tsx     # 重做：深紫天鹅绒 + 金尘 + 贵气仪式
├─ components/
│  ├─ theme/ThemeProvider.tsx  # 简化为 night/cosmos 两主题
│  ├─ ui/
│  │  ├─ GoldButton.tsx        # 通用金渐变按钮（hover上浮+press光波）
│  │  ├─ NavBar.tsx            # 重做：暖夜 + 金色品牌字
│  │  └─ LampGlow.tsx          # 台灯暖光背景层（固定定位）
│  ├─ reflection/
│  │  ├─ EmpathyBubble.tsx     # 接住层：暖光金光晕呼吸 + 打字光标
│  │  ├─ HighlightCard.tsx     # 暖夜卡片 + 金描边
│  │  ├─ BugCard.tsx           # 暖夜卡片 + 金描边
│  │  └─ ScriptCard.tsx        # 暖夜卡片 + 金描边 + 可编辑
│  └─ manifest/
│     └─ GoldStardust.tsx      # 金尘缓慢上浮粒子（替换 StarfieldBackground）
└─ lib/
   └─ time-greeting.ts         # 已存在，本计划复用，不重写
```

---

## Task 1: 重写 globals.css 配色系统

**Files:**
- Modify: `src/app/globals.css`（整体替换）

- [ ] **Step 1: 用暖光金 + 深紫 + 暖夜三套配色重写 globals.css**

整体替换 `src/app/globals.css` 为：

```css
@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600&display=swap");

@import "tailwindcss";

@theme {
  /* 暖光金（全站点缀主色） */
  --color-gold: #d4af37;
  --color-gold-bright: #f5d77a;
  --color-gold-soft: rgba(212, 175, 55, 0.15);

  --font-sans: "Noto Sans SC", "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", system-ui, sans-serif;
  --font-serif: "Noto Serif SC", "Source Han Serif SC", "Songti SC",
    "STSong", Georgia, serif;

  --animate-fade-in: fadeIn 0.6s ease-out forwards;
  --animate-fade-up: fadeUp 0.5s ease-out forwards;
  --animate-breathe: breathe 4s ease-in-out infinite;
  --animate-glow-pulse: glowPulse 2.5s ease-in-out infinite;
  --animate-shimmer: shimmer 2.4s linear infinite;
  --animate-gold-rise: goldRise 8s linear infinite;

  @keyframes fadeIn {
    0% { opacity: 0; transform: translateY(8px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeUp {
    0% { opacity: 0; transform: translateY(16px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes breathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.015); }
  }
  @keyframes glowPulse {
    0%, 100% {
      box-shadow: 0 0 12px rgba(212, 175, 55, 0.25), 0 0 24px rgba(245, 215, 122, 0.12);
    }
    50% {
      box-shadow: 0 0 22px rgba(212, 175, 55, 0.55), 0 0 44px rgba(245, 215, 122, 0.28);
    }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes goldRise {
    0% { transform: translateY(0); opacity: 0; }
    20% { opacity: 0.8; }
    100% { transform: translateY(-120px); opacity: 0; }
  }
}

/* ─── 暖夜主题（默认，首页/复盘/历史/登录）─── */
:root,
[data-theme="night"] {
  --bg-primary: #15100c;
  --bg-gradient: radial-gradient(ellipse at 30% 15%, #3a2a1f 0%, #241a13 42%, #15100c 100%);
  --bg-card: #1f1812;
  --bg-card-glow: rgba(245, 166, 35, 0.04);
  --lamp-glow: radial-gradient(circle, rgba(245, 166, 35, 0.30) 0%, rgba(245, 166, 35, 0.06) 42%, transparent 72%);
  --text-primary: #f5e6d3;
  --text-secondary: #9b8b75;
  --text-muted: #7a6b5a;
  --border-soft: rgba(245, 230, 211, 0.16);
  --border-gold: rgba(212, 175, 55, 0.4);
  --gold-gradient: linear-gradient(135deg, #d4af37, #f5d77a, #d4af37);
  --gold-solid: #d4af37;
  --gold-bright: #f5d77a;
  --shadow-soft: 0 4px 24px rgba(0, 0, 0, 0.4);
  --shadow-glow: 0 0 28px rgba(212, 175, 55, 0.18);
}

/* ─── 深紫天鹅绒主题（显化页专用）─── */
[data-theme="cosmos"] {
  --bg-primary: #180f28;
  --bg-gradient: linear-gradient(160deg, #2d1b3d 0%, #1f1430 60%, #180f28 100%);
  --bg-card: rgba(45, 27, 61, 0.6);
  --bg-card-glow: rgba(212, 175, 55, 0.06);
  --lamp-glow: radial-gradient(circle, rgba(212, 175, 55, 0.18) 0%, transparent 65%);
  --text-primary: #f5e6d3;
  --text-secondary: #b8a8c8;
  --text-muted: #8a7a9a;
  --border-soft: rgba(245, 230, 211, 0.14);
  --border-gold: rgba(212, 175, 55, 0.5);
  --gold-gradient: linear-gradient(135deg, #d4af37, #f5d77a, #d4af37);
  --gold-solid: #d4af37;
  --gold-bright: #f5d77a;
  --shadow-soft: 0 4px 32px rgba(67, 56, 202, 0.4);
  --shadow-glow: 0 0 40px rgba(212, 175, 55, 0.3);
}

/* 顺滑主题切换 */
html { transition: background-color 0.4s ease; }
html[data-theme] body {
  background: var(--bg-gradient);
  color: var(--text-primary);
  transition: background 0.4s ease, color 0.4s ease;
}

body { font-family: var(--font-sans); line-height: 1.7; }
h1, h2, h3, .font-serif {
  font-family: var(--font-serif);
  font-weight: 500;
  letter-spacing: 0.02em;
}

/* 暖光金渐变文字 */
.text-gold {
  background: var(--gold-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* 金色描边 */
.gold-border {
  position: relative;
}
.gold-border::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: var(--gold-gradient);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0.55;
}

/* 动画工具类 */
.animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
.animate-fade-up { animation: fadeUp 0.5s ease-out forwards; opacity: 0; }
.breathe { animation: breathe 4s ease-in-out infinite; will-change: transform; }
.glow-pulse { animation: glowPulse 2.5s ease-in-out infinite; }

.ceremonial-tap {
  transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 220ms ease;
  will-change: transform;
}
.ceremonial-tap:active { transform: scale(0.95); }

@media (prefers-reduced-motion: reduce) {
  .animate-fade-in, .animate-fade-up, .breathe, .glow-pulse { animation: none !important; }
  .animate-fade-up { opacity: 1; }
}

.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
```

- [ ] **Step 2: 验证 build**

Run: `npm run build`
Expected: 编译成功，无 CSS 错误

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(visual): rewrite color system to warm-gold + deep-purple velvet"
```

---

## Task 2: 简化 ThemeProvider 为 night/cosmos

**Files:**
- Modify: `src/components/theme/ThemeContext.ts`
- Modify: `src/components/theme/ThemeProvider.tsx`

- [ ] **Step 1: 重写 ThemeContext 为两主题**

`src/components/theme/ThemeContext.ts`:

```typescript
'use client';

import { createContext, useContext } from 'react';

export type Theme = 'night' | 'cosmos';

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

- [ ] **Step 2: 重写 ThemeProvider（移除 garden，显化页用 cosmos）**

`src/components/theme/ThemeProvider.tsx`:

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
```

- [ ] **Step 3: 验证 tsc**

Run: `npx tsc --noEmit`
Expected: 无错误（如果有 NavBar 引用 autoTheme/garden 会报错，Task 3 修）

- [ ] **Step 4: Commit**

```bash
git add src/components/theme/
git commit -m "feat(visual): simplify ThemeProvider to night/cosmos only"
```

---

## Task 3: 重做 NavBar + 新增 LampGlow 背景层

**Files:**
- Modify: `src/components/ui/NavBar.tsx`
- Create: `src/components/ui/LampGlow.tsx`
- Create: `src/components/ui/GoldButton.tsx`

- [ ] **Step 1: 新增 LampGlow 台灯背景层**

`src/components/ui/LampGlow.tsx`:

```tsx
export function LampGlow() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none -z-10"
      style={{
        background:
          'radial-gradient(circle at 22% 8%, rgba(245,166,35,0.28) 0%, rgba(245,166,35,0.05) 38%, transparent 68%)',
      }}
    />
  );
}
```

- [ ] **Step 2: 新增 GoldButton 通用金按钮**

`src/components/ui/GoldButton.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';

interface GoldButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}

export function GoldButton({ children, onClick, disabled, type = 'button', className = '' }: GoldButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      className={`ceremonial-tap relative overflow-hidden rounded-full px-6 py-3 font-medium tracking-wide ${className}`}
      style={{
        background: 'var(--gold-gradient)',
        color: '#1a120b',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: '0 0 20px rgba(212,175,55,0.3)',
      }}
    >
      {children}
    </motion.button>
  );
}
```

- [ ] **Step 3: 重写 NavBar（移除 garden/autoTheme，用暖夜 + 金色品牌）**

`src/components/ui/NavBar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/browser';
import { useTheme } from '@/components/theme/ThemeContext';

interface NavBarProps {
  userEmail: string;
}

export function NavBar({ userEmail }: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(pathname.startsWith('/manifest') ? 'cosmos' : 'night');
  }, [pathname, setTheme]);

  const handleSignOut = async () => {
    const sb = createBrowserClient();
    await sb.auth.signOut();
    router.push('/login');
  };

  const link = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className="px-3 py-1.5 rounded-full text-sm transition-all"
        style={{
          color: active ? 'var(--gold-bright)' : 'var(--text-secondary)',
          background: active ? 'var(--gold-soft)' : 'transparent',
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav
      className="sticky top-0 z-30 backdrop-blur-md border-b"
      style={{ borderColor: 'var(--border-soft)', background: 'rgba(21,16,12,0.7)' }}
    >
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="text-gold font-serif text-sm tracking-widest">✦ MANIFEST</span>
        <div className="flex items-center gap-1">
          {link('/', '今日')}
          {link('/reflect', '复盘')}
          {link('/manifest', '显化')}
          {link('/history', '日历')}
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {userEmail.split('@')[0]} ↗
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: 在 (app)/layout.tsx 加入 LampGlow**

修改 `src/app/(app)/layout.tsx`，在 `<main>` 前加 `<LampGlow />`：

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { NavBar } from '@/components/ui/NavBar';
import { LampGlow } from '@/components/ui/LampGlow';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <ThemeProvider defaultTheme="night">
      <div className="min-h-screen" style={{ color: 'var(--text-primary)' }}>
        <LampGlow />
        <NavBar userEmail={user.email!} />
        <main className="max-w-3xl mx-auto px-4 py-8 relative z-10">{children}</main>
      </div>
    </ThemeProvider>
  );
}
```

- [ ] **Step 5: 验证 build**

Run: `npm run build`
Expected: 编译成功

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ src/app/\(app\)/layout.tsx
git commit -m "feat(visual): rebuild NavBar with warm-gold, add LampGlow + GoldButton"
```

---

## Task 4: 重做登录页（极简留白 + 金色开始）

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/AuthForm.tsx`

- [ ] **Step 1: 重做 AuthForm 为极简留白 + 金色下划线输入**

`src/components/AuthForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { createBrowserClient } from '@/lib/supabase/browser';

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else window.location.href = '/';
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setMessage(error.message);
      else setMessage('注册成功！请检查邮箱确认链接。');
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="text-center mb-2">
          <div className="text-gold font-serif text-xs tracking-[0.3em] mb-1">✦ MANIFEST</div>
          <h2 className="font-serif text-xl font-light" style={{ color: 'var(--text-primary)' }}>
            {isLogin ? '欢迎回来' : '开始你的显化之旅'}
          </h2>
        </div>

        <div className="border-b pb-2" style={{ borderColor: 'var(--border-soft)' }}>
          <label className="text-[10px] tracking-widest" style={{ color: 'var(--text-muted)' }}>邮箱</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-transparent outline-none text-sm mt-1"
            style={{ color: 'var(--text-primary)' }}
            onFocus={(e) => (e.currentTarget.parentElement!.style.borderColor = 'var(--gold-solid)')}
            onBlur={(e) => (e.currentTarget.parentElement!.style.borderColor = 'var(--border-soft)')}
          />
        </div>

        <div className="border-b pb-2" style={{ borderColor: 'var(--border-soft)' }}>
          <label className="text-[10px] tracking-widest" style={{ color: 'var(--text-muted)' }}>密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full bg-transparent outline-none text-sm mt-1"
            style={{ color: 'var(--text-primary)' }}
            onFocus={(e) => (e.currentTarget.parentElement!.style.borderColor = 'var(--gold-solid)')}
            onBlur={(e) => (e.currentTarget.parentElement!.style.borderColor = 'var(--border-soft)')}
          />
        </div>

        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          className="ceremonial-tap rounded-full py-3 font-medium tracking-wider"
          style={{
            background: 'var(--gold-gradient)',
            color: '#1a120b',
            opacity: loading ? 0.5 : 1,
            boxShadow: '0 0 20px rgba(212,175,55,0.3)',
          }}
        >
          {loading ? '...' : isLogin ? '进 入' : '开 始'}
        </motion.button>

        {message && <p className="text-sm text-center" style={{ color: 'var(--gold-bright)' }}>{message}</p>}

        <button
          type="button"
          onClick={() => { setIsLogin(!isLogin); setMessage(null); }}
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {isLogin ? '没有账号？注册' : '已有账号？登录'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: 重做登录页背景（暖夜 + 顶部台灯 + 星点）**

`src/app/login/page.tsx`:

```tsx
import { AuthForm } from '@/components/AuthForm';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* 顶部台灯光晕 */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(245,166,35,0.18) 0%, transparent 55%)',
        }}
      />
      {/* 星点 */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute top-[15%] left-[18%] w-1 h-1 rounded-full bg-white" style={{ boxShadow: '0 0 5px #fff, 60px 25px 0 -0.5px rgba(255,255,255,.5), 140px -8px 0 -0.5px #fff, 220px 40px 0 -0.5px rgba(212,175,55,.6)' }} />
        <div className="absolute top-[22%] right-[20%] w-1 h-1 rounded-full" style={{ background: 'var(--gold-bright)', boxShadow: '0 0 5px var(--gold-bright), 40px 30px 0 -0.5px rgba(255,255,255,.5)' }} />
      </div>
      <AuthForm />
    </main>
  );
}
```

- [ ] **Step 3: 确保登录页用暖夜底（layout.tsx 的 html 默认 night）**

检查 `src/app/layout.tsx`，确保 `<html lang="zh-CN" suppressHydrationWarning>` 上默认 data-theme 为 night。如果没有，在 body 里加 `data-theme="night"` 兜底。

- [ ] **Step 4: 验证 build**

Run: `npm run build`
Expected: 编译成功

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx src/components/AuthForm.tsx src/app/layout.tsx
git commit -m "feat(visual): rebuild login page with minimal whitespace + gold accents"
```

---

## Task 5: 重做首页（时间问候 + 脚本金描边）

**Files:**
- Modify: `src/app/(app)/page.tsx`
- Modify: `src/components/morning/MorningGreeting.tsx`
- Modify: `src/components/morning/ScriptStepRow.tsx`
- Modify: `src/components/morning/EmptyState.tsx`

- [ ] **Step 1: 重做 MorningGreeting（真实时间问候 + 衬线）**

`src/components/morning/MorningGreeting.tsx`:

```tsx
'use client';

interface MorningGreetingProps {
  hasScript: boolean;
  date: string;
}

function greetingWord(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return '早安';
  if (h >= 11 && h < 14) return '午安';
  if (h >= 14 && h < 18) return '下午好';
  return '晚上好';
}

export function MorningGreeting({ hasScript, date }: MorningGreetingProps) {
  return (
    <header className="text-center py-8 animate-fade-in">
      <p className="text-xs tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>{date}</p>
      <h1 className="font-serif text-3xl font-light mt-3" style={{ color: 'var(--text-primary)' }}>
        {greetingWord()}，今天是你的一天 ✨
      </h1>
      {hasScript && (
        <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          昨晚的你给今天的你留了几步路
        </p>
      )}
    </header>
  );
}
```

- [ ] **Step 2: 重做 ScriptStepRow（暖夜卡 + 金描边 + 金对勾）**

`src/components/morning/ScriptStepRow.tsx`:

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

export function ScriptStepRow({ scriptId, stepIdx, step, action, durationMin, initiallyDone }: ScriptStepRowProps) {
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
      if (!res.ok) setDone(!next);
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
      className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all gold-border"
      style={{
        background: 'var(--bg-card)',
        opacity: done ? 0.5 : 1,
        boxShadow: done ? 'var(--shadow-glow)' : 'var(--shadow-soft)',
        color: 'var(--text-primary)',
      }}
    >
      <span
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
        style={{
          background: done ? 'var(--gold-gradient)' : 'transparent',
          color: done ? '#1a120b' : 'var(--gold-solid)',
          border: '1px solid var(--border-gold)',
        }}
      >
        {done ? '✓' : step}
      </span>
      <span className={`flex-1 ${done ? 'line-through' : ''}`} style={{ color: 'var(--text-primary)' }}>{action}</span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{durationMin} 分钟</span>
    </motion.button>
  );
}
```

- [ ] **Step 3: 重做 EmptyState（金按钮引导）**

`src/components/morning/EmptyState.tsx`:

```tsx
'use client';

import Link from 'next/link';

export function EmptyState() {
  return (
    <div className="text-center py-16 space-y-5 animate-fade-in">
      <div className="text-5xl opacity-60">🌙</div>
      <p style={{ color: 'var(--text-secondary)' }}>今夜还没写，去倒出来吧。</p>
      <Link
        href="/reflect"
        className="inline-block px-8 py-3 rounded-full font-medium ceremonial-tap"
        style={{ background: 'var(--gold-gradient)', color: '#1a120b', boxShadow: '0 0 20px rgba(212,175,55,0.3)' }}
      >
        ✨ 现在写一段
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: 首页 page.tsx 调整容器与脚本卡间距（保持数据逻辑）**

修改 `src/app/(app)/page.tsx`，把脚本列表容器加上 `space-y-3` 与 `animate-fade-in`（数据获取逻辑不动，只调样式类）。找到渲染步骤的 `<div>`，改为：

```tsx
<div className="space-y-3 max-w-xl mx-auto animate-fade-in">
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
```

（其余 supabase 查询逻辑保持不变）

- [ ] **Step 5: 验证 build**

Run: `npm run build`
Expected: 编译成功

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/page.tsx src/components/morning/
git commit -m "feat(visual): rebuild home page with time greeting + gold-bordered script cards"
```

---

## Task 6: 重做复盘页三件套（错落浮现 + 接住层光晕）

**Files:**
- Modify: `src/components/reflection/EmpathyBubble.tsx`
- Modify: `src/components/reflection/HighlightCard.tsx`
- Modify: `src/components/reflection/BugCard.tsx`
- Modify: `src/components/reflection/ScriptCard.tsx`
- Modify: `src/components/reflection/ReflectionInput.tsx`

- [ ] **Step 1: 重做 EmpathyBubble（暖光金光晕呼吸 + 打字光标）**

`src/components/reflection/EmpathyBubble.tsx`:

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
      className="glow-pulse gold-border relative p-5 rounded-3xl"
      style={{ background: 'var(--bg-card-glow)' }}
    >
      <p className="font-serif italic text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        {text}
        {isStreaming && (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="inline-block w-2 h-4 ml-1 align-middle"
            style={{ background: 'var(--gold-bright)' }}
          />
        )}
      </p>
    </motion.div>
  );
}
```

- [ ] **Step 2: 重做 HighlightCard（暖夜卡 + 金描边 + 错落浮现）**

`src/components/reflection/HighlightCard.tsx`:

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 + index * 0.15 }}
      className="gold-border rounded-3xl p-5"
      style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-soft)' }}
    >
      <h3 className="text-xs tracking-[0.2em] uppercase mb-3 text-gold">✦ 今日高光</h3>
      {highlights.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>今天能撑过来本身就是一种高光。</p>
      ) : (
        <ul className="space-y-3">
          {highlights.map((h, i) => (
            <li key={i}>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{h.fact}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{h.why_it_counts}</p>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
```

- [ ] **Step 3: 重做 BugCard**

`src/components/reflection/BugCard.tsx`:

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.45 + index * 0.15 }}
      className="gold-border rounded-3xl p-5"
      style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-soft)' }}
    >
      <h3 className="text-xs tracking-[0.2em] uppercase mb-3 text-gold">🔍 心理 Bug</h3>
      <ul className="space-y-4">
        {bugs.map((b, i) => (
          <li key={i}>
            <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>「{b.user_quote}」</p>
            <p className="mt-2" style={{ color: 'var(--text-primary)' }}>{b.reframe}</p>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
```

- [ ] **Step 4: 重做 ScriptCard（金描边 + 编辑金边聚焦）**

`src/components/reflection/ScriptCard.tsx`:

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
  useEffect(() => { setLocalSteps(steps); }, [steps]);

  const updateAction = (idx: number, value: string) => {
    const next = localSteps.map((s, i) => (i === idx ? { ...s, action: value } : s));
    setLocalSteps(next);
    onChange?.(next);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 + index * 0.15 }}
      className="gold-border rounded-3xl p-5"
      style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-soft)' }}
    >
      <h3 className="text-xs tracking-[0.2em] uppercase mb-3 text-gold">📋 明早无脑脚本</h3>
      <ol className="space-y-3">
        {localSteps.map((s, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
              style={{ background: 'var(--gold-gradient)', color: '#1a120b' }}
            >
              {s.step}
            </span>
            {readOnly ? (
              <span className="flex-1 leading-relaxed" style={{ color: 'var(--text-primary)' }}>{s.action}</span>
            ) : (
              <input
                type="text"
                value={s.action}
                onChange={(e) => updateAction(i, e.target.value)}
                className="flex-1 bg-transparent border-b focus:outline-none focus:border-yellow-300/0 leading-relaxed"
                style={{ borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-solid)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-soft)')}
              />
            )}
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.duration_minutes}分钟</span>
          </li>
        ))}
      </ol>
    </motion.section>
  );
}
```

- [ ] **Step 5: 重做 ReflectionInput（金边按钮 + 暖夜输入框）**

修改 `src/components/reflection/ReflectionInput.tsx` 的提交按钮，改为 GoldButton 风格（金渐变 + 仪式 tap）。找到「让 AI 梳理」那个 `<button>`，替换为：

```tsx
<motion.button
  type="button"
  onClick={handleSubmit}
  disabled={disabled || !text.trim()}
  whileHover={{ y: -2 }}
  whileTap={{ scale: 0.96 }}
  className="flex-1 py-3 rounded-full font-medium ceremonial-tap tracking-wider"
  style={{
    background: 'var(--gold-gradient)',
    color: '#1a120b',
    opacity: disabled || !text.trim() ? 0.4 : 1,
    boxShadow: '0 0 20px rgba(212,175,55,0.3)',
  }}
>
  ✨ 让 AI 梳理
</motion.button>
```

（textarea 的 `backgroundColor` 改为 `var(--bg-card)`，`borderColor` 改为 `var(--border-soft)`，语音按钮部分保持不变）

- [ ] **Step 6: 验证 build**

Run: `npm run build`
Expected: 编译成功

- [ ] **Step 7: Commit**

```bash
git add src/components/reflection/
git commit -m "feat(visual): rebuild reflection three-card set with staggered fade-up + gold glow"
```

---

## Task 7: 重做显化页（深紫天鹅绒 + 金尘贵气）

**Files:**
- Create: `src/components/manifest/GoldStardust.tsx`
- Modify: `src/app/(app)/manifest/page.tsx`
- Modify: `src/components/manifest/CategorySelector.tsx`
- Modify: `src/components/manifest/IntentionInput.tsx`
- Modify: `src/components/manifest/EchoBubble.tsx`

- [ ] **Step 1: 新增 GoldStardust 金尘缓慢上浮**

`src/components/manifest/GoldStardust.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';

interface Dust {
  x: number; y: number; size: number; speed: number; opacity: number;
}

export function GoldStardust() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const COUNT = reduce ? 0 : 28;
    const dusts: Dust[] = [];

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    for (let i = 0; i < COUNT; i++) {
      dusts.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.8 + 0.4,
        speed: Math.random() * 0.3 + 0.1,
        opacity: Math.random() * 0.6 + 0.2,
      });
    }

    let raf = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const d of dusts) {
        d.y -= d.speed;
        if (d.y < -10) { d.y = canvas.height + 10; d.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${d.opacity})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(animate);
    };
    if (COUNT > 0) animate();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden />;
}
```

- [ ] **Step 2: 重做显化页主结构（深紫底 + 金尘 + 贵气标题）**

修改 `src/app/(app)/manifest/page.tsx`：把外层 `<div>` 的渐变背景移除（交给 cosmos 主题），加入 GoldStardust，标题改衬线大字 + 拉开字距。外层 div 改为：

```tsx
<div className="min-h-screen relative overflow-hidden" style={{ color: 'var(--text-primary)' }}>
  <GoldStardust />
  <div className="relative z-10 max-w-2xl mx-auto px-4 py-12 space-y-10">
    <header className="text-center space-y-3 animate-fade-in">
      <div className="text-gold font-serif text-xs tracking-[0.4em]">✦ CEREMONY</div>
      <h1 className="font-serif text-3xl font-light tracking-[0.15em] text-gold">显 化 仪 式</h1>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>写下你的意图，让金光接住它</p>
    </header>
    {/* CategorySelector + IntentionInput + EchoBubble 部分保持，容器不变 */}
```

（其余 handleSubmit 逻辑、状态管理、todayEntries 渲染保持不变，只换外层包裹与标题）

- [ ] **Step 3: 重做 CategorySelector（金色描边胶囊，选中金光填充）**

`src/components/manifest/CategorySelector.tsx`:

```tsx
'use client';

import type { ManifestCategory } from '@/types/manifest';
import { MANIFEST_CATEGORY_LABELS, MANIFEST_CATEGORY_ICONS } from '@/types/manifest';

const CATEGORIES = Object.keys(MANIFEST_CATEGORY_LABELS) as ManifestCategory[];

interface CategorySelectorProps {
  selected: ManifestCategory | null;
  onSelect: (category: ManifestCategory) => void;
}

export function CategorySelector({ selected, onSelect }: CategorySelectorProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {CATEGORIES.map((cat) => {
        const isSelected = selected === cat;
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className="px-4 py-2 rounded-full text-sm transition-all duration-300"
            style={{
              border: '1px solid ' + (isSelected ? 'var(--gold-solid)' : 'var(--border-soft)'),
              background: isSelected ? 'var(--gold-soft)' : 'transparent',
              color: isSelected ? 'var(--gold-bright)' : 'var(--text-secondary)',
              boxShadow: isSelected ? '0 0 12px rgba(212,175,55,0.3)' : 'none',
            }}
          >
            <span className="mr-1.5">{MANIFEST_CATEGORY_ICONS[cat]}</span>
            {MANIFEST_CATEGORY_LABELS[cat]}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 重做 IntentionInput（金色细描边 + 金按钮）**

`src/components/manifest/IntentionInput.tsx` —— 把 textarea 的边框改为金色描边，按钮改为金渐变。textarea className 与 style 改为：

```tsx
<textarea
  value={value}
  onChange={(e) => onChange(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder="写下你的意图、愿望、或者感谢……"
  disabled={isProcessing}
  rows={4}
  className="w-full rounded-2xl px-5 py-4 resize-none outline-none transition-all duration-300"
  style={{
    background: 'rgba(45,27,61,0.5)',
    border: '1px solid var(--border-gold)',
    color: 'var(--text-primary)',
  }}
  onFocus={(e) => (e.currentTarget.style.boxShadow = '0 0 20px rgba(212,175,55,0.2)')}
  onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
/>
```

提交按钮改为金渐变：

```tsx
<motion.button
  onClick={onSubmit}
  disabled={!value.trim() || isProcessing}
  whileHover={{ y: -2 }}
  whileTap={{ scale: 0.96 }}
  className="px-6 py-2.5 rounded-full text-sm font-medium ceremonial-tap"
  style={{
    background: 'var(--gold-gradient)',
    color: '#1a120b',
    opacity: !value.trim() || isProcessing ? 0.4 : 1,
    boxShadow: '0 0 18px rgba(212,175,55,0.35)',
  }}
>
  {isProcessing ? '金光接住中…' : '✨ 写下意图'}
</motion.button>
```

（其余 VoiceInput 逻辑、Ctrl+Enter 保持不变）

- [ ] **Step 5: 重做 EchoBubble（金色光晕从中心晕开 + 衬线斜体）**

`src/components/manifest/EchoBubble.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';

interface EchoBubbleProps {
  echo: string;
  isLoading?: boolean;
}

export function EchoBubble({ echo, isLoading }: EchoBubbleProps) {
  if (isLoading) {
    return (
      <div className="mx-auto max-w-md px-6 py-4 rounded-2xl glow-pulse" style={{ border: '1px solid var(--border-gold)', background: 'var(--gold-soft)' }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--gold-bright)' }}>
          <span>✨</span> 金光正在接住你的意图……
        </div>
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="mx-auto max-w-md px-6 py-4 rounded-2xl"
      style={{ border: '1px solid var(--border-gold)', background: 'var(--gold-soft)', boxShadow: 'var(--shadow-glow)' }}
    >
      <p className="font-serif italic text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>{echo}</p>
    </motion.div>
  );
}
```

- [ ] **Step 6: 验证 build**

Run: `npm run build`
Expected: 编译成功

- [ ] **Step 7: Commit**

```bash
git add src/components/manifest/ src/app/\(app\)/manifest/page.tsx
git commit -m "feat(visual): rebuild manifest page with deep-purple velvet + gold stardust ceremony"
```

---

## Task 8: 清理旧主题残留 + 移动端核查

**Files:**
- Modify: `src/app/layout.tsx`（移除残留 garden 引用）
- 全局搜索 garden / autoTheme 残留

- [ ] **Step 1: 搜索 garden / autoTheme 残留引用**

Run: `grep -r "garden\|autoTheme\|time-greeting" src/ --include="*.tsx" --include="*.ts"`

Expected: 应只剩 `lib/time-greeting.ts` 本身（可保留，不再被 NavBar 引用）。若有其他文件引用 garden，改为 night。

- [ ] **Step 2: 确认 layout.tsx html 默认 night**

`src/app/layout.tsx` 的 `<html lang="zh-CN" suppressHydrationWarning>`——若 body 上无 data-theme，浏览器默认 :root 就是 night，无需改。确认 `<body className="antialiased">` 不含残留。

- [ ] **Step 3: 移动端核查（DevTools iPhone SE 375px）**

Run: `npm run dev`

逐页在 375px 下检查：
- 登录页：卡片不溢出，按钮可点
- 首页：脚本卡单列，金描边不糊
- 复盘页：输入框 w-full，三件套卡片不溢出
- 显化页：金尘降级（GoldStardust 已含 reduce-motion），分类胶囊换行正常
- 历史页：日历 7 列在 375px 不挤

- [ ] **Step 4: 最终 build + 提交**

```bash
npm run build
git add -A
git commit -m "chore(visual): clean up garden theme remnants, verify mobile 375px"
```

---

## 验收标准（对应 spec §10）

- [ ] 登录页一眼有"被郑重迎接"感（金 + 极简留白）
- [ ] 复盘页 AI 回应时三件套错落浮现 + 接住层金光呼吸
- [ ] 显化页明显贵气（金 + 深紫天鹅绒 + 金尘）
- [ ] 所有关键按钮按下有仪式感动效
- [ ] 移动端 375px 不卡不溢出
- [ ] 暖光金贯穿全站但不过度
