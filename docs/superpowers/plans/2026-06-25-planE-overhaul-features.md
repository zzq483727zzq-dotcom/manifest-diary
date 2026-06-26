# Plan E: 5 个新功能（心情追踪 / 愿望看板 / 每日一问 / 标签体系 / 周报月报）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加 5 个新功能，补全产品能力。数据库新增 6 张表，API 5 个，UI 5 个。

**Architecture:** 数据库迁移 + API 路由 + UI 页面三层。新表都启用 RLS。

**Tech Stack:** Next.js App Router, Supabase, TypeScript, MiniMax-M3 via gotoken.top.

**依赖:** Plan C（人格重写），Plan D（Bug 修复）。

---

## 文件结构

```
supabase/migrations/
  00003_mood_logs.sql             -- 新增
  00004_daily_questions.sql       -- 新增
  00005_tags_and_junctions.sql    -- 新增
  00006_ai_reports.sql            -- 新增

src/lib/supabase/
  mood.ts                          -- 新建：心情读写
  questions.ts                     -- 新建：每日一问读写
  tags.ts                          -- 新建：标签读写
  reports.ts                       -- 新建：周报月报读写

src/app/api/
  mood/route.ts                    -- 新建
  daily-question/generate/route.ts -- 新建
  reports/generate/route.ts        -- 新建
  tags/route.ts                    -- 新建

src/app/(app)/
  mood/page.tsx                    -- 新建：心情追踪页
  manifest-board/page.tsx          -- 新建：愿望看板
  daily-question/page.tsx          -- 新建：每日一问
  tags/page.tsx                    -- 新建：标签云
  reports/page.tsx                 -- 新建：周报月报

src/components/mood/
  MoodChart.tsx                    -- 新建：折线图
src/components/manifest/
  ManifestBoardCard.tsx            -- 新建：愿望卡片
src/components/question/
  DailyQuestionCard.tsx            -- 新建
src/components/tags/
  TagCloud.tsx                     -- 新建
  TagPicker.tsx                    -- 新建
src/components/reports/
  ReportCard.tsx                   -- 新建
```

---

## Task 1: 数据库迁移——mood_logs / daily_questions / tags / ai_reports

**Files:**
- Create: `supabase/migrations/00003_mood_logs.sql`
- Create: `supabase/migrations/00004_daily_questions.sql`
- Create: `supabase/migrations/00005_tags_and_junctions.sql`
- Create: `supabase/migrations/00006_ai_reports.sql`

- [ ] **Step 1: 创建 00003_mood_logs.sql**

```sql
CREATE TABLE public.mood_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ DEFAULT now(),
  log_date DATE NOT NULL,
  mood SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 5),
  note TEXT
);

CREATE INDEX idx_mood_logs_user_date ON public.mood_logs(user_id, log_date DESC);

ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own mood logs"
  ON public.mood_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: 创建 00004_daily_questions.sql**

```sql
CREATE TABLE public.daily_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_date DATE NOT NULL,
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, question_date)
);

CREATE TABLE public.daily_question_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES public.daily_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(question_id)
);

CREATE INDEX idx_daily_questions_user_date ON public.daily_questions(user_id, question_date DESC);

ALTER TABLE public.daily_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_question_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own daily questions"
  ON public.daily_questions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own daily question answers"
  ON public.daily_question_answers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 3: 创建 00005_tags_and_junctions.sql**

```sql
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'gold',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE TABLE public.journal_tags (
  journal_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (journal_id, tag_id)
);

CREATE TABLE public.manifest_tags (
  manifest_id UUID NOT NULL REFERENCES public.manifest_entries(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (manifest_id, tag_id)
);

CREATE INDEX idx_tags_user ON public.tags(user_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manifest_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own tags"
  ON public.tags FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own journal tags"
  ON public.journal_tags FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM public.journal_entries WHERE id = journal_id
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM public.journal_entries WHERE id = journal_id
  ));

CREATE POLICY "Users can CRUD own manifest tags"
  ON public.manifest_tags FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM public.manifest_entries WHERE id = manifest_id
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM public.manifest_entries WHERE id = manifest_id
  ));
```

