---
doc: design-page
page: review
req: REQ-08, REQ-09, REQ-10, REQ-11, REQ-12
status: approved
---

# Review queue (`app/(app)/review/*`)

**Current:** functional split view (raw text + editable fields), already
reasonably good structurally; needs the same visual-hierarchy pass as
everything else — raw-text card and needs-review/new-item states aren't
visually distinguished beyond a border color.

**v2 target:**
- Raw-text line: left border-accent stripe using the semantic warning/info
  color already used, kept but paired with an explicit chip
  ("Needs review" / "New item" / "Past order") at the top of the card, not
  inferred from border color alone (a11y: color is not the only indicator).
- Field labels/inputs: no change (already fixed for a11y in the prior
  pass — `aria-describedby`, labels). Visual-only: form-dense containment,
  `--space-4` field gaps.
- Commit/Save actions: primary button stays `--brand`; ensure disabled
  state (no date confirmed) has a visibly distinct look, not just the
  default `disabled:opacity-50` — pair with inline helper text ("Confirm
  a date to enable Commit").
