---
doc: design-page
page: plan-shopping
req: REQ-17, REQ-18
status: draft
---

# Plan + Shopping list (`app/(app)/plan/*`, `app/(app)/shopping-list/*`)

**Current:** bucket tabs + item cards with snooze/skip/exclude actions,
functionally solid (touch targets already fixed); visually flat like the
rest — bucket tabs are pill outlines with no fill/weight difference beyond
the active state's subtle tint.

**v2 target:**
- Bucket tabs: active state gets a filled `--brand-wash` background
  (already the pattern) but count badges become `font-mono tabular-nums`
  chips, not plain `(0)` text.
- Item cards within a bucket: data-dense row padding, due-date rendered as
  a chip (color scales from neutral -> warning -> error as due date
  approaches, mirroring the Inventory low-stock chip).
- Shopping list: checkbox + item row uses the same chip-first pattern;
  "Total paid" input inline stays as-is (already fixed for a11y), visual
  polish only — align to the data-dense row rhythm.
