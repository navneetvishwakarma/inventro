---
doc: design-page
page: onboarding-gate
req: REQ-01, REQ-26
status: approved
---

# Onboarding + Gate (`app/onboarding/*`, `app/gate/*`)

**Current:** Gate is a simple centered card (already close to target).
Onboarding wizard uses checkbox lists for presets/tick-off, functionally
solid, visually flat like the rest of the app.

**v2 target:**
- Gate: minor polish only — canvas/surface separation makes the centered
  card read with more presence automatically, no structural change needed.
- Onboarding: step-dots (`step-dots.tsx`, already exists) get the brand
  active-state treatment consistent with tab-bar's active indicator.
  Preset checkboxes: card-style multi-select (each preset as a small
  `interactive` card with checkbox + label) rather than a plain checkbox
  list, since this is the "how you shop" personality-setting moment and
  deserves slightly more visual presence than a settings form.
- Form-dense containment (720px).
