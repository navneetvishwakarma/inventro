# Epic E-1 — Onboarding — test plan

> E-1 is `vertical: true` in spirit (it's the first user-facing screen), but
> has one story. Tests verify REQ-01's acceptance directly plus the two
> edge cases the UX doc calls out explicitly.

## S-04 — Onboarding wizard

- **Unit:** none — this story is server-action + page composition over
  already-tested schema (S-02); no new business-logic function warrants an
  isolated unit test.
- **Integration (run against the live Supabase project, same pattern as S-02):**
  - Completing step 1 (name + budget) updates the placeholder household row
    in place (same `id`, not a new row).
  - Selecting a preset in step 2 flips `is_staple = true` on every
    `catalog_item` in that preset's mapped categories, and only those.
  - Selecting zero presets does not block reaching step 3.
  - Ticking N items in step 3 and completing creates exactly N
    `stock_movements` rows with `type = 'initial'`, `qty_base` matching each
    item's `default_pack_size`, `occurred_at` at/after completion time.
  - Completing with the tick-off skipped entirely still sets
    `households.stock_epoch = now()` and `onboarded_at = now()`.
  - `v_current_stock` for a ticked item returns its `default_pack_size` right
    after completion (proves the S-02 view + this story's writes agree).
- **Manual/E2E:**
  - Fresh (not-yet-onboarded) household hitting `/` redirects to `/onboarding`.
  - An already-onboarded household hitting `/onboarding` redirects to `/`.
  - `/` after onboarding renders without error and shows the household name —
    this **is** acceptance test A13, made concrete.
  - No Supabase key string in `.next/static` output (A26, re-checked now that
    real Supabase client code exists for the first time since S-01).
