# Epic E-5 — Prediction engine — test plan

No test runner exists in this repo (E-0 through E-4 precedent). `computeItemStats` is the one piece explicitly designed to be pure and DB-free (working spec Sec5 closing note), so it gets real fixture-based unit verification via a throwaway `tsx` script, deleted after passing. Everything that touches the DB (recompute.ts, reconcile.ts, the on-commit hook, the cron route) is integration-tested against the live Supabase project, same pattern as prior epics.

## S-14a — Interval estimation core

- **Unit (tsx script), no DB:**
  - Clean periodic sequence (day 0/7/14/21/28): 4 intervals of 7d each, MAD=0, ewma=7, interval_est shrinks toward the fixture's chosen prior but stays close to 7 for a reasonable prior.
  - Same-day merge: two purchase events on the same Kolkata calendar day (different instants) collapse into one merged event before interval math runs — feed two `2026-08-01T09:00+05:30` / `2026-08-01T21:00+05:30`-style events plus a later event, confirm only one interval is produced across the merge boundary, not two (one of which would be ~0 days).
  - Sub-0.5-day interval dropped: two events 6 hours apart, confirm that interval never enters the median/MAD/EWMA computation.
  - Outlier rejection with n=3 usable intervals: [7,7,60] -> median=7, MAD=0, the 60 is rejected (n>=3 gate satisfied), leaving [7,7] for EWMA — this is the exact shape A6 depends on, verified in isolation here before S-14c's full-pipeline A6 check.
  - Outlier rejection with n=2 (gate not met): [7,60] -> both intervals retained (n>=3 gate not satisfied), confirming the floor actually gates the rule rather than always allow-listing based on MAD=0.
  - Shrinkage weight: n=1 usable interval -> w=1/3, confirmed against a hand-computed interval_est for a known ewma/prior pair.

## S-14b — Rate cross-check + perishability clamp

- **Unit (tsx script), no DB:**
  - q >= 0.70 (reliable qty on most events): dailyRateBase computed from trailing-120d qty/day; depletionDate derived; predictedNextPurchaseAt is the q-weighted blend of depletionDate and interval-based next-purchase — hand-verify the blend arithmetic for a fixture with q=0.75.
  - q < 0.70: dailyRateBase stays null, predictedNextPurchaseAt falls through to the pure interval-based value (equivalent to the q=0 limit) — confirm no depletionDate leaks through.
  - Fewer than 2 events inside the trailing-120d window even with q>=0.70 overall: dailyRateBase stays null for lack of window data.
  - Perishability clamp binds: a fixture with a long computed depletionDate (low consumption rate) but a short perishabilityDays — confirm predictedDepletionAt is capped at lastPurchasedAt+perishabilityDays, not the rate-based date.
  - Perishability with no rate-based depletion date (q<0.70 fixture): predictedDepletionAt still gets set directly from lastPurchasedAt+perishabilityDays, confirming the clamp doesn't silently no-op when there's nothing to "cap."

## S-14c — Confidence, bucketing, hysteresis, persistence

- **Unit (tsx script), no DB — the epic's three headline fixtures:**
  - **A5:** day 0/7/14/21, qtyBase omitted on every event (q=0). Assert: cadenceBucket='weekly', confidence within a small tolerance of 0.50 (n=3, cv=0 -> exactly 3/6=0.5), predictedNextPurchaseAt within ~1 day of day 28.
  - **A6:** day 0/7/60/67. Assert: the 60d gap interval is rejected (n=3 usable intervals after rejection = [7,7]), cadenceBucket stays 'weekly' (matches A5's bucket, proving the outlier didn't drag it to fortnightly/monthly).
  - **A7:** 2 purchases only (1 usable interval). Assert: w=1/3 so interval_est is prior-dominated (mostly the category prior, not the single observed interval), confidence ~0.25 (<0.35, "Learning"), and cadenceBucket='unpredictable' per step 9's compound condition (not a numeric cadence bucket — this is the corrected reading vs. the acceptance text's looser "prior-dominated" phrasing).
  - **Hysteresis — no flap:** previous state {cadenceBucket:'weekly', intervalEstDays:9.5}, new intervalEstDays=10.5 (crosses the 10-day weekly/fortnightly boundary but only by ~5%, under the 15% margin). Assert: final bucket stays 'weekly' despite the raw candidate being 'fortnightly'.
  - **Hysteresis — real crossing:** same previous state, new intervalEstDays=12 (>10*1.15=11.5). Assert: final bucket flips to 'fortnightly'.
  - **Hysteresis — no previous state:** first-ever compute for an item (previous.cadenceBucket=null) always takes the raw candidate bucket, regardless of how large intervalEstDays is.
