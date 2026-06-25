# Plan A: AI 人格重写 + 大记忆系统

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Goal:** 实现「月隐」显化人格（完整重写）、复盘人格微调、用户记忆读写系统。
>
> **Architecture:** 两个人格 prompt 分离，记忆系统以 key-value + importance 方式存储，读取时按 importance 排序注入 context。
>
> **Tech Stack:** Next.js App Router, Supabase (Postgres), MiniMax-M2.7-highspeed via jisu.aicodee.com, TypeScript strict mode.
>
> **Supabase Migration:** 新增 `user_memory` 表，无破坏性变更。

---

## 文件结构

```
新增/修改的文件：

supabase/migrations/
  00002_user_memory.sql          -- 新增 user_memory 表

src/lib/ai/prompts/
  echo.ts                        -- 重写为「月隐」人格（完全替换）
  reflection.ts                  -- 微调：去除硬编码"明早"，增加 emotional_note

src/lib/ai/memory.ts            -- 新建：记忆读写核心逻辑

src/app/api/ai/reflect/route.ts -- 集成记忆读取
src/app/api/manifest/ai/route.ts-- 集成月隐人格 + 记忆写入
src/app/api/journal/route.ts    -- 复盘成功后触发记忆写入
```

---

## Task 1: 创建 user_memory 数据库表

**Files:**
- Create: `supabase/migrations/00002_user_memory.sql`

- [ ] **Step 1: 创建迁移文件**

```sql
-- ============================================
-- Manifest Diary: User Memory Table
-- ============================================

CREATE TABLE public.user_memory (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  memory_type  TEXT NOT NULL CHECK (memory_type IN ('theme', 'emotion_pattern', 'growth', 'preference')),
  content      TEXT NOT NULL,
  evidence     TEXT NOT NULL,
  importance   INTEGER DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  deleted_at   TIMESTAMPTZ  -- 软删除
);

CREATE INDEX idx_user_memory_user_importance ON public.user_memory(user_id, importance DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_memory_user_type ON public.user_memory(user_id, memory_type) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own memory"
  ON public.user_memory FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: 在 Supabase Dashboard 执行此 SQL**

在 Supabase SQL Editor 中运行上述 SQL，或通过 Supabase CLI：
```bash
npx supabase db push
```

---

## Task 2: 重写显化人格「月隐」prompt

**Files:**
- Modify: `src/lib/ai/prompts/echo.ts`（完全替换内容）

- [ ] **Step 1: 完全重写 echo.ts**

将 `src/lib/ai/prompts/echo.ts` 的内容替换为：

```typescript
/**
 * 月隐——月光下的密友
 * 显化意图的 AI echo 人格，完全重写。
 * 核心：共时性呼应，笃定语气，温柔低语，40-60字。
 */

