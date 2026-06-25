# Plan B: 日历合并 + 按钮交互 + 视觉主题

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Goal:** 日历同时显示复盘+显化 dot；关键按钮具备按压-回弹-光泽扫过仪式感；显化页面使用东方玄幻月光雾气主题。
>
> **Architecture:** 日历改 `DayCell.tsx`；按钮 CSS 体系增强 `.ceremonial-tap`；显化页改 `data-theme="cosmos"` + 局部月光雾气效果。
>
> **Tech Stack:** Next.js App Router, Tailwind CSS v4, Framer Motion, Supabase.
>
> **依赖:** Plan A（记忆系统）不直接依赖 Plan B，但两个计划可以独立实施。

---

## 文件结构

```
src/app/globals.css                          -- 增强 ceremonial-tap + 新增 shimmer 动画
src/components/history/DayCell.tsx            -- 增加 journal dot
src/components/history/CalendarGrid.tsx       -- legend 增加复盘说明
src/app/globals.css                          -- cosmos 主题增强（显化页月光雾气）
src/components/manifest/StarfieldBackground.tsx-- 改为月光雾气效果
src/components/manifest/IntentionInput.tsx    -- 一级按钮增强（按压-回弹-光泽）
src/components/manifest/EchoBubble.tsx        -- 加载动画增强
```

---

## Task 1: 日历合并——DayCell 增加 journal dot

**Files:**
- Modify: `src/components/history/DayCell.tsx`

**改动点：** 同一格子内同时显示复盘（空心金色左下）+ 显化（实心金色右下）两种 dot。

- [ ] **Step 1: 查看现有 DayCell 实现**

确认当前 `DayCell` 中 dot 渲染逻辑（应在第 58-71 行附近）：
- `aggregate?.journalCount > 0` → 显示金色空心 dot
- `aggregate?.manifestCount > 0` → 显示金色实心 dot

- [ ] **Step 2: 确认数据结构支持**

`aggregate?.journalCount` 和 `aggregate?.manifestCount` 是否已在 `DailyAggregate` 类型中定义。检查 `src/lib/supabase/history.ts` 中的 `DailyAggregate` 接口。

如果缺少 `journalCount` 字段，需要在 `CalendarGrid.tsx` 的 aggregates 计算逻辑中补充（Supabase 查询需要同时 COUNT journal_entries 和 manifest_entries）。

- [ ] **Step 3: 修改 DayCell.tsx dot 渲染逻辑**

找到约第 58-71 行的 dot 渲染块，将其完全替换为：

```tsx
{hasEntries && (
  <div className="absolute bottom-1.5 flex gap-0.5">
    {(aggregate?.journalCount ?? 0) > 0 && (
      <span
        className="w-1.5 h-1.5 rounded-full border border-[var(--gold-bright)]"
        style={{ background: 'transparent' }}
        title="复盘"
      />
    )}
    {(aggregate?.manifestCount ?? 0) > 0 && (
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: 'var(--gold-solid)' }}
        title="显化"
      />
    )}
  </div>
)}
```

- [ ] **Step 4: 提交**

```bash
git add src/components/history/DayCell.tsx
git commit -m "feat(calendar): show journal hollow dot + manifest solid dot"
```

---

## Task 2: CalendarGrid legend 更新

**Files:**
- Modify: `src/components/history/CalendarGrid.tsx`

- [ ] **Step 1: 更新 legend**

找到 legend 部分（约第 134-152 行），确认复盘和显化的图例说明正确：

```tsx
<span className="flex items-center gap-1.5">
  <span
    className="w-1.5 h-1.5 rounded-full border border-[var(--gold-bright)]"
    style={{ background: 'transparent' }}
  />{" "}
  复盘
</span>
<span className="flex items-center gap-1.5">
  <span
    className="w-1.5 h-1.5 rounded-full"
    style={{ background: 'var(--gold-solid)' }}
  />{" "}
  显化
</span>
```

- [ ] **Step 2: 提交**

```bash
git add src/components/history/CalendarGrid.tsx
git commit -m "fix(calendar): update legend to show hollow dot for reflection"
```

---

## Task 3: 按钮交互——增强 globals.css 的 ceremonial-tap 体系

**Files:**
- Modify: `src/app/globals.css`

**改动点：** 在 `:root` 中新增按钮 CSS 变量和 `@keyframes shimmer-sweep` 动画，增强 `.ceremonial-tap` class。

- [ ] **Step 1: 在 globals.css :root 中新增按钮变量**

在 `:root {` 块内（其他 CSS 变量附近），添加：

```css
  /* ============================================
     按钮交互系统
     ============================================ */
  --btn-scale-press: 0.96;
  --btn-scale-release: 1.02;
  --btn-transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
  --btn-glow-spread: 0 4px 20px rgba(212, 175, 55, 0.35);
```

