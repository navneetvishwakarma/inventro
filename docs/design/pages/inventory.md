---
doc: design-page
page: inventory
req: REQ-13, REQ-14
status: approved
---

# Inventory (`app/(app)/inventory/*`)

**Current:** category-grouped list, decent structure, but stock state is
text ("2 receipts waiting", cadence spelled out) rather than chip-first;
desktop view is a single narrow card flush-left with large dead whitespace
to the right (confirmed via production screenshot); item rows have no
hover feedback.

**v2 target:**
- Data-dense density rule: `--space-3` row padding.
- Stock-state + cadence-bucket + staple render as `Badge` chips ahead of
  the item name (see `components.md`).
- Item rows get the `interactive` hover-lift.
- Qty + days-remaining columns: `font-mono tabular-nums`, right-aligned.
- Desktop: content canvas capped at 1024px centered, add a 3-up stat row
  (total items / low stock / staples tracked) above the list for
  at-a-glance summary, then the grouped list or a table view.
- Sparkline (`sparkline.tsx`, already exists) gets a highlighted endpoint
  per the dataviz "give sparklines the same care as type" principle —
  currently flat single-color, mark the latest point.
