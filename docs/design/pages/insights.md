---
doc: design-page
page: insights
req: REQ-19
status: approved
---

# Insights (`app/(app)/insights/*`)

**Current:** progress-bar-based budget view (hand-rolled component,
duplicated with an identical one in Settings — flagged separately as a
consistency finding, not a REQ-29 visual issue).

**v2 target:**
- Budget vs. spend: stat-tile row (spent / remaining / projected) using
  `font-mono tabular-nums`, matching the Inventory desktop stat-row
  pattern for cross-page consistency.
- Top-10 spend items: table with right-aligned tabular numerics, row hover.
- Price-change alerts: chip-first (`+18%` as a warning/error chip next to
  item name), not a separate text callout.
- Waste report: same chip pattern for waste-value.
- **Dev-feasibility flag:** the duplicated `ProgressBar` (insights vs.
  settings) should be consolidated into one `components/ui` primitive
  before this page's implementation story, not styled twice.
