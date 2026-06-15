# M1: 地基 — 项目初始化 + 数据库 + 认证 + 部署

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Next.js 全栈项目骨架，连接 Supabase 数据库和认证，部署到 Vercel 并确认线上能跑。

**Architecture:** Next.js 15 (App Router) + TailwindCSS 4 + Supabase (PostgreSQL + Auth + RLS)。前端用客户端组件 + 服务端组件混合；API Routes 放 `app/api/` 下；Supabase 客户端分 `createClient`（服务端）和 `createBrowserClient`（客户端）两个入口。环境变量区分 `NEXT_PUBLIC_`（客户端可读）和服务端专用。

**Tech Stack:** Next.js 15, TailwindCSS 4, Supabase JS SDK v2, TypeScript

---

## File Structure

```
manifest-diary/
├── .env.local                        # 服务端环境变量（Supabase + AI keys）
├── .env.example                      # 模板，提交到 git
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── .gitignore
├── src/
│   ├── app/
│   │   ├── layout.tsx                # 根 layout：字体、Supabase Provider
│   │   ├── page.tsx                  # 首页（暂时占位）
│   │   ├── globals.css               # Tailwind 入口 + 自定义 CSS 变量（三套主题色）
│   │   ├── login/
│   │   │   └── page.tsx              # 登录/注册页
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts          # Supabase Auth 回调
│   │   └── api/
│   │       └── health/
│   │           └── route.ts          # 健康检查接口
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts             # createClient（服务端）
│   │   │   ├── browser.ts            # createBrowserClient（客户端）
│   │   │   └── middleware.ts         # Supabase Auth Middleware（刷新 token）
│   │   └── utils.ts                  # 通用工具函数
│   ├── components/
│   │   └── AuthForm.tsx              # 登录/注册表单组件
│   └── middleware.ts                  # Next.js middleware（Supabase session 刷新）
├── supabase/
│   └── migrations/
│       └── 00001_initial_schema.sql  # 初始表结构 + RLS
└── docs/
    └── superpowers/
        ├── specs/
        └── plans/
```

---

## Task 1: 项目初始化

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `.gitignore`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: 用 create-next-app 初始化项目**

```bash
cd "d:/VScode项目文件夹/显化日记"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

选择默认选项。这会生成 Next.js 15 + TailwindCSS + TypeScript + App Router 的基础结构。

- [ ] **Step 2: 安装额外依赖**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 3: 确认开发服务器能跑**

```bash
npm run dev
```

打开 http://localhost:3000 确认看到 Next.js 默认页面。

- [ ] **Step 4: 清理默认模板内容**

替换 `src/app/page.tsx` 为最小占位页面：

```tsx
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-light text-slate-600">Manifest Diary</h1>
    </main>
  );
}
```

替换 `src/app/globals.css` 为 Tailwind 入口 + 三套主题 CSS 变量：

```css
@import "tailwindcss";

