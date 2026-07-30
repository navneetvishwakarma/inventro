# Epic E-3 — Canonicalization & matching — test plan

Implementation order follows the pipeline dependency chain (S-11 -> S-09 -> S-10), not the backlog's display order — matching needs a resolved category before it can propose a new item, and unit normalization needs a resolved existing catalog item before it knows the target base unit.

No test runner exists in this repo (epic-2 precedent). Pure-function checks ("Unit:" below) are one-off `tsx` scripts run against fixture tables, not a committed test suite — results recorded in `ledger.md`, script discarded. Everything else is integration, against the live Supabase project, same pattern as prior epics.

## S-11 — Categorization & non-inventory gate

- **Unit (tsx script):** `resolveCategoryId(categorySlug)` — maps a valid seeded slug to its `categories.id`; a fixture list of all seeded leaf slugs each resolve to a distinct id.
- **Integration (live Supabase project):**
  - A receipt line with `is_non_inventory=true` (delivery fee) ends up `matched_item_id=null`, `qty_base=null`, `review_state='excluded'` after the E-3 pipeline runs — S-09/S-10 never touch it.
  - A line with `category_slug='uncategorized'` ends up `review_state='needs_review'`.
  - A 20-line fixture with a delivery fee and GST row: both excluded, all 18 inventory rows processed (A3).

## S-09 — Canonicalization / matching

- **Unit (tsx script):** normalized-text function — case/whitespace/punctuation-insensitive; two raw strings that should be "the same product" (e.g. "Amul Milk 500ml" vs "amul milk  500 ml") normalize identically or score >=0.62 trigram similarity against each other.
- **Seed migration check:** after the new alias-backfill migration runs, every one of the ~300 `catalog_items` from S-02 has at least one `item_aliases` row (`select count(*) from catalog_items ci where not exists (select 1 from item_aliases a where a.catalog_item_id = ci.id)` returns 0).
- **Integration (live Supabase project, real household):**
  - A brand-new product (no existing alias, no similar item, score < 0.40): `matched_item_id=null`, `match_confidence` reflects the miss, `review_state='new_item'`. No `catalog_items` or `item_aliases` row is created by this call.
  - A line whose `normalized_text` exactly matches an existing alias (including a seeded item, post-backfill): `matched_item_id` = that item, `match_confidence=1.0`.
  - Test-seeds one `catalog_items` row + one `item_aliases` row directly (standing in for a prior E-4 commit, since E-4 doesn't exist yet), then runs the matcher on a second, differently-worded line with high textual similarity (>=0.62) to that alias: `matched_item_id` resolves to the same existing item, no new `catalog_items` row is created (count unchanged) — this is the buildable half of A4 ("one catalog item"); the "two aliases" and `purchase_count=2` clauses depend on E-4/E-5 and are explicitly not asserted here.
  - A line with only a weak textual match (0.40-0.62 band) to one existing item: `matched_item_id=null`, `match_confidence` in that band, `review_state='needs_review'`.
  - Matching never crosses households: two households each with an alias for visually-identical text each resolve independently, no cross-household match.

## S-10 — Unit normalization

- **Unit (tsx script):** `normalizeUnitToBase(qtyDisplay, unitDisplay, packSize, targetBaseUnit)` — table-driven, one case per F5 rule: `kg`->g x1000, `l`->ml x1000, `dozen`->piece x12, `pack of 6`->piece x6, `2 x 500ml`->ml 1000, unit already equal to target base (or a piece synonym: pc/pcs/unit/nos)->passthrough, and an unrecognized unit (e.g. "bunch") -> `qty_base=1`, flagged.
- **Integration:**
  - A fixture line matched (S-09) to an existing `g`-base item, `unit_display='kg'`, `qty_display='1.5'`: `qty_base=1500`.
  - A fixture matched to an existing item with an unrecognized unit: `qty_base=1`, `review_state` demoted from `'matched'` to `'needs_review'`.
  - A fixture with `review_state='new_item'` (no matched_item_id) from S-09: `qty_base` stays `null` — this story does not guess a base unit with no target item.

## Cross-story check (epic-level)

Once all three stories land: feed a real multi-line receipt fixture (mixed units, one genuinely new product, one repeat of an item test-seeded to simulate a prior E-4 commit, one delivery-fee row) through extraction (S-06/S-07) then the E-3 pipeline in one pass — confirm the fee row is `excluded`, the new product lands `review_state='new_item'` with `qty_base=null`, the repeat resolves to the existing item with `qty_base` correctly converted, and no duplicate `catalog_items` row was created. This exercises the epic's buildable slice of A4 end to end on one live run.
