# Epic E-11 — Manual entry & catalog management — test plan

No test runner exists in this repo (E-0 through E-10 precedent). Pure functions get
throwaway `npx tsx` fixture scripts (deleted after); DB-touching behavior is verified
against the live linked Supabase project, exercising real rows and cleaning up anything
inserted for the purpose of the check, with a row-count baseline diff on every touched
table after cleanup. Page-render checks reuse the proven `next dev` + signed gate cookie
+ curl recipe.

## S-29 — Manual entry typeahead + commit path

- **search_catalog_items RPC (live Supabase):** empty query against the real household
  returns items ordered by `item_stats.last_purchased_at desc nulls last`. A query
  matching an existing item's canonical_name (exact and a deliberately misspelled/
  reworded variant) returns that item ranked first with score > 0.62-equivalent
  confidence, matching S-09's own trigram behavior. A 2-3 char prefix query (below
  pg_trgm's practical similarity floor) still returns an ILIKE-contained match via the
  0.5 floor. `last_qty_base` matches the coalesce chain: an item with real purchase
  history returns its latest `qty_base`; a seeded-but-never-purchased item returns
  `default_pack_size`; an item with neither returns 1.
- **log_manual_purchase RPC, existing-item path (live Supabase):** logging a purchase
  against a real catalog item writes one `stock_movements` 'purchase' row at the given
  `occurred_at`, one `price_history` row when a price is given, and bumps
  `item_stats.purchase_count`/`last_purchased_at` (greatest semantics, matching
  commit_receipt/log_shopping_list_purchase). `recomputeOneItem` runs afterward --
  confirm `item_stats.ewma_interval_days`/`cadence_bucket` update when there are now
  >=2 purchase events.
- **log_manual_purchase RPC, new-item path (live Supabase):** creating a genuinely new
  item (a name with no real catalog match) inserts exactly one `catalog_items` row with
  `base_unit` matching the chosen category's `default_base_unit`, one `item_aliases` row
  (source='manual'), and proceeds through the same movement/price/stats writes as the
  existing-item path.
- **Duplicate safety net:** attempting to create a "new item" whose name/brand
  normalizes to >=0.62 trigram similarity against an existing item's alias is blocked
  (matchCatalogItem returns 'matched') -- confirm no catalog_items row is created and
  the existing item's id is surfaced instead.
- **Backdating passthrough (positively confirmed, not assumed):** a manual purchase
  dated before the household's `stock_epoch` does not change `v_current_stock` for that
  item (view's own `occurred_at >= stock_epoch` filter, same finding S-27 already
  established for receipts, re-confirmed here for the manual-entry write path
  specifically).
- **Page render:** `next dev` + signed gate cookie + curl `/add/manual` -> 200, no SSR
  error. Type-driven search itself is client-interactive (no headless browser available
  in this environment) -- verified by code-trace of the debounce/search-action wiring
  against the RPC behavior already proven above, documented as a gap, not silently
  claimed as end-to-end proven.
- Every row created for these checks is deleted afterward (stock_movements,
  price_history, item_stats, item_stats_history, item_aliases, catalog_items in FK
  order); row counts on every touched table confirmed back at baseline.

## S-30 — Catalog manager (merge / archive / recategorize)

- **getCatalogManagerItems (live Supabase):** confirm the list includes at least one
  archived item alongside active ones (archive a throwaway fixture item first if the
  real household has none) -- discriminates against accidentally reusing
  `getInventoryItems()`'s `is_archived=false` filter.
- **merge_catalog_items RPC, discriminating case (live Supabase):** create TWO fixture
  catalog items (`ZZTEST` prefix) under the real household, each with 3+ real
  `stock_movements` 'purchase' rows at DIFFERENT intervals (e.g. survivor: day 0/10/20;
  loser: day 5/15/25) and different `purchase_count` starting values, plus >=1
  `item_aliases` row each. Hand-derive the expected combined `purchase_count`
  (survivor + loser) and the expected direction of `ewma_interval_days` change
  (combining two different interval cadences should shift the survivor's post-merge
  EWMA measurably from its pre-merge value -- not just leave it untouched) BEFORE
  querying the DB. Run the merge, survivor as p_survivor_id. Confirm: all loser
  `item_aliases`/`stock_movements` now reference the survivor; loser `catalog_items.
  is_archived = true`; loser `item_stats`/`item_stats_history` rows are gone; survivor
  `item_stats.purchase_count` equals the hand-derived sum; survivor
  `item_stats.ewma_interval_days` matches the hand-derived direction (recomputed from
  combined history, not the pre-merge survivor-only value).
  Confirm a fresh `matchCatalogItem` call against the loser's old alias text now
  resolves to the survivor's id (the UX doc's stated success signal: "the next
  purchase of either raw-text variant resolves automatically to the merged item").
- **Merge guards:** self-merge (`p_survivor_id = p_loser_id`) raises and writes nothing;
  merging into an already-archived survivor raises; merging an already-archived loser
  raises.
- **plan_entries conflict case:** create a fixture where BOTH the survivor and loser
  have a `plan_entries` row (violates the unique index if both were reassigned
  naively) -- confirm the loser's row is deleted, the survivor's is untouched, no
  unique-constraint violation.
- **recategorize:** confirm `category_id` changes and `base_unit` does NOT, even when
  moving to a category with a different `default_base_unit` (deliberately choose a
  target category whose base_unit differs from the item's current one, to make this a
  real assertion, not a vacuous one where old and new units happen to match). Confirm
  an 'uncategorized' target slug is rejected server-side.
- **archive/unarchive:** toggling `is_archived` round-trips; confirm an archived item
  disappears from `getInventoryItems()` and `search_catalog_items()` results and
  reappears from neither until unarchived, while remaining visible in
  `getCatalogManagerItems()` throughout.
- **Page render:** `next dev` + signed gate cookie + curl `/catalog` -> 200, no SSR
  error, list renders both an active and an archived fixture item.
- Every row created for these checks is deleted afterward, in FK order; row counts on
  every touched table confirmed back at baseline.

## Epic gate

Final `advisor` pass across the full changeset after both stories land and `npm run
build` is clean -- documented in ledger.md regardless of outcome.
