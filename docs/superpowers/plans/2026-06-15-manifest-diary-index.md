# Manifest Diary — Implementation Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement these plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build v1 of Manifest Diary — an AI-powered Web journaling companion for night reflection, morning scripts, and manifestation.

**Spec:** [`docs/superpowers/specs/2026-06-15-manifest-diary-design.md`](../specs/2026-06-15-manifest-diary-design.md)

**Tech Stack:** Next.js 14 (App Router) + TypeScript + TailwindCSS + Supabase (Postgres + Auth + RLS) + DeepSeek-V4-Flash via dreamfield proxy + Vitest (testing) + Playwright (E2E)

---

## Plans (execute in order)

| # | Milestone | Plan | Estimated |
|---|-----------|------|-----------|
| M1 | Foundation: Next.js + Supabase + Auth + Deploy | [`2026-06-15-m1-foundation.md`](./2026-06-15-m1-foundation.md) | 2-3 days |
| M2 | AI Loop: Mode 1 Prompt + `/api/ai/reflect` + Validation | [`2026-06-15-m2-ai-loop.md`](./2026-06-15-m2-ai-loop.md) | 2-3 days |
| M3 | Reflection & Tomorrow Script Main Flow + Themes + Voice | [`2026-06-15-m3-reflection-flow.md`](./2026-06-15-m3-reflection-flow.md) | 3-4 days |
| M4 | Manifest Diary: Mode 2 Echo + Mode 3 Lightweight Analysis | [`2026-06-15-m4-manifest.md`](./2026-06-15-m4-manifest.md) | 2-3 days |
| M5 | Calendar History + Search + Mobile Polish + Launch | [`2026-06-15-m5-history-launch.md`](./2026-06-15-m5-history-launch.md) | 2 days |

**Each milestone produces working, testable software on its own.** Do not start M2 until M1's exit criteria are met, and so on.

---

## Cross-Cutting Conventions

These apply to every plan — engineers reading any single milestone need to know these.

### File Layout

```
manifest-diary/
├─ app/                          # Next.js App Router
│  ├─ (auth)/login/page.tsx
│  ├─ (auth)/signup/page.tsx
│  ├─ (app)/                     # Protected routes group
│  │  ├─ layout.tsx              # Auth guard + theme provider
│  │  ├─ page.tsx                # Home (morning script view)
│  │  ├─ reflect/page.tsx        # Night reflection
│  │  ├─ manifest/page.tsx       # Manifestation diary
│  │  └─ history/page.tsx        # Calendar
│  ├─ api/
│  │  ├─ journal/route.ts
│  │  ├─ manifest/route.ts
│  │  ├─ scripts/route.ts
│  │  ├─ ai/reflect/route.ts
│  │  ├─ ai/echo/route.ts
│  │  └─ ai/analyze/route.ts
│  └─ layout.tsx                 # Root layout
├─ components/
│  ├─ ui/                        # Primitive components (Button, Card, Input)
│  ├─ reflection/                # Mode-1 specific: HighlightCard, BugCard, ScriptCard
│  ├─ manifest/                  # Manifest-specific: IntentionForm, EchoBubble
│  ├─ voice/                     # VoiceRecorder hook + button
│  └─ theme/                     # ThemeProvider, theme switcher
├─ lib/
│  ├─ supabase/
│  │  ├─ client.ts               # Browser client
│  │  └─ server.ts               # Server client (RLS-respecting)
│  ├─ ai/
│  │  ├─ client.ts               # DeepSeek API wrapper
│  │  ├─ prompts/
│  │  │  ├─ reflect.ts           # Mode 1 system prompt
│  │  │  ├─ echo.ts              # Mode 2 system prompt
│  │  │  └─ analyze.ts           # Mode 3 system prompt
│  │  ├─ schemas.ts              # Zod schemas for AI JSON output
│  │  └─ parser.ts               # Parse "text\n\n{json}" hybrid format
│  ├─ date.ts                    # entry_date logic (cutoff at 02:00)
│  └─ types.ts                   # Shared TS types
├─ supabase/
│  └─ migrations/                # SQL migration files
├─ tests/
│  ├─ unit/                      # Vitest
│  └─ e2e/                       # Playwright
├─ .env.local                    # Local secrets (gitignored)
├─ .env.example                  # Template
├─ next.config.mjs
├─ tailwind.config.ts
├─ tsconfig.json
├─ vitest.config.ts
├─ playwright.config.ts
└─ package.json
```

