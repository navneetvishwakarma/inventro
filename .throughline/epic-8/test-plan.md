# Epic E-8 — Cadence planning — test plan

No test runner exists in this repo (E-0 through E-7 precedent). Pure functions get
throwaway `npx tsx` fixture scripts (deleted after); DB-touching behavior is verified
against the live linked Supabase project, exercising real rows and cleaning up
anything inserted for the purpose of the check.

## S-21 — Plan screen: cadence bucket tabs, suggested qty, snooze/skip/exclude/override

- **Unit (tsx script, no DB) — suggested-qty formula:**
  - `dailyRateBase=100, intervalEstDays=10, defaultPackSize=250`: cycleConsumption=1000, 1000/250=4 exactly -> suggestedQtyBase=1000 (4 packs).
  - `dailyRateBase=100, intervalEstDays=10, defaultPackSize=300`: cycleConsumption=1000, ceil(1000/300)=4 -> suggestedQtyBase=1200 (not 1000 -- rounds UP to a full pack).
  - `dailyRateBase=null` (no rate signal): falls back to `defaultPackSize` unchanged, not a crash or 0.
  - `defaultPackSize=null`, `dailyRateBase=10, intervalEstDays=3`: cycleConsumption=30, no pack rounding, suggestedQtyBase=30.
  - `dailyRateBase=0`: suggestedQtyBase floors at 1, never 0.
- **Integration (live Supabase project, real household):**
  - `getPlanItems()`: item count matches a hand count of `item_stats` rows with non-null `cadence_bucket` for the household; every returned item has `effectiveCadenceBucket` matching `cadence_override ?? cadence_bucket` read directly from the table.
  - Set `cadence_override` on one real item via `setCadenceOverrideAction`: confirm `item_stats.cadence_override` updated, `getPlanItems()` now reports that item's `effectiveCadenceBucket` as the override, and the item appears under the overridden bucket's tab on `/plan`, not its computed one.
  - Call `recomputeOneItem` directly against that same item afterward (simulating a nightly recompute): confirm `cadence_override` is unchanged in the row (A9's actual mechanism) and `cadence_bucket` (the computed column) may change independently.
  - `revertToAuto` (`setCadenceOverrideAction(id, null)`): confirm `cadence_override` becomes null and `effectiveCadenceBucket` falls back to the computed `cadence_bucket`.
  - `snoozeItemAction` / `skipOnceAction` / `excludeItemAction` each write exactly one `plan_entries` row (or update the existing one) with the expected `state`/`snoozed_until`; confirm the item is excluded from `getPlanItems()`'s "active" set (or however S-22's due-soon filter reads it) while snoozed/skipped/excluded, and reappears once `unsnoozeItemAction`/`undoSkipAction`/`includeItemAction` runs.
  - Skip auto-expiry: after `skipOnceAction`, manually advance the scenario by changing the stamped `due_date` on the `plan_entries` row to an earlier date than the item's current computed `dueDate` (simulating a new cycle having started) -- confirm `getPlanItems()` now treats the item as `pending` again without any explicit undo call.
  - Snooze auto-expiry: set `snoozed_until` to a past timestamp directly -- confirm `getPlanItems()` treats the item as `pending`.
  - Clean-up: every `plan_entries` row and `item_stats.cadence_override` value touched by this story's own verification is restored/deleted afterward.
- **Rendering:** `/plan` renders with tabs for every bucket that has active items; switching `?bucket=` shows the right subset; snoozed/skipped/excluded items show with their undo control, not silently hidden.

## S-22 — Today view (due within 3 days)

- **Integration (live Supabase project):**
  - `getDueSoonItems(3)` against the real household: every returned item's `dueDate <= now + 3 days`; an item manually excluded or currently snoozed does not appear even if its `dueDate` is within the window.
  - Cold-start check: for a household (or a filtered view simulating zero `item_stats` rows) with nothing purchased, `getDueSoonItems()` returns `[]` and `/` renders its existing onboarding-nudge copy without throwing.
  - `/` renders a "Due soon" section above/alongside "Needs attention" (S-20); each row links to `/plan?bucket=<bucket>` and that link lands on the correct tab.

## Cross-story check (epic-level)

Setting a cadence override on `/plan` is immediately reflected on `/` (Today) and vice
versa within the same session (both read the same `lib/plan/data.ts` helpers); `npm run
build` stays clean throughout; no change in this epic touches `lib/predictions/*` or
`lib/inventory/consume.ts`'s own write paths (S-15/S-20's invariants stay intact).