- [ ] **Step 2: 添加 shimmer sweep keyframes**

在 `globals.css` 末尾（最后一个 `@keyframes` 之后，或在最后一个样式块之后），添加：

```css
/* ============================================
   按钮光泽扫过动画
   ============================================ */
@keyframes shimmer-sweep {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}

@keyframes scale-press {
  0% {
    transform: scale(var(--btn-scale-release, 1.02));
  }
  50% {
    transform: scale(var(--btn-scale-press, 0.96));
  }
  100% {
    transform: scale(1);
  }
}
```

- [ ] **Step 3: 增强 .ceremonial-tap class**

找到现有的 `.ceremonial-tap`（在 globals.css 中），将其替换为：

```css
/* 仪式感按压效果：一级操作按钮 */
.ceremonial-tap {
  cursor: pointer;
  border: none;
  outline: none;
  transition:
    transform var(--btn-transition),
    box-shadow var(--btn-transition);
  will-change: transform;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.ceremonial-tap:active {
  transform: scale(var(--btn-scale-press, 0.96)) !important;
}

.ceremonial-tap.primary {
  position: relative;
  overflow: hidden;
}

.ceremonial-tap.primary::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(255, 255, 255, 0.35) 50%,
    transparent 60%
  );
  background-size: 200% 100%;
  animation: shimmer-sweep 1.8s linear infinite;
  pointer-events: none;
}
```

- [ ] **Step 4: 提交**

```bash
git add src/app/globals.css
git commit -m "feat(ui): add button scale + shimmer animation system"
```

---

## Task 4: 一级按钮组件集成（IntentionInput）

**Files:**
- Modify: `src/components/manifest/IntentionInput.tsx`

**改动点：** 提交按钮加 `.ceremonial-tap.primary` class，实现按压-回弹-光泽扫过。

- [ ] **Step 1: 找到提交按钮**

确认 `.ceremonial-tap` 已应用在提交按钮上（约第 42-58 行的 button）。

- [ ] **Step 2: 增强按钮样式**

找到 button 的 style 属性，在现有样式中增加：
```tsx
style={{
  // ... 现有样式 ...
  transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
  boxShadow: 'var(--btn-glow-spread)',
}}
```

找到 button 的 className，确认包含 `ceremonial-tap primary`：
```tsx
className="ceremonial-tap primary"
```

找到 `onMouseDown`/`onMouseUp` 事件，添加：
```tsx
onMouseDown={() => { e.currentTarget.style.transform = 'scale(0.96)'; }}
onMouseUp={() => { e.currentTarget.style.transform = 'scale(1.02)'; setTimeout(() => { e.currentTarget.style.transform = 'scale(1)'; }, 150); }}
onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
```

（如果现有代码没有这些事件，直接加上即可。）

- [ ] **Step 3: 提交**

```bash
git add src/components/manifest/IntentionInput.tsx
git commit -m "feat(manifest): integrate primary button press-feedback on IntentionInput"
```

---

## Task 5: 显化页面视觉主题——月光雾气效果

**Files:**
- Modify: `src/components/manifest/StarfieldBackground.tsx`
- Modify: `src/app/(app)/manifest/page.tsx`（或对应显化页面）

**改动点：** 显化页面从「星场」改为「月光雾气」——不再是小星点，而是流动的月光雾气 + 隐约光芒。

- [ ] **Step 1: 重新设计 StarfieldBackground 为月光雾气**

将 `src/components/manifest/StarfieldBackground.tsx` 重写为 `MoonMistBackground.tsx`：