- **Integration (live Supabase project):**
  - recomputeOneItem for a real catalog item with several purchase stock_movements: confirm item_stats row is upserted with all fields populated, and exactly one item_stats_history row is inserted with a jsonb snapshot matching the upserted item_stats.
  - Six consecutive recomputes of the same item: confirm item_stats_history never holds more than 5 rows for that item (trim_item_stats_history works), and the retained rows are the 5 most recent by recorded_at.
  - An item with zero purchase events: recomputeOneItem is a no-op (no item_stats row written, no error thrown).
  - cadence_override set on an item before a recompute: confirm the recompute does not touch or clear cadence_override, only cadence_bucket.

## S-15 — Repurchase reconciliation

- **Integration (live Supabase project, real household):**
  - **Test A fires:** an item whose previous item_stats.predicted_depletion_at is well in the future relative to a new purchase (i.e. remaining projected stock > 40% of default_pack_size at the moment of the new purchase) — confirm the new rate_correction = old * 0.85, clamped.
  - **Test B fires:** an item whose previous predicted_depletion_at is well in the past relative to the new purchase, exceeding 20% of the interval since the previous real purchase — confirm rate_correction = old * 1.15, clamped.
  - **Neither fires:** predicted_depletion_at close enough to the actual purchase date that neither threshold trips — rate_correction unchanged.
  - **Clamp holds:** force several repeated 0.85-multiplier fires on one item across manufactured recomputes — confirm rate_correction never drops below 0.5 (and symmetric check never exceeds 2.0 with repeated 1.15 fires).
  - **Skipped — backdated commit:** commit a receipt for an item whose purchased_at is *before* an existing later purchase already on record for that item (a backdated/historical commit per S-27's future scope) — confirm rate_correction is unchanged after the commit's recompute (eligibility check correctly excludes it via the stock_movements max() query, not the already-bumped item_stats.last_purchased_at).
  - **Skipped — first purchase:** an item with no prior item_stats.predicted_depletion_at (its first-ever purchase) — confirm reconciliation is a no-op and the fresh item_stats row's rate_correction defaults to 1.
  - **Skipped — missing pack size:** an item with default_pack_size=null — confirm reconciliation is a no-op regardless of how the projection compares.

## S-16 — Recompute triggers

- **Integration (live Supabase project), on-commit path:**
  - Commit a receipt with 2 matched lines + 1 new_item line, all resolving to distinct catalog items: confirm item_stats + item_stats_history rows exist for all 3 items immediately after commitReceipt() returns (synchronous, not queued).
  - Commit a receipt with one 'excluded' (non-inventory) line mixed in: confirm no recompute attempt happens for that line (it was never assigned a catalog_item_id).
  - A commit that fails the RPC's guards (unconfirmed date / needs_review line remaining, per S-13's existing behavior): confirm zero recompute calls happen (the trigger sits strictly after RPC success).
- **Integration (live Supabase project), nightly path:**
  - Seed a small household with a handful of catalog items with varying purchase histories (including one with zero purchases): call the route handler directly (bypassing Vercel Cron) with a valid CRON_SECRET header — confirm item_stats rows exist for every item WITH purchase history, no row/error for the zero-purchase item, and total DB round trips stay in the single digits regardless of item count (spot-check via count, not exact query-count instrumentation).
  - Missing/wrong CRON_SECRET header: route returns 401, no recompute happens.
  - Unset CRON_SECRET env var: route returns 401 (fails closed), confirmed by temporarily unsetting it for this one test case only.
  - `curl -X POST` against `/api/cron/recompute-stats` without the gate cookie but with a valid CRON_SECRET, against a local dev server: confirm it reaches the route handler (proxy.ts's matcher exclusion works) rather than getting the passcode gate's 401 first.

## Cross-story check (epic-level)

Once all five land: commit one real receipt end-to-end (capture -> extraction -> E-3 -> S-12 review -> S-13 commit) for an item with existing purchase history, and confirm in one pass: item_stats reflects the new interval/EWMA/confidence/bucket, rate_correction reflects any reconciliation that fired, item_stats_history has a fresh row (capped at 5), and manually invoking the nightly route afterward doesn't change that item's rate_correction (nightly never reconciles) but does refresh its other stats fields.
