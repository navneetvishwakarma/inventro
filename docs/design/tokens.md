---
doc: design-tokens
project: Inventro
status: approved
req: REQ-29
updated: 2026-08-03
---

# Tokens v2

Semantic layer unchanged (`--color-primary -> --primary -> --red-*`, etc.,
all still defined in `app/globals.css` `@theme inline`). Only the **values**
below change or are newly introduced. Anything not listed here keeps its
current v1 value.

## New / changed — light

| Token | v1 | v2 | Why |
|---|---|---|---|
| `--background` (canvas) | `--neutral-50` `#FBF8F7` | `#F1E8E4` | v1 was ~1% off white; cards didn't read as elevated. New value keeps the warm-neutral family (not grey) but is deep enough that `shadow-sm` + white surface actually separates. |
| `--surface-sunken` | `--neutral-100` `#F5EFED` | `#F5EDEA` | Minor retune to sit between the new canvas and surface. |
| `--border` | `--neutral-200` `#E9DEDB` | `#E4D5D0` | Slightly stronger so borders hold up against the deeper canvas. |
| `--border-strong` | `--neutral-300` `#D6C4C0` | `#D2BDB6` | Same reason. |
| `--shadow-tint` | `--red-900` (unchanged) | unchanged | Already warm-tinted, kept. |
| `--shadow-sm` | `0 1px 2px ...10%` | `0 1px 2px rgba(60,24,20,.06), 0 1px 1px rgba(60,24,20,.04)` | Slightly more visible resting shadow. |
| `--shadow-md` | existing | `0 6px 16px rgba(60,24,20,.10), 0 2px 5px rgba(60,24,20,.06)` | New standard hover-lift shadow — this is the one that was defined but essentially unused. |

Brand (`--red-*`), secondary (`--gold-*`), tertiary (`--blue-*`), and
semantic status (`--success-*`, `--warning-*`, `--error-*`, `--info-*`)
scales are **unchanged** — they already passed the S-41 contrast pass.

## New / changed — dark

| Token | v1 | v2 | Why |
|---|---|---|---|
| `--background` | `--neutral-950` `#140F0E` | `#17100E` | Paired retune to match the light-mode canvas/surface separation logic; `--surface` (`--neutral-900` `#221B19`) stays, so the gap is preserved the same way. |
| `--shadow-sm`/`--shadow-md` | existing (tint-based) | flat `rgba(0,0,0,.3)` / `rgba(0,0,0,.4)` | Dark-mode shadows read better as neutral-black falloff than tinted; tinted shadows barely show on a dark ground. |

## New token: elevation-interactive (hover-lift)

Not a color token — a **usage rule**, since Tailwind v4 already has
everything needed (`shadow-sm`, `shadow-md`, `duration-(--duration-fast)`,
`ease-(--ease-standard)`):

```css
/* apply to: item-row, catalog row, action buttons, any clickable card */
.elevatable {
  transition: transform var(--duration-fast) var(--ease-standard),
              box-shadow var(--duration-fast) var(--ease-standard);
}
.elevatable:hover, .elevatable:focus-visible {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
@media (prefers-reduced-motion: reduce) {
  .elevatable { transition: none; }
  .elevatable:hover, .elevatable:focus-visible { transform: none; }
}
```

Implementation note: this is a Tailwind utility combo
(`transition-[transform,box-shadow] duration-(--duration-fast)
ease-(--ease-standard) hover:-translate-y-px hover:shadow-md
focus-visible:-translate-y-px focus-visible:shadow-md
motion-reduce:transition-none motion-reduce:hover:translate-y-0`), not a new
CSS class — `.elevatable` above is illustrative, don't add a global class
for it.

## Density rule (spacing, not a new token)

Uses existing `--space-*` scale, just states which screens use which value
as policy (this was the actual source of the "inconsistent" complaint, not
a missing token):

| Screen type | Card/row padding | Section gap |
|---|---|---|
| Data-dense (Inventory, Catalog, Plan, Shopping list, Insights tables) | `--space-3` (12px) | `--space-4` (16px) |
| Content/form (Today, Add, Review line editor, Settings, Onboarding, Gate) | `--space-4`–`--space-5` (16–20px) | `--space-6` (24px) |

## Page canvas containment

New usage rule, no new token (uses `--container-*` already defined):

| Screen type | Max-width | 
|---|---|
| Form-dense (Add, Review, Settings, Onboarding, Gate) | `--container-tablet` (720px), bump to 840px if forms feel cramped at implementation time |
| Data-dense (Inventory, Catalog, Plan, Shopping list, Insights) | `--container-desktop` (1024px), centered in the space right of the sidebar, not flush-left |

## Tabular numerics rule

Every stock quantity, days-remaining, price, and stat-tile number:
`font-mono` (already `--font-mono` = Geist Mono) + `tabular-nums` (Tailwind
`tabular-nums` utility). Already the pattern on the Settings cost meter;
v2 makes it universal for item cards, tables, and the Insights stat row.

## A11y note

Values above reuse the app's already-audited brand/semantic scales for
foreground text and only change background/border/shadow values, which
keeps existing text-contrast pairs intact. Still: re-verify with an
automated contrast check (axe or Playwright + `@axe-core/playwright`) as
part of implementation, not just this write-up — this doc is a design
proposal, not a certified audit.