```tsx
'use client';

import { useEffect, useRef } from 'react';

interface MoonMistProps {
  isTyping?: boolean;
}

export function MoonMistBackground({ isTyping = false }: MoonMistProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // 雾气粒子
    interface MistParticle { x: number; y: number; vx: number; vy: number; radius: number; opacity: number; phase: number; }
    const particles: MistParticle[] = Array.from({ length: 40 }, () => ({
      x: Math.random() * (canvas.width || window.innerWidth),
      y: Math.random() * (canvas.height || window.innerHeight),
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.2 - 0.05,
      radius: Math.random() * 120 + 60,
      opacity: Math.random() * 0.06 + 0.02,
      phase: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      // 清空
      ctx.clearRect(0, 0, w, h);

      // 深紫黑渐变背景（cosmos 主题）
      const bg = ctx.createRadialGradient(w * 0.7, h * 0.15, 0, w * 0.5, h * 0.5, w * 0.8);
      bg.addColorStop(0, 'rgba(80, 50, 100, 0.5)');
      bg.addColorStop(0.5, 'rgba(30, 20, 50, 0.3)');
      bg.addColorStop(1, 'rgba(10, 5, 20, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 月亮光晕
      const moonX = w * 0.78;
      const moonY = h * 0.18;
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 180);
      moonGlow.addColorStop(0, 'rgba(245, 235, 210, 0.25)');
      moonGlow.addColorStop(0.3, 'rgba(220, 200, 170, 0.12)');
      moonGlow.addColorStop(1, 'rgba(200, 180, 150, 0)');
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 180, 0, Math.PI * 2);
      ctx.fill();

      // 雾气粒子
      time += 0.003;
      for (const p of particles) {
        const ox = Math.sin(time + p.phase) * 15;
        const oy = Math.cos(time * 0.7 + p.phase) * 10;
        const alpha = p.opacity * (0.7 + 0.3 * Math.sin(time * 0.5 + p.phase));
        const grad = ctx.createRadialGradient(p.x + ox, p.y + oy, 0, p.x + ox, p.y + oy, p.radius);
        grad.addColorStop(0, `rgba(200, 190, 220, ${alpha})`);
        grad.addColorStop(0.5, `rgba(160, 150, 190, ${alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(120, 110, 160, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x + ox, p.y + oy, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // 移动
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -p.radius) { p.y = h + p.radius; p.x = Math.random() * w; }
        if (p.x < -p.radius) p.x = w + p.radius;
        if (p.x > w + p.radius) p.x = -p.radius;
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [isTyping]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
```

- [ ] **Step 2: 重命名引用（StarfieldBackground → MoonMistBackground）**

在所有引用 `StarfieldBackground` 的文件中，将：
```tsx
import { StarfieldBackground } from '.../StarfieldBackground';
```
改为：
```tsx
import { MoonMistBackground } from '.../MoonMistBackground';
```

并将 JSX 中的 `<StarfieldBackground ... />` 替换为 `<MoonMistBackground ... />`。

需要检查的文件：
```bash
grep -rl "StarfieldBackground" src/
```

常见位置：`src/app/(app)/manifest/page.tsx` 或 `src/app/manifest/page.tsx`。

- [ ] **Step 3: 提交**

```bash
git add src/components/manifest/StarfieldBackground.tsx
# 如果 StarfieldBackground 被重命名，先 mv 再 add
git add src/app/\(app\)/manifest/page.tsx  # 或对应路径
git commit -m "feat(manifest): replace starfield with moon mist background"
```

---

## Task 6: EchoBubble 加载动画增强

**Files:**
- Modify: `src/components/manifest/EchoBubble.tsx`

**改动点：** AI 回响加载中的三个点动画，从原来的跳动改为「月光脉动」效果——缓慢呼吸的光晕。

- [ ] **Step 1: 找到现有的 dot 动画**

确认当前加载动画的实现（约在 `return` 的 JSX 中）。

- [ ] **Step 2: 替换为月光脉动效果**

找到加载中的 dot 容器（`.flex.items-center.gap-1` 或类似），替换为：

```tsx
{isLoading && (
  <div className="flex items-center gap-2">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="rounded-full"
        style={{
          width: 6,
          height: 6,
          background: 'var(--gold-bright)',
          animation: `moon-breathe 1.4s ease-in-out ${i * 0.2}s infinite`,
          boxShadow: '0 0 8px var(--gold-bright)',
        }}
      />
    ))}
  </div>
)}
```

在 `globals.css` 末尾添加：

```css
@keyframes moon-breathe {
  0%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
    box-shadow: 0 0 4px var(--gold-bright);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
    box-shadow: 0 0 16px var(--gold-bright);
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/manifest/EchoBubble.tsx src/app/globals.css
git commit -m "feat(manifest): replace loading dots with moon-breathe glow animation"
```

---

## 实施检查清单

完成所有 Task 后，确认：

- [ ] DayCell 同时显示空心（复盘）+ 实心（显化）dot
- [ ] CalendarGrid legend 正确标注「复盘」和「显化」
- [ ] `.ceremonial-tap.primary` 的光泽扫过动画正常运行
- [ ] IntentionInput 提交按钮按压缩放 + 松开回弹
- [ ] StarfieldBackground 已替换为 MoonMistBackground（或保留原名但内容已改）
- [ ] 显化页面背景为月光雾气（深紫黑 + 月晕 + 流动雾气）
- [ ] EchoBubble 加载动画为月光脉动效果
- [ ] 所有 6 个 Task 的 git commit 均已执行

---

## Spec 覆盖率自查

| Spec 章节 | 对应 Task |
|-----------|----------|
| 日历合并——DayCell journal dot | Task 1 |
| 日历合并——CalendarGrid legend | Task 2 |
| 按钮交互——CSS 变量 + keyframes | Task 3 |
| 按钮交互——IntentionInput 集成 | Task 4 |
| 视觉——月光雾气背景 | Task 5 |
| 视觉——EchoBubble 加载动画 | Task 6 |

**无遗漏。**
