---
doc: design
project: Inventro
status: deferred      # draft | approved | deferred — G3 gate, set by the user
req: REQ-29
updated: 2026-08-01
---

> **Deferred (2026-08-01).** This proposal assumed no reference design
> existed. That was wrong — `design/screens/*.html` is a real, already-
> approved reference the app was originally built against, and a full
> audit against it found real, fixable drift (plus two unrelated P0 bugs,
> already shipped). REQ-30 (fidelity remediation against `design/`) is
> now the priority; this v2 direction is preserved here for later
> reconsideration once REQ-30 is done, not discarded.

# Inventro — Design System v2 (REQ-29)

> Gate G3 (throughline). Direction + mockups below; awaiting approval. On
> approval, flip `status` to `approved` — that unblocks Phase F (per-page
> gap-list -> epics).

## Direction: "Warm Utility" — evolve, don't rebrand

The brand hues (red/gold/blue), Geist type, and the existing token
architecture (`--color-primary -> --primary -> --red-600`, semantic layer
over raw palette scale) all stay as-is per REQ-29's acceptance line. What
changes is the **value** layer and a few structural rules that were never
codified, which is why the app drifted inconsistent across E-1–E-16 even
though every individual PR passed review:

1. **Canvas vs. surface separation.** `--background` (`--neutral-50`,
   `#FBF8F7`) and `--surface` (`--neutral-0`, `#FFFFFF`) are currently ~1%
   apart in lightness — cards don't read as elevated because there's almost
   no ground to lift off of. v2 introduces a distinct, slightly deeper warm
   canvas (`#F1E8E4` light / `#17100E` dark) so `shadow-sm` on a white card
   actually does something.
2. **A real elevation scale, used consistently.** Resting cards:
   `shadow-sm`. Interactive rows/cards (item cards, catalog rows, action
   buttons): `shadow-sm` resting -> `shadow-md` + `translateY(-1px)` on
   hover/focus, 150ms `ease-standard` (existing duration/easing tokens,
   already wired for `prefers-reduced-motion`). Sheets/dialogs: `shadow-lg`.
   This was already defined in `--shadow-*` but almost nothing in
   `components/ui` actually used the hover-lift.
3. **Status as chip-first, not text-first.** Stock state, cadence bucket,
   and staple/staple-not are semantic-color chips (Badge already has the
   tone variants — `success`/`warning`/`error`/`info`/`gold`/`neutral`; v2
   is about *using* them on every list row, not introducing new ones).
4. **Desktop containment.** Every page's content canvas gets a per-density
   max-width, centered: `840px` for form-dense screens (Add, Review line
   editor, Settings, Onboarding), `1040–1120px` for data-dense screens
   (Inventory, Catalog, Plan, Shopping list, Insights). Today's production
   Inventory screen at 1440px is a narrow `max-w-[620px]` card flush against
   the sidebar with the remaining ~800px empty — this is the fix for that.
5. **Tabular numerics everywhere a quantity/price/stat appears.** Geist Mono
   + `font-variant-numeric: tabular-nums`, already the pattern on the cost
   meter (`$0.0000`); v2 makes it the rule for every stock qty, days-left,
   and price across item cards, tables, and stat tiles.
6. **Density by screen type**, not one gap value everywhere: `--space-3`
   internal padding + tight row height for data-dense list/table screens,
   `--space-4`/`--space-5` for content/form screens. Documented explicitly
   so it stops being an accident of whoever wrote that page.

None of this touches: brand hex values, font family, icon set (lucide,
already correct), the component API surface, dark-mode strategy, or
`--touch-target-min`/a11y work already shipped in the prior fidelity pass.

Reference mockups (Today, Inventory, Add, Review — mobile; Inventory —
desktop) are in the published artifact linked from the PR description. They
are illustrative of the direction, not pixel specs — `tokens.md` and
`components.md` are the actual implementation contract.

## Why not a heavier redesign (glassmorphism / full rebrand)?

`ui-ux-pro-max`'s style search suggested glassmorphism for "modern SaaS /
lifestyle apps," and the product-type search had no close match for a
grocery inventory tracker (closest hits were banking, airline, wedding
planning — all landing-page-oriented, not useful signal). Rejected because:
Inventro is a data-dense, receipt-parsing, mobile-first utility used in
short high-frequency sessions (checking stock, logging a receipt) — backdrop
blur costs real paint time on the phones this is actually used on, hurts
legibility on text-heavy review/catalog screens, and buys nothing the
existing token architecture doesn't already support more cheaply via a
proper elevation scale. A full rebrand (new hue family, new type) was
rejected because it isn't what REQ-29 asked for, it's a much larger,
harder-to-reverse change (PWA icons, splash screens, theme-color meta,
marketing surfaces all encode the current red), and the existing palette
already tested fine for contrast in the S-41 fidelity pass.

## Contents

- [`tokens.md`](tokens.md) — full v2 token values (light + dark)
- [`components.md`](components.md) — component-level deltas (Card, Button,
  item rows, Badge usage, table, page shell)
- [`pages/`](pages) — per-page brief + gap-list target, one file per major
  screen, each referencing the `REQ-xx` it serves

## Open items surfaced during authoring (dev-feasibility flags)

- New `--canvas` token: `components/ui` primitives reference `--background`
  today for the page-level background; renaming/adding `--canvas` is a
  find-replace across `app/(app)/layout.tsx` and any page setting its own
  background — flagging so it's scoped as its own story, not folded silently
  into whichever page epic touches that file first.
- Hover-lift on `ListRow`/item cards needs `will-change: transform` review
  for scroll-performance on long inventory lists (100+ items) — a
  perf-conscious implementation detail for whoever picks up the Inventory
  epic, not a blocker to approving the direction.