export function buildEchoPrompt(intention: string): string {
  return `# 你是谁

你叫月隐。是月光下的密友，一位浪漫而深邃的共时者。

你的本质：
- 月光下的低语者，轻柔、神秘、有魔力
- 你用诗意的方式呼应用户的愿望，给出意想不到的视角
- 你善于说「也许这不只是巧合……」「你有没有注意到……」
- 你从不催促，让愿望自己显化

你不是：
- 心理咨询师（不分析、不点评）
- 人生教练（不给建议、不设目标）
- 玄学神棍（不说"宇宙能量"、"频率"、"磁场"）
- 唠叨的诗人（你有诗意但不矫情，不押韵不堆砌）

# 你的回应规则

## 共时性实践指南

当用户写下意图时，你要找到其中的「隐藏信号」：

用户写：「我想遇到一个真正懂我的人」
月隐视角：「"懂"这个字，你用了两次。这不是巧合——你已经知道那是什么感觉了，只是还没遇到那个人。」

用户写：「我想有钱，买自己想要的东西」
月隐视角：「你上次用"想要"而不是"需要"，是什么时候？」

用户写：「我希望自己更自信」
月隐视角：「"更"自信——那说明自信已经在那里了，只是在等一个机会站出来。」

核心心法：不否定用户的愿望，不分析为什么还没实现，而是找到一个「它已经在发生」的切入点。

## 你的回应公式

第一句：确认收到（1-2句，笃定）
第二句：共时性呼应（1-2句，从用户意图里找一个隐藏信号）
语气：轻柔，像月光不留痕迹
总字数：40-60字

## 严禁

- 分析用户为什么有这个愿望
- 给实现路径（"你应该先……然后……"）
- 玄学话术（「宇宙能量场」「频率对了」「吸引力法则」「磁场感应」）
- 鸡汤（「加油」「相信自己」「你一定可以」）
- 超过 60 字
- 反问句堆叠（超过两个反问连用）
- 替用户说话（"我觉得你应该……"）
- 否定愿望（"这个有点难……"）

# 用户的意图

${intention}

# 输出格式

直接输出纯文本，不要 JSON，不要 markdown，不要引号。就是你回给用户的那句话。`;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/ai/prompts/echo.ts
git commit -m "feat(manifest): rewrite echo prompt to 月隐 persona"
```

---

## Task 3: 微调复盘人格 prompt

**Files:**
- Modify: `src/lib/ai/prompts/reflection.ts`

**改动点：**
1. `tomorrow_script` 里的时间不再硬编码「明早」，改为 LLM 自主决定
2. 增加 `emotional_note` 字段说明（不超过 20 字）

- [ ] **Step 1: 修改 tomorrow_script 规则段落**

找到 `reflection.ts` 中的 `### tomorrow_script 设计规则` 段落，将：
```
- 第 1 步：睁眼 30 秒内能做的身体动作（喝水/拉窗帘/起身坐 10 秒）
```
改为：
```
- 第 1 步：睁眼 30 秒内能做的身体动作（喝水/拉窗帘/起身坐 10 秒），时间由你根据用户当天的情绪状态自主决定，可以是"明早醒来后"、"午后"、"睡前"等，不要固定为"明早"
```

同时在 `## 翻译层的规则` 的 JSON 示例之后，加一段：

```
### emotional_note 规则（可选）

如果用户当天情绪明显低落（在 raw_input 中有明显负面情绪词：崩溃/绝望/难过/累/撑不住），在接住层最后加一句托底的话，不超过 20 字。
格式：在接住层末尾用「——」连接，如「收到了。——天亮了会好一点。」
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/ai/prompts/reflection.ts
git commit -m "feat(reflection): loosen tomorrow_script timing, add emotional_note"
```

---

## Task 4: 创建记忆读写核心模块

**Files:**
- Create: `src/lib/ai/memory.ts`

- [ ] **Step 1: 创建 memory.ts**

```typescript
import { createClient } from '@/lib/supabase/server';

export type MemoryType = 'theme' | 'emotion_pattern' | 'growth' | 'preference';

export interface UserMemory {
  id: string;
  user_id: string;
  created_at: string;
  memory_type: MemoryType;
  content: string;
  evidence: string;
  importance: number;
}

/**
 * 从 Supabase 读取当前用户最相关的记忆。
 * @param userId - 用户 ID
 * @param limit - 最多返回几条（默认 5）
 * @returns 按 importance 降序排列的记忆数组
 */
export async function loadUserMemory(userId: string, limit = 5): Promise<UserMemory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_memory')
    .select('id, memory_type, content, evidence, importance, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('importance', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as UserMemory[];
}

/**
 * 将记忆片段注入 system prompt。
 * 返回格式化的字符串，注入到 prompt 的 {{user_memory}} 变量处。
 */
export function formatMemoryForPrompt(memories: UserMemory[]): string {
  if (memories.length === 0) return '（暂无关于你的记忆。）';
  return (
    '【关于你】\n' +
    memories
      .map(
        (m) =>
          `- ${m.content}${m.evidence ? `（来源：${m.evidence.slice(0, 30)}）` : ''}`
      )
      .join('\n')
  );
}

/**
 * 写入一条新记忆。
 */
export async function saveUserMemory(params: {
  userId: string;
  memoryType: MemoryType;
  content: string;
  evidence: string;
  importance?: number;
}): Promise<void> {
  const supabase = await createClient();
  await supabase.from('user_memory').insert({
    user_id: params.userId,
    memory_type: params.memoryType,
    content: params.content,
    evidence: params.evidence,
    importance: params.importance ?? 3,
  });
}

/**
 * 检查同类旧记忆是否存在，必要时合并（提升 importance）。
 * 如果同类型、同内容的记忆已存在，提升其 importance +1。
 */
export async function upsertMemoryIfSimilar(params: {
  userId: string;
  memoryType: MemoryType;
  content: string;
  evidence: string;
  importance?: number;
}): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_memory')
    .select('id, importance')
    .eq('user_id', params.userId)
    .eq('memory_type', params.memoryType)
    .is('deleted_at', null)
    .ilike('content', `%${params.content.slice(0, 20)}%`)
    .limit(1);

  if (data && data.length > 0) {
    await supabase
      .from('user_memory')
      .update({ importance: Math.min(5, (data[0].importance ?? 3) + 1) })
      .eq('id', data[0].id);
  } else {
    await saveUserMemory(params);
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/ai/memory.ts
git commit -m "feat(memory): add user memory read/write core module"
```

---

## Task 5: 在 reflect API 中集成记忆读取

**Files:**
- Modify: `src/app/api/ai/reflect/route.ts`

**改动点：** 在 system prompt 中注入 `{{user_memory}}` 变量。

- [ ] **Step 1: 修改 reflect/route.ts**

在 `buildReflectionPrompt` 调用处，增加 memory 注入：

在文件顶部确认导入存在：
```typescript
import { loadUserMemory, formatMemoryForPrompt } from '@/lib/ai/memory';
```

找到这行：
```typescript
const systemPrompt = buildReflectionPrompt({
  currentTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
  recentContext: body.recentContext,
});
```

改为：
```typescript
const memories = await loadUserMemory(user.id, 5);
const memoryContext = formatMemoryForPrompt(memories);
const systemPrompt = buildReflectionPrompt({
  currentTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
  recentContext: body.recentContext,
  userMemory: memoryContext,
});
```

- [ ] **Step 2: 更新 reflection prompt 模板**

在 `src/lib/ai/prompts/reflection.ts` 中：

在 `# 用户的当前状态` 部分，将：
```
当前时间：{{current_time}}
{{recent_context}}
```

改为：
```
当前时间：{{current_time}}
{{recent_context}}

{{user_memory}}
```

同时更新 `buildReflectionPrompt` 函数签名：
```typescript
interface ReflectionPromptContext {
  currentTime: string;
  recentContext?: string;
  userMemory?: string;  // 新增
}

export function buildReflectionPrompt(context: ReflectionPromptContext): string {
  return REFLECTION_SYSTEM_PROMPT
    .replace('{{current_time}}', context.currentTime)
    .replace('{{recent_context}}', context.recentContext
      ? `最近记录摘要：${context.recentContext}`
      : '这是用户第一次使用，没有历史记录。')
    .replace('{{user_memory}}', context.userMemory ?? '（暂无关于你的记忆。）');
}
```

- [ ] **Step 3: 提交**

```bash
git add src/app/api/ai/reflect/route.ts src/lib/ai/prompts/reflection.ts
git commit -m "feat(reflection): inject user memory into AI context"
```

---

## Task 6: 在 manifest API 中集成月隐人格 + 记忆写入

**Files:**
- Modify: `src/app/api/manifest/ai/route.ts`

**改动点：**
1. manifest/ai 现在使用新的月隐人格（已通过 echo.ts 重写生效，无需改这里）
2. 在显化成功后，调用记忆写入

- [ ] **Step 1: 在 manifest/ai/route.ts 中集成记忆写入**

在文件顶部添加导入：
```typescript
import { upsertMemoryIfSimilar } from '@/lib/ai/memory';
```

找到 `isEcho` 分支的成功处理块（约第 66-68 行）：
```typescript
if (isEcho) {
  await supabase.from('manifest_entries').update({ ai_echo: raw }).eq('id', entryId).eq('user_id', user.id);
  return new Response(JSON.stringify({ echo: raw }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
```

在这段 `if (isEcho)` 的 `return` **之前**（即 `await supabase.from(...).update(...)` 之后），添加记忆写入：
```typescript
// 记忆写入：从意图中提炼记忆片段
try {
  await upsertMemoryIfSimilar({
    userId: user.id,
    memoryType: 'theme',
    content: `用户显化意图：「${intention.slice(0, 50)}${intention.length > 50 ? '…' : ''}」`,
    evidence: intention,
    importance: 3,
  });
} catch (e) {
  console.error('[manifest/ai] memory write failed:', e);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/api/manifest/ai/route.ts
git commit -m "feat(manifest): write memory fragment after each echo"
```

---

## Task 7: 在 journal API 中集成记忆写入

**Files:**
- Modify: `src/app/api/journal/route.ts`

**改动点：** 复盘成功后（status = 'finalized'），从 AI structured 响应中提炼记忆并写入。

- [ ] **Step 1: 在 journal/route.ts 中集成记忆写入**

在文件顶部添加导入：
```typescript
import { upsertMemoryIfSimilar } from '@/lib/ai/memory';
```

找到 `journal_entries` insert 成功之后，在 `return NextResponse.json(journal, { status: 201 })` **之前**，添加：

```typescript
// 记忆写入：从复盘中提炼用户画像
if (body.aiStructured) {
  try {
    const struct = body.aiStructured;
    // 从 highlights 提炼主题记忆
    if (struct.highlights && struct.highlights.length > 0) {
      const top = struct.highlights[0];
      await upsertMemoryIfSimilar({
        userId: user.id,
        memoryType: 'growth',
        content: `用户近期高光：${top.fact}`,
        evidence: top.why_it_counts,
        importance: 2,
      });
    }
    // 从 cognitive_bugs 提炼情绪模式记忆
    if (struct.cognitive_bugs && struct.cognitive_bugs.length > 0) {
      const bug = struct.cognitive_bugs[0];
      await upsertMemoryIfSimilar({
        userId: user.id,
        memoryType: 'emotion_pattern',
        content: `用户容易出现认知盲点：${bug.user_quote.slice(0, 30)}`,
        evidence: bug.reframe,
        importance: 2,
      });
    }
  } catch (e) {
    console.error('[journal] memory write failed:', e);
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/api/journal/route.ts
git commit -m "feat(journal): extract and write memory after reflection finalize"
```

---

## 实施检查清单

完成所有 Task 后，确认以下内容：

- [ ] `supabase/migrations/00002_user_memory.sql` 已在 Supabase 执行
- [ ] `echo.ts` 内容为月隐人格，文件中无「宇宙回声」字样
- [ ] `reflection.ts` 中 tomorrow_script 不再硬编码「明早」
- [ ] `memory.ts` 包含 `loadUserMemory`、`formatMemoryForPrompt`、`saveUserMemory`、`upsertMemoryIfSimilar` 四个函数
- [ ] reflect API 响应中注入了 `【关于你】` 格式的记忆 context
- [ ] manifest API 每次 echo 成功后写入了记忆
- [ ] journal API 每次 finalized 后写入了 highlights + cognitive_bugs 记忆
- [ ] 所有 7 个 Task 的 git commit 均已执行

---

## Spec 覆盖率自查

| Spec 章节 | 对应 Task |
|-----------|----------|
| AI 人格——月隐（重写） | Task 2 |
| AI 人格——复盘（微调） | Task 3 |
| 大记忆——数据库 | Task 1 |
| 大记忆——读写模块 | Task 4 |
| 大记忆——读取（reflect 集成） | Task 5 |
| 大记忆——写入（manifest 集成） | Task 6 |
| 大记忆——写入（journal 集成） | Task 7 |

**无遗漏。**
