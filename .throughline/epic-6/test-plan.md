# Epic E-6 — Validation harness — test plan

No test runner exists in this repo (E-0 through E-5 precedent). Both stories are
plain CLI scripts run via `npx tsx` / `npm run`, verified against the live
linked Supabase project (the harness's whole job is producing and reading real
rows) plus throwaway unit checks on the pure `plan.ts` generator.

## S-17 — Synthetic history seeder

- **Unit (tsx script), no DB:**
  - `generateItemDefs()` called twice returns byte-identical output (deterministic PRNG) -- cohort counts sum to ~70 matching the working spec Sec12 table (25/10/8/8/10/5/4), every canonical_name is unique.
  - `generatePurchaseEvents()` for a clean_periodic weekly item: interval count and rough magnitude match the target (mean interval within a few percent of 7d across enough draws), no interval below the algorithm's own 0.5-day drop threshold.
  - Drifting item: earliest generated interval close to 7d, most recent close to 14d (linear interpolation direction correct).
  - Outlier-injected item: exactly one interval in the raw sequence is a multiple of the baseline consistent with the injected outlier, not folded into the "clean" jittered distribution.
- **Integration (live Supabase project):**
  - `ENABLE_SEED` unset/false: `npm run seed:history` refuses to run, no writes attempted (confirm via a pre/post row count on the demo household's catalog_items).
  - `ENABLE_SEED=true`: run produces the demo household (`is_demo=true`, id matches the fixed `DEMO_HOUSEHOLD_ID` constant, not `DEFAULT_HOUSEHOLD_ID`), ~70 catalog_items, and a stock_movements row count consistent with the per-cohort purchase-count plan.
  - Write guard: temporarily point the seeder's household id constant at `DEFAULT_HOUSEHOLD_ID` in a throwaway copy of the guard check (not the real script) to confirm the assertion actually throws rather than silently passing -- proves the guard is a real gate, not dead code.
  - Re-running `npm run seed:history` a second time is idempotent: same ~70 items, same row counts, no duplicate catalog_items, no orphaned stock_movements from the previous run.
  - `npm run seed:history -- --wipe`: catalog_items/stock_movements/item_stats/item_stats_history/item_aliases for the demo household all drop to zero rows; the household row itself remains (so a subsequent plain `npm run seed:history` reseeds cleanly); `DEFAULT_HOUSEHOLD_ID`'s row counts are untouched before/after (grep-comparable counts).
  - `v_current_stock` returns sane (non-negative, non-null) rows for demo items after seeding, confirming `stock_epoch` was backdated correctly relative to the earliest seeded movement.

## S-18 — Validation scorecard

- **Integration (live Supabase project, run against S-17's seeded data):**
  - `npm run validate:predictions` after a fresh `npm run seed:history`: prints the full per-cohort table + overall S3 line, process exit code matches the printed PASS/FAIL.
  - Spot-check one clean_periodic weekly item by hand: pull its real stock_movements via a throwaway query, hand-compute the held-out interval error, confirm it matches the script's own per-item number (not just trusting the aggregate).
  - `currentStockBase` sanity check (the advisor-flagged risk): for a q>=0.70 clean_periodic item, confirm predictedNextPurchaseAt lands close to `last_training_event + true_interval`, not `last_training_event + 0.5*true_interval` -- this is the one number that silently invalidates the whole scorecard if wrong, checked explicitly before trusting any aggregate output.
  - Missing seed data (run `validate:predictions` against a freshly wiped demo household): fails with a clear "run seed:history first" message, not a cryptic null-pointer/empty-array crash.
  - Cohort qualitative checks each produce a printed pass rate: high_variance confidence-band check, outlier_injected rejection check (via `_internal.rejectOutliers`), cold_start confidence check, perishable clamp check (on `predictedDepletionAt`, not the blended `predictedNextPurchaseAt`), qty_inconsistent `dailyRateBase===null` check.
  - If overall S3 lands below 70% on the first real run: follow the tuning protocol in sub-S-18.json before touching any constant; if a constant does change, re-run a throwaway tsx fixture reproducing E-5's exact A5/A6/A7 assertions (values pulled from .claude/epic-5/ledger.md) and confirm they still hold before re-running the full scorecard.

## Cross-story check (epic-level)

Once both land: `npm run seed:history` then `npm run validate:predictions` in one session produces a scorecard whose overall S3 (n>=4) clears >=70% (E-6's own acceptance clause, working spec Sec12), with every per-cohort qualitative claim from the Sec12 table (confidence bands, outlier rejection, drift tracking, cold-start behavior, perishability clamp, quantity-blend behavior) holding on real seeded-then-read-back data, not just the pure fixture layer. `npm run seed:history -- --wipe` afterward leaves the demo household empty and the real `DEFAULT_HOUSEHOLD_ID` household completely untouched throughout.