- [ ] **Step 4: 创建 00006_ai_reports.sql**

```sql
CREATE TABLE public.ai_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  content TEXT NOT NULL,
  ai_structured JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_reports_user_period ON public.ai_reports(user_id, period_end DESC);

ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own reports"
  ON public.ai_reports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 5: 在 Supabase 执行所有迁移**

把每个 SQL 文件的内容复制到 Supabase SQL Editor 执行。

- [ ] **Step 6: 提交**

```bash
git add supabase/migrations/
git commit -m "feat(db): add mood_logs, daily_questions, tags, ai_reports tables"
```

---

## Task 2: 心情追踪 API + UI

**Files:**
- Create: `src/app/api/mood/route.ts`
- Create: `src/app/(app)/mood/page.tsx`
- Create: `src/components/mood/MoodChart.tsx`

- [ ] **Step 1: 创建 mood API**

```typescript
// src/app/api/mood/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { mood, note } = await req.json();
  if (!mood || mood < 1 || mood > 5) {
    return NextResponse.json({ error: "invalid mood" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];

  await supabase.from("mood_logs").insert({
    user_id: user.id,
    log_date: today,
    mood,
    note,
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "7", 10);
  const start = new Date();
  start.setDate(start.getDate() - days);

  const { data } = await supabase
    .from("mood_logs")
    .select("log_date, mood, note")
    .eq("user_id", user.id)
    .gte("log_date", start.toISOString().split("T")[0])
    .order("log_date", { ascending: true });

  return NextResponse.json({ logs: data ?? [] });
}
```

- [ ] **Step 2: 创建 MoodChart 组件**

```tsx
// src/components/mood/MoodChart.tsx
"use client";
import { useEffect, useState } from "react";

interface MoodLog { log_date: string; mood: number; note: string | null; }

const MOOD_LABELS = ["", "😔", "😐", "😊", "😄", "🤩"];

export function MoodChart() {
  const [logs, setLogs] = useState<MoodLog[]>([]);

  useEffect(() => {
    fetch("/api/mood?days=14")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []));
  }, []);

  const byDate = new Map(logs.map((l) => [l.log_date, l.mood]));

  const days: Array<{ date: string; mood: number | null }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    days.push({ date: iso, mood: byDate.get(iso) ?? null });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: "var(--text-secondary)", letterSpacing: "0.15em" }}>最近 14 天心情</p>
      <div className="flex items-end gap-1 h-32">
        {days.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t"
              style={{
                height: d.mood ? `${(d.mood / 5) * 100}%` : "4px",
                background: d.mood
                  ? `linear-gradient(180deg, var(--gold-bright), var(--gold-solid))`
                  : "var(--border-soft)",
                opacity: d.mood ? 1 : 0.3,
              }}
            />
            <span className="text-xs" style={{ color: d.mood ? "var(--gold-bright)" : "var(--text-secondary)" }}>
              {d.mood ? MOOD_LABELS[d.mood] : "·"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 mood 页面**

```tsx
// src/app/(app)/mood/page.tsx
import { MoodChart } from "@/components/mood/MoodChart";
import { MoodQuickLog } from "@/components/home/MoodQuickLog";

export default function MoodPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      <header>
        <h1 className="font-serif text-2xl" style={{ color: "var(--text-primary)", letterSpacing: "0.08em" }}>心情追踪</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>看看你这阵子的心情起伏</p>
      </header>
      <MoodQuickLog />
      <MoodChart />
    </div>
  );
}
```

- [ ] **Step 4: 验证 + 提交**

```bash
npx tsc --noEmit
git add src/app/api/mood/ src/app/\(app\)/mood/ src/components/mood/
git commit -m "feat(mood): add mood tracking API + chart + page"
```

---

## Task 3: 每日一问 API + UI

**Files:**
- Create: `src/app/api/daily-question/generate/route.ts`
- Create: `src/app/(app)/daily-question/page.tsx`
- Create: `src/components/question/DailyQuestionCard.tsx`

- [ ] **Step 1: 创建 generate API**

```typescript
// src/app/api/daily-question/generate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserMemory, formatMemoryForPrompt } from "@/lib/ai/memory";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];

  // 检查今天是否已生成
  const { data: existing } = await supabase
    .from("daily_questions")
    .select("id, question")
    .eq("user_id", user.id)
    .eq("question_date", today)
    .single();

  if (existing) return NextResponse.json({ question: existing.question, cached: true });

  // 生成新问题
  const memories = await loadUserMemory(user.id, 5);
  const memoryContext = formatMemoryForPrompt(memories);

  const prompt = `你是一个温柔的提问者。基于用户的最近记忆，生成一个适合今天的引导性问题。

# 关于用户的最近记忆

${memoryContext}

# 要求

- 问题要温柔、不评判
- 问题要开放，让用户思考
- 问题可以关于情绪、关系、自我、目标
- 1-2 句话，最多 50 字
- 不要用"为什么"、"你为什么"
- 直接输出问题文本，不要 JSON，不要 markdown`;

  const UPSTREAM_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.gotoken.top") + "/v1/chat/completions";
  const UPSTREAM_MODEL = process.env.ANTHROPIC_MODEL || "MiniMax-M3";
  const UPSTREAM_KEY = process.env.ANTHROPIC_AUTH_TOKEN || "";

  const upstream = await fetch(UPSTREAM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTREAM_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: UPSTREAM_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.8,
    }),
  });

  const json = await upstream.json();
  const question = json.choices?.[0]?.message?.content?.trim() ?? "今天，你想对自己温柔一点吗？";

  await supabase.from("daily_questions").insert({
    user_id: user.id,
    question_date: today,
    question,
  });

  return NextResponse.json({ question, cached: false });
}
```

- [ ] **Step 2: 创建 DailyQuestionCard**

```tsx
// src/components/question/DailyQuestionCard.tsx
"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function DailyQuestionCard() {
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/daily-question/generate", { method: "POST" })
      .then((r) => r.json())
      .then((d) => setQuestion(d.question));
  }, []);

  const handleSave = async () => {
    if (!answer.trim()) return;
    setSaving(true);
    await fetch("/api/daily-question/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    setSaving(false);
    setAnswer("");
  };

  if (!question) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto p-6 rounded-2xl space-y-4"
      style={{
        background: "var(--bg-card-glow)",
        border: "1px solid var(--border-soft)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" style={{ color: "var(--gold-bright)" }}>?</span>
        <p className="font-ai italic leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {question}
        </p>
      </div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="随便说点什么……"
        className="w-full bg-transparent outline-none resize-none"
        style={{
          color: "var(--text-primary)",
          borderBottom: "1px solid var(--border-soft)",
          padding: "8px 0",
          fontSize: "0.95rem",
        }}
        rows={3}
      />
      <button
        onClick={handleSave}
        disabled={!answer.trim() || saving}
        className="ceremonial-tap primary w-full py-2.5 rounded-full"
        style={{
          background: "var(--gold-gradient)",
          color: "#1a120b",
          opacity: !answer.trim() || saving ? 0.5 : 1,
        }}
      >
        {saving ? "…" : "记下来"}
      </button>
    </motion.div>
  );
}
```

- [ ] **Step 3: 创建 daily-question 页面**

```tsx
// src/app/(app)/daily-question/page.tsx
import { DailyQuestionCard } from "@/components/question/DailyQuestionCard";

export default function DailyQuestionPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      <header>
        <h1 className="font-serif text-2xl" style={{ color: "var(--text-primary)", letterSpacing: "0.08em" }}>每日一问</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>每天一个温柔的问题，留给自己。</p>
      </header>
      <DailyQuestionCard />
    </div>
  );
}
```

- [ ] **Step 4: 创建 answer API**

```typescript
// src/app/api/daily-question/answer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { answer } = await req.json();
  if (!answer?.trim()) return NextResponse.json({ error: "empty answer" }, { status: 400 });

  const today = new Date().toISOString().split("T")[0];
  const { data: question } = await supabase
    .from("daily_questions")
    .select("id")
    .eq("user_id", user.id)
    .eq("question_date", today)
    .single();

  if (!question) return NextResponse.json({ error: "no question today" }, { status: 404 });

  await supabase.from("daily_question_answers").insert({
    question_id: question.id,
    user_id: user.id,
    answer,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: 验证 + 提交**

```bash
npx tsc --noEmit
git add src/app/api/daily-question/ src/app/\(app\)/daily-question/ src/components/question/
git commit -m "feat(daily-question): add AI-generated daily question + answer"
```

---

## Task 4: 愿望看板

**Files:**
- Create: `src/app/(app)/manifest-board/page.tsx`
- Create: `src/components/manifest/ManifestBoardCard.tsx`

- [ ] **Step 1: 创建 ManifestBoardCard**

```tsx
// src/components/manifest/ManifestBoardCard.tsx
import Link from "next/link";

interface ManifestBoardCardProps {
  intention: string;
  category: string;
  entryDate: string;
  keywords: string[];
  daysSince: number;
}

const CATEGORY_EMOJI: Record<string, string> = {
  self: "🌱",
  relationship: "💞",
  career: "🎯",
  health: "🌿",
  abundance: "✨",
  other: "🌙",
};

export function ManifestBoardCard({ intention, category, entryDate, keywords, daysSince }: ManifestBoardCardProps) {
  const borderColor = daysSince < 7 ? "var(--gold-bright)" : daysSince < 30 ? "rgba(212,175,55,0.4)" : "rgba(245,230,211,0.18)";
  const opacity = daysSince < 7 ? 1 : daysSince < 30 ? 0.85 : 0.5;

  return (
    <article
      className="p-5 rounded-2xl transition-all"
      style={{
        background: "var(--bg-card-glow)",
        border: `1px solid ${borderColor}`,
        opacity,
      }}
    >
      <header className="flex items-center justify-between text-xs mb-3">
        <span style={{ color: "var(--gold-bright)" }}>
          {CATEGORY_EMOJI[category] ?? "✨"} {category}
        </span>
        <span style={{ color: "var(--text-secondary)" }}>{daysSince} 天前</span>
      </header>
      <p className="font-ai italic leading-relaxed" style={{ color: "var(--text-primary)" }}>
        {intention}
      </p>
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {keywords.map((k, i) => (
            <span
              key={i}
              className="px-2 py-0.5 text-xs rounded-full"
              style={{
                background: "rgba(212,175,55,0.12)",
                color: "var(--gold-bright)",
                border: "1px solid var(--border-soft)",
              }}
            >
              {k}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 2: 创建 manifest-board 页面**

```tsx
// src/app/(app)/manifest-board/page.tsx
import { createClient } from "@/lib/supabase/server";
import { ManifestBoardCard } from "@/components/manifest/ManifestBoardCard";

export default async function ManifestBoardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: manifests } = await supabase
    .from("manifest_entries")
    .select("intention, category, entry_date, keywords")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false });

  const today = new Date();
  const cards = (manifests ?? []).map((m) => {
    const date = new Date(m.entry_date);
    const daysSince = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return { ...m, daysSince, keywords: m.keywords ?? [] };
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      <header>
        <h1 className="font-serif text-2xl" style={{ color: "var(--text-primary)", letterSpacing: "0.08em" }}>愿望看板</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>所有你写过的心愿。{cards.length} 条。</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <ManifestBoardCard
            key={i}
            intention={c.intention}
            category={c.category}
            entryDate={c.entry_date}
            keywords={c.keywords}
            daysSince={c.daysSince}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 验证 + 提交**

```bash
npx tsc --noEmit
git add src/app/\(app\)/manifest-board/ src/components/manifest/ManifestBoardCard.tsx
git commit -m "feat(manifest-board): add wish board aggregating all intentions"
```

---

## Task 5: 标签体系 API + UI

**Files:**
- Create: `src/app/api/tags/route.ts`
- Create: `src/app/(app)/tags/page.tsx`
- Create: `src/components/tags/TagCloud.tsx`
- Create: `src/components/tags/TagPicker.tsx`

- [ ] **Step 1: 创建 tags API**

```typescript
// src/app/api/tags/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("user_id", user.id)
    .order("name");

  return NextResponse.json({ tags: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { data } = await supabase
    .from("tags")
    .insert({ user_id: user.id, name: name.trim(), color: color ?? "gold" })
    .select()
    .single();

  return NextResponse.json({ tag: data });
}
```

- [ ] **Step 2: 创建 TagCloud + TagPicker**

```tsx
// src/components/tags/TagCloud.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export function TagCloud() {
  const [tags, setTags] = useState<Array<{ id: string; name: string; color: string }>>([]);

  useEffect(() => {
    fetch("/api/tags").then((r) => r.json()).then((d) => setTags(d.tags ?? []));
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      {tags.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>还没有标签。在复盘或显化时给它们打上标签吧。</p>
      )}
      {tags.map((t) => (
        <span
          key={t.id}
          className="px-3 py-1.5 rounded-full text-sm"
          style={{
            background: "rgba(212,175,55,0.12)",
            color: "var(--gold-bright)",
            border: "1px solid var(--border-soft)",
          }}
        >
          # {t.name}
        </span>
      ))}
    </div>
  );
}
```

```tsx
// src/components/tags/TagPicker.tsx
"use client";
import { useEffect, useState } from "react";

interface TagPickerProps {
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function TagPicker({ selected, onChange }: TagPickerProps) {
  const [allTags, setAllTags] = useState<Array<{ id: string; name: string }>>([]);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    fetch("/api/tags").then((r) => r.json()).then((d) => setAllTags(d.tags ?? []));
  }, []);

  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]);
  };

  const addNew = async () => {
    if (!newTag.trim()) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTag.trim() }),
    });
    const json = await res.json();
    if (json.tag) {
      setAllTags([...allTags, json.tag]);
      onChange([...selected, json.tag.name]);
      setNewTag("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {allTags.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.name)}
            className="px-3 py-1 rounded-full text-xs ceremonial-tap"
            style={{
              background: selected.includes(t.name) ? "var(--gold-gradient)" : "transparent",
              color: selected.includes(t.name) ? "#1a120b" : "var(--gold-bright)",
              border: "1px solid var(--border-soft)",
            }}
          >
            # {t.name}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="新标签..."
          className="flex-1 px-3 py-1.5 rounded-full bg-transparent outline-none text-sm"
          style={{ border: "1px solid var(--border-soft)", color: "var(--text-primary)" }}
        />
        <button
          type="button"
          onClick={addNew}
          className="px-3 py-1.5 rounded-full text-xs ceremonial-tap"
          style={{ background: "var(--gold-gradient)", color: "#1a120b" }}
        >
          添加
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 tags 页面**

```tsx
// src/app/(app)/tags/page.tsx
import { TagCloud } from "@/components/tags/TagCloud";

export default function TagsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      <header>
        <h1 className="font-serif text-2xl" style={{ color: "var(--text-primary)", letterSpacing: "0.08em" }}>标签云</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>你用过的所有标签。</p>
      </header>
      <TagCloud />
    </div>
  );
}
```

- [ ] **Step 4: 验证 + 提交**

```bash
npx tsc --noEmit
git add src/app/api/tags/ src/app/\(app\)/tags/ src/components/tags/
git commit -m "feat(tags): add tag system with cloud view + picker"
```

---

## Task 6: 周报月报

**Files:**
- Create: `src/app/api/reports/generate/route.ts`
- Create: `src/app/(app)/reports/page.tsx`
- Create: `src/components/reports/ReportCard.tsx`

- [ ] **Step 1: 创建 generate API**

```typescript
// src/app/api/reports/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type } = await req.json();
  if (type !== "weekly" && type !== "monthly") {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  const now = new Date();
  const periodEnd = now.toISOString().split("T")[0];
  const start = new Date(now);
  start.setDate(start.getDate() - (type === "weekly" ? 7 : 30));
  const periodStart = start.toISOString().split("T")[0];

  // 拉取该周期的数据
  const [{ data: journals }, { data: manifests }, { data: moods }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("raw_input, ai_response, ai_structured, entry_date")
      .eq("user_id", user.id)
      .gte("entry_date", periodStart)
      .lte("entry_date", periodEnd),
    supabase
      .from("manifest_entries")
      .select("intention, ai_echo, entry_date")
      .eq("user_id", user.id)
      .gte("entry_date", periodStart)
      .lte("entry_date", periodEnd),
    supabase
      .from("mood_logs")
      .select("log_date, mood")
      .eq("user_id", user.id)
      .gte("log_date", periodStart)
      .lte("log_date", periodEnd),
  ]);

  const avgMood = moods && moods.length > 0
    ? (moods.reduce((s, m) => s + m.mood, 0) / moods.length).toFixed(1)
    : null;

  const prompt = `你是一个温柔的洞察者。基于用户过去 ${type === "weekly" ? "7" : "30"} 天的数据，生成一份观察报告。

# 数据概览

- 复盘数：${journals?.length ?? 0}
- 显化数：${manifests?.length ?? 0}
- 平均心情：${avgMood ?? "无记录"}

# 复盘摘要

${(journals ?? []).slice(0, 5).map((j) => `- ${j.raw_input.slice(0, 80)}`).join("\n")}

# 显化摘要

${(manifests ?? []).slice(0, 5).map((m) => `- ${m.intention}`).join("\n")}

# 输出格式

严格的 JSON：
{
  "highlights": ["你做得好的事，1-3 条"],
  "patterns": ["你反复出现的模式，1-3 条"],
  "growth": "你在这段时间的成长，1 句话",
  "next_focus": "建议下个周期关注的方向，1 句话"
}`;

  const UPSTREAM_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.gotoken.top") + "/v1/chat/completions";
  const UPSTREAM_MODEL = process.env.ANTHROPIC_MODEL || "MiniMax-M3";
  const UPSTREAM_KEY = process.env.ANTHROPIC_AUTH_TOKEN || "";

  const upstream = await fetch(UPSTREAM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTREAM_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: UPSTREAM_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  const json = await upstream.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let structured: Record<string, unknown> = {};
  try { structured = JSON.parse(raw); } catch {}

  const content = JSON.stringify(structured, null, 2);

  await supabase.from("ai_reports").insert({
    user_id: user.id,
    report_type: type,
    period_start: periodStart,
    period_end: periodEnd,
    content,
    ai_structured: structured,
  });

  return NextResponse.json({ report: { periodStart, periodEnd, content, structured } });
}
```

- [ ] **Step 2: 创建 ReportCard**

```tsx
// src/components/reports/ReportCard.tsx
interface ReportCardProps {
  type: "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
  content: string;
  structured: {
    highlights?: string[];
    patterns?: string[];
    growth?: string;
    next_focus?: string;
  };
}

export function ReportCard({ type, periodStart, periodEnd, structured }: ReportCardProps) {
  return (
    <article
      className="p-6 rounded-2xl space-y-4"
      style={{
        background: "var(--bg-card-glow)",
        border: "1px solid var(--border-soft)",
      }}
    >
      <header className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest" style={{ color: "var(--gold-bright)" }}>
          {type === "weekly" ? "周报" : "月报"}
        </span>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {periodStart} ~ {periodEnd}
        </span>
      </header>

      {structured.highlights && structured.highlights.length > 0 && (
        <section>
          <h3 className="text-sm mb-2" style={{ color: "var(--gold-bright)" }}>✨ 高光</h3>
          <ul className="space-y-1">
            {structured.highlights.map((h, i) => (
              <li key={i} className="text-sm" style={{ color: "var(--text-primary)" }}>· {h}</li>
            ))}
          </ul>
        </section>
      )}

      {structured.patterns && structured.patterns.length > 0 && (
        <section>
          <h3 className="text-sm mb-2" style={{ color: "var(--gold-bright)" }}>🔍 模式</h3>
          <ul className="space-y-1">
            {structured.patterns.map((p, i) => (
              <li key={i} className="text-sm" style={{ color: "var(--text-primary)" }}>· {p}</li>
            ))}
          </ul>
        </section>
      )}

      {structured.growth && (
        <section>
          <h3 className="text-sm mb-2" style={{ color: "var(--gold-bright)" }}>🌱 成长</h3>
          <p className="text-sm font-ai italic" style={{ color: "var(--text-primary)" }}>{structured.growth}</p>
        </section>
      )}

      {structured.next_focus && (
        <section>
          <h3 className="text-sm mb-2" style={{ color: "var(--gold-bright)" }}>🎯 下一段</h3>
          <p className="text-sm font-ai italic" style={{ color: "var(--text-primary)" }}>{structured.next_focus}</p>
        </section>
      )}
    </article>
  );
}
```

- [ ] **Step 3: 创建 reports 页面**

```tsx
// src/app/(app)/reports/page.tsx
import { createClient } from "@/lib/supabase/server";
import { ReportCard } from "@/components/reports/ReportCard";
import { GenerateReportButton } from "@/components/reports/GenerateReportButton";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: reports } = await supabase
    .from("ai_reports")
    .select("id, report_type, period_start, period_end, content, ai_structured")
    .eq("user_id", user.id)
    .order("period_end", { ascending: false })
    .limit(20);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl" style={{ color: "var(--text-primary)", letterSpacing: "0.08em" }}>AI 报告</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>周期性的洞察与回顾。</p>
        </div>
        <GenerateReportButton />
      </header>
      <div className="space-y-4">
        {(reports ?? []).map((r) => (
          <ReportCard
            key={r.id}
            type={r.report_type as "weekly" | "monthly"}
            periodStart={r.period_start}
            periodEnd={r.period_end}
            content={r.content}
            structured={(r.ai_structured ?? {}) as any}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建 GenerateReportButton 组件**

```tsx
// src/components/reports/GenerateReportButton.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateReportButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    setLoading(true);
    await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "weekly" }),
    });
    setLoading(false);
    router.refresh();
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="ceremonial-tap primary px-4 py-2 rounded-full text-sm"
      style={{
        background: "var(--gold-gradient)",
        color: "#1a120b",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "生成中…" : "生成本周报告"}
    </button>
  );
}
```

- [ ] **Step 5: 验证 + 提交**

```bash
npx tsc --noEmit
git add src/app/api/reports/ src/app/\(app\)/reports/ src/components/reports/
git commit -m "feat(reports): add weekly/monthly AI report generation"
```

---

## 实施检查清单

完成所有 Task 后，确认：

- [ ] 4 张新迁移文件已在 Supabase 执行
- [ ] `mood_logs` 表可读写
- [ ] 心情页 `/mood` 显示折线图
- [ ] `daily_questions` + `daily_question_answers` 可读写
- [ ] 每日一问页 `/daily-question` 显示问题并可保存回答
- [ ] 愿望看板 `/manifest-board` 显示所有显化为卡片网格
- [ ] 标签 API + `/tags` 页面可创建/查看标签
- [ ] 周报月报 API 可生成 + `/reports` 页面展示
- [ ] 所有 6 个 Task 的 git commit 均已执行

---

## Spec 覆盖率自查

| Spec 章节 | 对应 Task |
|-----------|----------|
| 5.2 数据库 schema（6 张表） | Task 1 |
| 5.3.1 心情追踪 | Task 2 |
| 5.3.2 愿望看板 | Task 4 |
| 5.3.3 每日一问 | Task 3 |
| 5.3.4 标签体系 | Task 5 |
| 5.3.5 周报月报 | Task 6 |