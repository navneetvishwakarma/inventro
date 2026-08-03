---
doc: design-page
page: today
req: REQ-01, REQ-13, REQ-17
status: approved
---

# Today (`app/(app)/page.tsx`)

**Current:** flat white card, text-only summary, plain-text quick-action
links in two rows, no visual hierarchy between "nothing due" state and
the due-soon list.

**v2 target:**
- Summary becomes a `hero` card (subtle brand-wash gradient per the mockup)
  with the review-count as a chip, not inline text.
- Quick actions become a 2-col grid of `interactive` action cards
  (icon + label), not plain links — matches touch-target work already
  shipped, adds visual weight.
- Due-soon list items use the chip-first item-row pattern from
  `components.md`.
- Content max-width: form-dense rule (720px), centered.
