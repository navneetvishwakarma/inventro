---
doc: design-components
project: Inventro
status: draft
req: REQ-29
updated: 2026-08-01
---

# Component deltas v2

Component API surfaces are unchanged — this is styling-only, no prop
changes, so nothing downstream of `components/ui/*` needs a call-site edit
beyond className tuning inside the primitive itself.

## `Card` (`components/ui/card.tsx`)
- Default stays `shadow-sm` + `border-border`.
- New: an `interactive` visual treatment (item cards, catalog rows, any
  card that's a click target) gets the hover-lift rule from `tokens.md`
  (`elevation-interactive`). Not every `Card` usage is interactive — static
  content cards (Today's summary, Settings sections) stay resting-only.

## `Button` (`components/ui/button.tsx`)
- No color/size changes (already fixed in the prior fidelity pass).
- `outline`/`ghost` variants gain the same hover-lift transition as
  interactive cards for consistency, not just a background swap.

## Item rows / list rows (`components/ui/list-row.tsx`, `item-card.tsx`, catalog rows)
- Adopt the chip-first status pattern: cadence bucket, stock state, and
  staple flag render as `Badge` (existing tones — no new tones needed)
  positioned before/alongside the item name, not buried in body text.
- Stock qty + days-remaining columns: `font-mono tabular-nums`.
- Data-dense screens: row padding drops to `--space-3`.

## `Table` (`components/ui/table.tsx`)
- Sticky header on scroll for long lists (Catalog, Inventory desktop view).
- Numeric columns right-aligned + `tabular-nums`.
- Row hover: `bg-surface-sunken` (already the pattern per the earlier
  fidelity fix), kept as-is.

## Page shell (`app/(app)/layout.tsx` and per-page containers)
- Content wrapper gets the density-appropriate `max-w-*` from `tokens.md`,
  centered (`mx-auto`) instead of each page hand-rolling its own
  `max-w-[NNNpx]` value (grep shows at least `catalog-manager.tsx`'s
  `max-w-[620px]` doing this ad hoc — that's the drift this fixes).
- Page-level top/bottom padding: `--space-6` desktop, `--space-4` mobile
  (already mostly true; making it a stated rule, not an accident).

## Empty states (`components/ui/empty-state.tsx`)
- No structural change. v2 asks every empty state to pair its message with
  a relevant lucide icon at `size-8`–`size-10` in `text-fg-subtle`, since
  several currently ship text-only (Today's zero-data state is the
  reference example already done right — extend that pattern app-wide).

## Deferred (explicitly out of scope for REQ-29)

- No new component primitives. Every screen in `docs/design/pages/` is
  built from what already exists in `components/ui/*`.
- No icon set change (lucide stays).
- No motion beyond the hover-lift + existing shimmer/reduced-motion
  patterns — no page-transition animation, no skeleton redesign.
