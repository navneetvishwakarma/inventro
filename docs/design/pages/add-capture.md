---
doc: design-page
page: add-capture
req: REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07
status: approved
---

# Add / Capture (`app/(app)/add/*`)

**Current:** functional dropzone + queue, plain bordered box, queue rows
are minimal (no thumbnail, status is a text word).

**v2 target:**
- Dropzone gets a brand-tinted icon (upload glyph in `--brand`) and stays
  `surface-sunken` background so it visually separates from surrounding
  cards without adding a new color.
- Queue rows: thumbnail placeholder (or actual preview once available),
  filename + status as a chip (`Parsing…` = info/blue, `Ready for review`
  = success, `Failed` = error) instead of plain muted text.
- Manual-entry typeahead (REQ-07): result rows use the same chip-first
  item-row pattern as Inventory/Catalog for consistency.
- Form-dense containment (720px), generous `--space-4`/`--space-5` padding.