### Conventions

1. **TypeScript strict mode.** No `any` without comment justifying it.
2. **Path alias:** `@/*` → project root (configured in `tsconfig.json` and `vitest.config.ts`).
3. **Server vs client:** Default to server components. Add `'use client'` only when interactivity needs it.
4. **Supabase access patterns:**
   - Server: `createServerClient()` from `@/lib/supabase/server` — uses cookies, respects RLS.
   - Client: `createBrowserClient()` from `@/lib/supabase/client` — also respects RLS.
   - Never use service-role key in this codebase.
5. **Error handling in API routes:** Always return `{ error: string }` with appropriate HTTP status. Never throw uncaught.
6. **Tests:** TDD per task. Write failing test first, watch it fail, implement, watch it pass, commit.
7. **Commits:** Small and frequent. Conventional commits style: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`.
8. **No secrets in code.** All keys in `.env.local`. `.env.example` lists required keys with empty values.
9. **Theme tokens:** All colors live in `tailwind.config.ts` as semantic names (`bg-night`, `bg-garden`, `accent-rose-gold`). No raw hex in components.

### Required Environment Variables

```
# .env.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_AUTH_TOKEN=
ANTHROPIC_BASE_URL=https://www.dreamfield.top
ANTHROPIC_MODEL=DeepSeek-V4-Flash
```

### Testing Strategy

- **Unit (Vitest):** Pure functions in `lib/` — date logic, AI parser, schema validation, prompt construction.
- **API integration (Vitest):** Mock Supabase + DeepSeek; assert API routes shape responses correctly, validate inputs, enforce auth.
- **E2E (Playwright):** Critical user flows once per milestone — login → reflect → save, login → manifest → save, login → check off script.
- **AI quality:** No automated test for prose quality. Manual verification at end of M2 against the spec's persona rules.

---

## Spec Coverage Map

Every requirement in the spec is covered by at least one task. This map is for cross-checking during plan self-review.

| Spec Section | Plan(s) |
|---|---|
| §1 产品定位 / 核心理念 | All — embedded in prompt design (M2) and UI tone (M3, M4) |
| §2 视觉风格 (3 themes) | M3 (day/night), M4 (cosmic) |
| §3.1 夜间复盘流程 | M3 |
| §3.2 早晨脚本视图 | M3 |
| §3.3 日历回看 | M5 |
| §4 语音输入规格 | M3 |
| §5 模式 1 prompt | M2 |
| §5 模式 2 prompt | M4 |
| §5 模式 3 prompt | M4 |
| §6 数据模型 (5 tables) | M1 (schema + RLS) |
| §7 系统架构 / 部署 | M1 (deploy), M2 (AI client), M3-M5 (UI) |
| §8.1 复盘 UI | M3 |
| §8.2 早晨脚本 | M3 |
| §8.3 显化日记 | M4 |
| §8.4 历史回看 | M5 |
| §8.5 基础设施 | M1 (auth, RLS), M3 (themes), M5 (responsive) |
| §10 成功标准 | M5 (final manual verification) |

---

## Exit Criteria per Milestone

- **M1 done when:** User can sign up, log in, log out. Vercel preview URL works. All 5 tables exist with RLS policies enforced. CI runs lint + tests.
- **M2 done when:** Calling `POST /api/ai/reflect` with sample text returns valid `{ text: string, structured: { highlights, cognitive_bugs, tomorrow_script } }`. Manual prompt-quality verification passes.
- **M3 done when:** Logged-in user can: write reflection by typing OR voice (10+ min), receive streaming AI response, edit it, save it; next morning sees yesterday's tomorrow_script on home page and can check off steps.
- **M4 done when:** Logged-in user can write a manifestation entry (intention + category), receive AI echo (≤50 chars), see extracted keywords + insight, save it.
- **M5 done when:** Calendar view shows all entries by date; clicking a day shows reflections + manifests; search bar finds entries by keyword; site is responsive on phones; deployed to production domain; AI cost dashboard shows last-7-days spend.

---

When ready to start, open M1 and begin Task 1.
