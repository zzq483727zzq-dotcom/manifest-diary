# Design System — Clarity

<!-- impeccable:design-schema from new-work Operate rebuild 2026-07-28 -->

## Mode

**Operate.** The visitor completes project execution tasks. Scanability, consistency, and familiar affordances outrank marketing expression.

## Design Read

Reading this as: personal project execution workbench for a solo developer and resume reviewers, with a Linear-clean light modern language, leaning toward restrained teal accent + system sans + dense-but-breathing desk layout.

## Dials (adapted for product UI)

- DESIGN_VARIANCE: 4 (predictable product structure)
- MOTION_INTENSITY: 3 (state feedback only)
- VISUAL_DENSITY: 5 (daily app desk, not art gallery)

## World — “Cool Fog Desk”

Physical scene: daytime laptop desk under cool ambient light; paper-white surfaces, soft fog canvas, near-black ink, one teal instrument accent. Premium means precision and quiet materials, not gold glow or glass carnival.

### Color strategy: Restrained

| Role | Token | Value |
|------|-------|-------|
| Canvas | `--c-canvas` | `#F3F5F7` |
| Panel | `--c-panel` | `#FFFFFF` |
| Soft | `--c-soft` | `#E8ECF1` |
| Ink | `--c-ink` | `#0F172A` |
| Muted | `--c-muted` | `#64748B` |
| Line | `--c-line` | `rgba(15, 23, 42, 0.09)` |
| Accent | `--c-accent` | `#0F766E` |
| Accent soft | `--c-accent-soft` | `rgba(15, 118, 110, 0.12)` |
| Accent deep | `--c-accent-deep` | `#0D5F59` |
| Danger | `--c-danger` | `#BE123C` |
| Success | `--c-success` | `#15803D` |
| Warning | `--c-warning` | `#B45309` |
| Shadow | `--c-shadow` | `0 1px 2px rgba(15,23,42,0.04), 0 12px 32px rgba(15,23,42,0.06)` |

Project chip colors stay pastel markers only: `#5EEAD4 #7DD3FC #C4B5FD #FBBF24 #FB7185 #86EFAC`.

### Typography

One system UI stack (no display serif, no Inter-as-hero):
`"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif`

Scale (fixed rem, ~1.15 ratio):
- Display page title: 28–32px / 650 / -0.03em
- Section title: 16–18px / 650
- Body: 14px / 400 / 1.55
- Meta/label: 12px / 500 / muted
- Data/stat: 22–24px / 650 / tabular-ish tracking

### Shape

Radius scale: controls 10px, cards 14px, pills 999px, brand mark 12px. One system only.

### Depth

Hairline borders first. Soft dual-layer shadow only on elevated panels (sidebar active nav, drawers, auth card). No colored glow halos. No gradient text.

### Layout

- Desktop ≥1100px: 248px sidebar + content max 1160px
- Mobile <1100px: bottom tab bar, full-screen drawers
- Spacing base 4: 8 / 12 / 16 / 24 / 32 / 48

### Motion

150–200ms `cubic-bezier(0.16, 1, 0.3, 1)` on color/border/transform. Active press `scale(0.98)`. No page-load choreography. Honor `prefers-reduced-motion`.

### Components

- Primary button: solid accent, white label
- Secondary: white + line border
- Danger: rose wash
- Filter chips: pill, active = accent soft fill
- Cards: white panel + line, optional light shadow on interactive hover
- Drawer: right sheet, 440–520px
- Board columns: soft panel, task cards white
- Priority: 8px dots only (high rose / mid amber / low slate)
- Empty states: composed copy + primary action; optional generated illustration

### Imagery stance

Product UI is mostly semantic. AI imagery is used for:
1. Direction comps (design process)
2. Optional empty-state / brand mark atmosphere (not fake screenshots of the app)

Never rasterize live controls or core UI text.

### Anti-references (do not ship)

- Old night indigo + gold lamp theme
- Cosmos purple manifestation look
- Section numbers 01/02/03 as nav costume
- Marketing uppercase eyebrows on every block
- Bounce easing, gradient text, glass everywhere
- Three equal feature cards as home structure

## Signature

Quiet teal instrument mark + fog canvas + dense project desk. If the accent were removed, hierarchy and spacing alone should still read as a serious execution tool.