:root {
  /* 夜晚暖光（默认主题） */
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-card: #fefce8;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --accent: #f59e0b;
  --accent-rose: #f472b6;
  --accent-rose-gold: linear-gradient(135deg, #f472b6, #fbbf24);
  --border: #334155;
}

[data-theme="garden"] {
  /* 晨间花园 */
  --bg-primary: #fefce8;
  --bg-secondary: #f0fdf4;
  --bg-card: #ffffff;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --accent: #22c55e;
  --accent-rose: #f472b6;
  --accent-rose-gold: linear-gradient(135deg, #22c55e, #a3e635);
  --border: #e2e8f0;
}

[data-theme="cosmos"] {
  /* 显化星空 */
  --bg-primary: #1e1b4b;
  --bg-secondary: #312e81;
  --bg-card: #312e81;
  --text-primary: #e0e7ff;
  --text-secondary: #a5b4fc;
  --accent: #f472b6;
  --accent-rose: #f472b6;
  --accent-rose-gold: linear-gradient(135deg, #f472b6, #c084fc);
  --border: #4338ca;
}
```

- [ ] **Step 5: 创建 .env.example**

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# AI API
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://www.dreamfield.top
DEEPSEEK_MODEL=DeepSeek-V4-Flash
```

- [ ] **Step 6: 创建 .env.local（填入真实值，不提交 git）**

从 .env.example 复制并填入 Supabase 项目信息（Supabase 在 Task 3 创建）。

- [ ] **Step 7: 确认 .gitignore 包含 `.env.local`**

检查 Next.js 生成的 `.gitignore` 是否已有 `.env*.local`，没有则手动添加。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: initialize Next.js project with Tailwind and theme variables"
```

---

## Task 2: Supabase 客户端配置

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, `src/middleware.ts`, `src/lib/utils.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 创建服务端 Supabase 客户端**

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 2: 创建客户端 Supabase 客户端**

`src/lib/supabase/browser.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: 创建 Next.js Middleware（session 刷新）**

`src/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 4: 创建通用工具函数**

`src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 判断当前时间属于哪个模式 */
export function getTimeMode(): "morning" | "night" {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 9) return "morning";
  return "night";
}

/** 根据 created_at 时间计算 entry_date（凌晨 0-5 点算前一天） */
export function getEntryDate(createdAt: Date): string {
  const hour = createdAt.getHours();
  const date = new Date(createdAt);
  if (hour < 5) {
    date.setDate(date.getDate() - 1);
  }
  return date.toISOString().split("T")[0];
}
```

安装 clsx 和 tailwind-merge：

```bash
npm install clsx tailwind-merge
```

- [ ] **Step 5: 更新根 layout.tsx**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Manifest Diary — 显化手账",
  description: "夜间陪伴你复盘 + 早晨推你出门 + 长期帮你显化的 AI 副驾驶",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: 确认开发服务器仍能正常运行**

```bash
npm run dev
```

打开 http://localhost:3000 确认页面正常渲染。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Supabase client config, middleware, and utility functions"
```

---

## Task 3: Supabase 项目创建 + 表结构 + RLS

**Files:**
- Create: `supabase/migrations/00001_initial_schema.sql`

- [ ] **Step 1: 在 Supabase 控制台创建项目**

1. 打开 https://supabase.com/dashboard
2. 点击 "New Project"
3. 项目名：`manifest-diary`
4. 选择区域（选离你最近的，如 Northeast Asia）
5. 设置数据库密码（保存好）
6. 等待项目初始化完成

- [ ] **Step 2: 记录 Supabase 凭证到 .env.local**

在 Supabase Dashboard → Settings → API 中找到：
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

填入 `.env.local`。

- [ ] **Step 3: 编写初始迁移 SQL**

`supabase/migrations/00001_initial_schema.sql`:

```sql
-- ============================================
-- Manifest Diary: Initial Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- users 表（扩展 Supabase Auth 的 profiles）
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  preferences JSONB DEFAULT '{
    "ai_persona_intensity": 3,
    "preferred_tone": "balanced",
    "onboarding_answers": {}
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 自动创建 profile 触发器
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- journal_entries（复盘日记）
-- ============================================
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  entry_date DATE NOT NULL,
  raw_input TEXT NOT NULL,
  input_method TEXT NOT NULL CHECK (input_method IN ('voice', 'text', 'mixed')),
  ai_response TEXT,
  ai_structured JSONB,
  user_edits JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ai_processed', 'finalized'))
);

CREATE INDEX idx_journal_entries_user_date ON public.journal_entries(user_id, entry_date DESC);

-- ============================================
-- manifest_entries（显化日记）
-- ============================================
CREATE TABLE public.manifest_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  entry_date DATE NOT NULL,
  intention TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('self', 'relationship', 'career', 'health', 'abundance', 'other')),
  ai_echo TEXT,
  keywords TEXT[]
);

CREATE INDEX idx_manifest_entries_user_date ON public.manifest_entries(user_id, entry_date DESC);

-- ============================================
-- tomorrow_scripts（明日脚本）
-- ============================================
CREATE TABLE public.tomorrow_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  scheduled_for DATE NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tomorrow_scripts_user_scheduled ON public.tomorrow_scripts(user_id, scheduled_for DESC);

-- ============================================
-- ai_call_logs（AI 调用日志）
-- ============================================
CREATE TABLE public.ai_call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  mode TEXT NOT NULL CHECK (mode IN ('reflection', 'manifest_echo', 'manifest_analysis')),
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER,
  cost_estimate NUMERIC(10, 6)
);

-- ============================================
-- RLS 策略：所有表只允许用户访问自己的数据
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manifest_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tomorrow_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_call_logs ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- journal_entries
CREATE POLICY "Users can CRUD own journal entries"
  ON public.journal_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- manifest_entries
CREATE POLICY "Users can CRUD own manifest entries"
  ON public.manifest_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tomorrow_scripts
CREATE POLICY "Users can CRUD own tomorrow scripts"
  ON public.tomorrow_scripts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ai_call_logs
CREATE POLICY "Users can view own AI call logs"
  ON public.ai_call_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert AI call logs"
  ON public.ai_call_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 4: 在 Supabase SQL Editor 中执行迁移**

