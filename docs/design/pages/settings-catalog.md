---
doc: design-page
page: settings-catalog
req: REQ-21
status: approved
---

# Settings + Catalog manager (`app/(app)/settings/*`, `app/(app)/catalog/*`)

**Current:** functional forms, already a11y-fixed (labels, touch targets).
Catalog manager hand-rolls its own `max-w-[620px]` container instead of
using a shared page-shell containment rule.

**v2 target:**
- Adopt the page-shell containment rule from `components.md` (form-dense
  720px for Settings, data-dense 1024px for Catalog's list) instead of the
  ad hoc `max-w-[620px]`.
- Catalog rows: chip-first (category, alias count, staple) already close
  to this pattern per the current screenshot — mainly needs the
  `interactive` hover-lift and data-dense row padding.
- Cost meter stat (`$0.0000`): already `font-mono`, keep as the reference
  example for the tabular-numerics rule elsewhere.
