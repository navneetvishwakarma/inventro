# Epic E-12 — Budget & insights — test plan

No test runner exists in this repo (E-0 through E-11 precedent). Pure functions get
throwaway `npx tsx` fixture scripts (deleted after); DB-touching behavior is verified
against the live linked Supabase project, exercising real rows and cleaning up anything
inserted for the purpose of the check, with a row-count baseline diff on every touched
table after cleanup. Page-render checks reuse the proven `next dev` + signed gate cookie
+ curl recipe.

## Pre-flight (before any code)

- Confirm live `price_history` row count is 0 across both households (already confirmed
  during spec-writing: 0 rows, 1157 stock_movements, 2 households). This means the
  backfill is expected to be a verified no-op, not a fabricated "N rows backfilled"
  claim, and real price data must come from the seeder extension below before any
  Insights feature can be verified against non-empty data.

## S-31 — price_history cross-cutting fix

- **Migration applies cleanly** (`npx supabase db push`, `npx supabase migration list`
  shows local/remote timestamps matched).
- **Backfill correctness on the live (empty) table:** confirm it runs without error and
  affects 0 rows (matches the pre-flight count) -- reported as a verified no-op, not
  skipped or assumed.
- **commit_receipt() price derivation, live Supabase, real receipt commit:** commit a
  fixture receipt with a known line_total and qty_base; confirm the inserted
  price_history row has price_basis='per_base_unit' and
  `price_per_base_unit * qty_base` equals the fixture's line_total exactly (the
  invariant). Confirm a second fixture line with unit_price present but line_total null
  and pack_size null falls through to the secondary qty_display-regex derivation
  correctly. Confirm a third fixture line with pack_size set and line_total null lands
  on price_basis='legacy_unverified' (fallback correctly skipped, not silently wrong).
  Confirm `unit_price` on the inserted row is byte-identical to what would have been
  written before this migration (unchanged insert).
- **log_shopping_list_purchase() / log_manual_purchase() reinterpretation, live
  Supabase:** log a fixture purchase with a known qty_base and a known "total paid"
  price; confirm `price_per_base_unit * qty_base` equals the entered price exactly, and
  `unit_price` still stores the raw entered number unchanged.
- **UI copy:** `manual-entry-form.tsx` (both price inputs) and
  `shopping-list-item-row.tsx` render "Total paid" wording, confirmed by reading the
  rendered HTML from the page-render check, not just the source diff.
- **Seeder extension, live Supabase:** `ENABLE_SEED=true npm run seed:history` against
  the demo household; confirm `price_history` row count for that household matches the
  count of non-null-qtyBase-eligible purchase events (rate rows written regardless of
  qtyBase nullness, so actually matches total purchase-event count), all rows
  `price_basis='per_base_unit'`, and the 4 deliberately-jumped items show their most
  recent price >=28% above the prior trailing average (hand-computed from the raw rows,
  not just trusting `getPriceAlerts()` to grade its own homework). Every row created for
  fixture checks outside the seeder (commit_receipt/manual/shopping-list fixtures above)
  is deleted afterward; row counts on every touched table confirmed back at baseline.

## S-31 — Insights screen

- **getSpendByCategory:** against the seeded demo household, confirm every top-level
  category appears (including ones with zero spend this "month" -- seeded data is
  historical, so pick a window guaranteed to include some seeded events and confirm a
  deliberately-zero window still returns the full category list at ₹0). Confirm the
  household.monthly_budget null state renders as "no budget set" (both real households
  have `monthly_budget IS NULL` today, confirmed live), not a fabricated number or a
  crash.
- **getForwardProjection:** hand-compute the expected monthly figure for 2-3
  spot-checked seeded items (one dailyRateBase-driven, one interval/suggestedQtyBase-
  driven) directly from their live `item_stats` + latest `price_history` row, compare
  against the function's output for those items -- not just checking the total is
  nonzero. Confirm an item with a cadence but zero 'per_base_unit' price history is
  excluded and counted in the "N excluded" figure, not silently priced at 0 or from a
  legacy row.
- **getTopSpendItems:** confirm the returned top-10 matches a hand-run
  `group by / order by / limit 10` query against the live table directly (not the
  function re-deriving its own answer).
- **getPriceAlerts:** confirm exactly the 4 deliberately-jumped seeded items are flagged
  (no false positives among the other ~66 items, no false negative among the 4), each
  alert carrying item name, merchant (or explicit null), trailing average, latest price,
  %change. Confirm an item with only 1-2 qualifying prior observations is NOT flagged
  even if its single delta looks large (the n>=3 gate).
- **getWasteReport:** if the seeded/demo data has no waste movements (S-17's seeder is
  purchase-only), write a small throwaway `stock_movements` waste fixture (negative
  qty_base, per the core invariant) against the real household, confirm the report
  values it correctly using `abs(qty_base)` (a naive unsigned sum would double the
  visible waste or go negative -- discriminating check) and prices it using the item's
  latest known price when one exists, or flags it "value unknown" when it doesn't.
  Fixture rows deleted afterward.
- **No unbounded fetch-then-reduce:** grep the new `lib/insights/data.ts` for any
  `.select()` without a `count`/aggregate/RPC pattern over `price_history` or
  `stock_movements` -- confirm every spend/count/sum path is server-side aggregated.
- **Page render:** `next dev` + signed gate cookie + curl `/insights` -> 200 against
  BOTH households: the demo household (populated, all four sections show real numbers)
  and the real cold-start-ish household (near-empty, confirm a non-broken "not enough
  data" / zero state throughout, not a crash or blank render -- A13-style cold-start
  correctness, same bar every prior epic has held itself to).
- Every row created for these checks (outside the seeder, which is itself the intended
  persistent demo dataset) is deleted afterward, in FK order; row counts on every
  touched table confirmed back at baseline.

## Epic gate

Final `advisor` pass across the full changeset after the story lands and `npm run
build` is clean -- documented in ledger.md regardless of outcome.