1. 打开 Supabase Dashboard → SQL Editor
2. 粘贴 `00001_initial_schema.sql` 全部内容
3. 点击 Run
4. 确认无报错，打开 Table Editor 验证 5 张表都已创建

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00001_initial_schema.sql
git commit -m "feat: add initial database schema with RLS policies"
```

---

## Task 4: 认证页面（登录/注册）

**Files:**
- Create: `src/components/AuthForm.tsx`, `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`

- [ ] **Step 1: 创建 Auth 回调路由**

`src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
```

- [ ] **Step 2: 创建 AuthForm 组件**

`src/components/AuthForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browser";

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(error.message);
      } else {
        window.location.href = "/";
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("注册成功！请检查邮箱确认链接。");
      }
    }

    setLoading(false);
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="text-xl font-light text-center mb-2">
          {isLogin ? "欢迎回来 ✨" : "开始你的显化之旅"}
        </h2>

        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="px-4 py-3 rounded-lg bg-white/10 border border-white/20
                     placeholder:text-white/40 text-white focus:outline-none
                     focus:border-amber-400/50 transition-colors"
        />

        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="px-4 py-3 rounded-lg bg-white/10 border border-white/20
                     placeholder:text-white/40 text-white focus:outline-none
                     focus:border-amber-400/50 transition-colors"
        />

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-3 rounded-lg bg-gradient-to-r from-amber-400 to-pink-400
                     text-slate-900 font-medium hover:opacity-90 transition-opacity
                     disabled:opacity-50"
        >
          {loading ? "..." : isLogin ? "登录" : "注册"}
        </button>

        {message && (
          <p className="text-sm text-center text-amber-300">{message}</p>
        )}

        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setMessage(null);
          }}
          className="text-sm text-white/50 hover:text-white/70 transition-colors text-center"
        >
          {isLogin ? "没有账号？注册" : "已有账号？登录"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: 创建登录页面**

`src/app/login/page.tsx`:

```tsx
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <AuthForm />
    </main>
  );
}
```

- [ ] **Step 4: 更新首页，增加登录检测**

`src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="text-center">
        <h1 className="text-3xl font-light" style={{ color: "var(--text-primary)" }}>
          晚上好 ✨
        </h1>
        <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
          准备好今晚的复盘了吗？
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: 测试完整认证流程**

1. `npm run dev`
2. 打开 http://localhost:3000 → 应自动跳转 /login
3. 注册一个新账号
4. 检查邮箱确认（Supabase 默认不需要邮箱确认如果关闭了 confirm email 选项）
5. 登录 → 应看到"晚上好 ✨"

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add auth flow with login/register page and callback"
```

---

## Task 5: 健康检查 API + 部署到 Vercel

**Files:**
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: 创建健康检查接口**

`src/app/api/health/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, string> = {};

  // Check Supabase connection
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    checks.supabase = error ? `ERROR: ${error.message}` : "OK";
  } catch {
    checks.supabase = "ERROR: connection failed";
  }

  const allOk = Object.values(checks).every((v) => v === "OK");

  return NextResponse.json(
    { status: allOk ? "healthy" : "degraded", checks },
    { status: allOk ? 200 : 503 }
  );
}
```

- [ ] **Step 2: 本地测试健康检查**

```bash
npm run dev
```

```bash
curl http://localhost:3000/api/health
```

Expected:
```json
{"status":"healthy","checks":{"supabase":"OK"}}
```

- [ ] **Step 3: 部署到 Vercel**

1. 推送代码到 GitHub：
```bash
gh repo create manifest-diary --private --source=. --push
```
（如果没有 gh CLI，手动在 GitHub 创建仓库并 push）

2. 打开 https://vercel.com → Import Project → 选择该仓库
3. 在 Vercel 设置环境变量（和 .env.local 一样的内容）：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. 点击 Deploy
5. 等待部署完成

- [ ] **Step 4: 验证线上环境**

1. 打开 Vercel 给的 URL
2. 应自动跳转 /login
3. 注册/登录 → 看到"晚上好 ✨"
4. 访问 `/api/health` → 返回 healthy

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add health check API and configure Vercel deployment"
```

---

## M1 完成标准

- [x] `npm run dev` 本地跑通
- [x] Supabase 5 张表 + RLS 策略就位
- [x] 邮箱注册 → 登录 → 看到首页 走通
- [x] Vercel 线上部署跑通
- [x] `/api/health` 返回 healthy
