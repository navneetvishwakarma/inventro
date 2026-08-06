# Epic E-7 — Inventory & consumption — test plan

No test runner exists in this repo (E-0 through E-6 precedent). Pure functions get
throwaway `npx tsx` fixture scripts (deleted after); DB-touching behavior is verified
against the live linked Supabase project, exercising real rows and cleaning up
anything inserted for the purpose of the check.

## S-19 — Inventory screen + item detail

- **Unit (tsx script, no DB) — `computeVirtualStockBase`:**
  - `dailyRateBase`/`predictedDepletionAt` both set, `now` == the recompute instant that produced `predictedDepletionAt`: returns exactly `rawStockBase` (the equality invariant from sub-S-19.json).
  - `now` several days after that instant: returns a value strictly less than `rawStockBase`, matching `dailyRate * daysRemaining` by hand computation.
  - `now` past `predictedDepletionAt`: clamps to 0, not negative.
  - `dailyRateBase === null` or `predictedDepletionAt === null`: returns `rawStockBase` unchanged (the no-rate-signal fallback).
- **Integration (live Supabase project):**
  - `getInventoryItems()` against the real household: item count matches a hand count of non-archived `catalog_items`; every item with a purchase has a non-null `predicted_next_purchase_at`-derived days-remaining figure; avg-90d-price matches a hand-aggregated `price_history` query for one spot-checked item.
  - `/inventory` renders, filters (category / cadence / stock-state / staples-only) narrow the list correctly against known seeded/demo data, search matches on both canonical name and an alias.
  - `/inventory/[id]` renders for one item with purchase history and at least 2 price points; plain-language explanation string contains the item's actual cadence-derived interval and days-remaining numbers, not placeholder text.
  - No write occurs anywhere in this story — confirmed via a before/after row-count check on `stock_movements` and `item_stats` across a full page load of both routes.

## S-20 — Consumption actions

- **Integration (live Supabase project, real household, not the demo household):**
  - Pick one real item with existing purchase history and a positive `v_current_stock`. "Used it up": confirm exactly one new `stock_movements` row (`type='consumption'`, `qty_base` = negative of the pre-action raw stock), `v_current_stock` for that item reads 0 immediately after, `item_stats` reflects a fresh recompute (`updated_at` advances).
  - "Used it up" again immediately (stock already 0): confirm no new `stock_movements` row is written (no-op path) and no recompute is triggered.
  - "Used some" at 50%: confirm the written movement's magnitude equals 50% of the pre-action *virtual* stock (not raw), and that the resulting raw stock via `v_current_stock` decreases by exactly that amount.
  - "Used some" numeric entry exceeding raw stock: confirm the write is clamped to raw stock, not the raw entered value (never drives stock negative).
  - "Wasted": confirm the movement's `type='waste'`, same zeroing semantics as used-it-up.
  - After "used it up" on an item, confirm `getItemsNeedingAttention()` includes it and `/` (Today stub) renders it in the new "Needs attention" section.
  - Confirm `reconcileRateCorrection`'s consumption-signal gate (`.claude/epic-5/sub-S-15.json`, `lib/predictions/reconcile.ts`) now finds a matching `stock_movements` row for an item that has had a consumption action recorded — spot-check via the same query the gate itself runs (`type not in ('purchase','initial')`), not by re-deriving the query independently.
  - Clean-up: every movement inserted by this story's own verification is deleted afterward (real household, not demo) so no synthetic history pollutes production data; `item_stats` is left as whatever the real recompute produced (not manually reverted, since that reflects genuine reality after the test write existed).

## Cross-story check (epic-level)

`/inventory` and `/inventory/[id]` render correctly for a household with a realistic
mix of items (some with rate data, some without, some cold-start); "Used it up" on
one item is visible on both `/inventory/[id]` (stock 0) and `/` (needs attention) in
the same session without a manual refresh triggering anything unexpected; `npm run
build` stays clean throughout.
