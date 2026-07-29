# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user is a solo developer / full-stack learner building personal projects for portfolio, study plans, job prep, and side work. They use Clarity on a laptop or phone, often in short focused sessions: unlock, see what is overdue or due today, push one project forward, log time, leave.

Secondary audience is recruiters and hiring managers reviewing the product as a resume demo of frontend / fullstack craft.

## Product Purpose

Clarity is a local-first personal project execution system. It helps one person turn limited projects into finished outcomes: every task belongs to a project, the home desk surfaces overdue / due-today / high-soon / in-progress work, and due dates, progress, and manual time logs support sustained execution.

Success means the user can unlock, create a project, break it into tasks and light subtasks, complete work with time logged, see the right actions on home and calendar, and export/import a JSON backup — without cloud accounts.

## Positioning

Not a todo pile, not a health diary, not a manifestation journal. The mechanism is project-first execution: tasks must belong to a project, home prioritizes what must move today, and progress + time investment make completion visible.

## Operating Context

- Local password gate (setup once, unlock daily)
- Desktop sidebar + mobile bottom nav at 1100px breakpoint
- Core loop: Today → Projects (board/list + drawer) → Calendar (month/week) → Settings (password + backup)
- Data lives in local SQLite on device; no multi-user collab in v1

## Capabilities and Constraints

Confirmed:
- Projects, tasks, light subtasks (max 20), manual time entries
- Task statuses todo / in_progress / completed; project active / completed / archived
- Priority low/medium/high; optional due dates; Monday-start week
- Today action groups, month+week calendar by due date
- JSON export/import merge by UUID; change local password
- Chinese UI only; web only first

Explicit non-goals for v1:
- Team collab, cloud sync, AI insights, drag board, recurring tasks, tags, rich text, live timer, trash, templates, batch ops, dark theme, Electron first ship

## Brand Commitments

- Name: Clarity · 个人项目执行系统
- Visual direction the user locked: 浅色现代高级工作台 (light modern premium workbench)
- Accent family: restrained teal / cool green (`#0f766e` system, soft project color chips)
- Tone: calm, precise, execution-focused Chinese copy; no mystical / diary language

## Evidence on Hand

- Product design spec: `docs/superpowers/specs/2026-07-28-project-execution-system-design.md`
- Tickets 01–10 implemented on `feat/project-execution-system`
- Live app at local Next.js worktree; functional path works

Do not invent customers, benchmarks, or cloud claims.

## Product Principles

1. Project-first: every task has a home project.
2. Today only shows what needs movement, not every open task.
3. Local privacy is a product feature, not a footnote.
4. Familiar product UI over decorative surprise.
5. Demo-ready clarity for resume review without fake complexity.

## Accessibility & Inclusion

Target WCAG AA contrast for body and controls. Keyboard focus visible. Touch targets usable under 1100px mobile nav. Reduced-motion respected for any non-essential animation.
