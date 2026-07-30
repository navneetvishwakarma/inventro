# Epic E-9 — Shopping list — test plan

No test runner exists in this repo (E-0 through E-8 precedent). Pure functions get
throwaway `npx tsx` fixture scripts (deleted after); DB-touching behavior is verified
against the live linked Supabase project, exercising real rows and cleaning up
anything inserted for the purpose of the check. Page-render checks reuse E-8's proven
recipe (`next dev` + a real signed gate cookie + curl, `DEFAULT_HOUSEHOLD_ID`
overridden to the seeded demo household where populated data is needed).

## S-23 — Shopping list generation + plain-text export

- **Unit (tsx script, no DB) — `formatShoppingListAsText`:** fixture list with a mix of
  checked/unchecked items, brand-present/absent, weight/volume/piece base units ->
  output matches hand-built expected string exactly (header line, `[ ]`/`[x]` prefixes,
  `formatBaseQty` output reused verbatim, not reformatted).
- **Integration (live Supabase, demo household -- E-8 left it seeded with 67 items
  across 7 buckets, `onboarded_at` set, so this doesn't pass vacuously):**
  - Generate from `bucket: 'weekly'`: resulting `shopping_list_items` count matches
    `getPlanItems()` filtered to `cadenceBucket==='weekly' && planState==='pending'`
    (hand-counted via a direct query), every row's `qty_base` matches that item's
    `suggestedQtyBase` at generation time.
  - Generate from `due_in_days: 7`: matches `getDueSoonItems(7)`'s own count/membership.
  - An item snoozed/skipped/excluded on `/plan` before generation does NOT appear on a
    freshly generated list for its bucket -- confirmed by snoozing one real item first,
    then generating, then checking it's absent.
  - Generate twice in a row (same or different bucket): first list's `status` flips to
    `'archived'`, exactly one `status='active'` row exists for the household afterward,
    no duplicate `(shopping_list_id, catalog_item_id)` rows anywhere.
  - Generate from a bucket with zero pending items: list is created with zero
    `shopping_list_items` rows, not an error.
  - `getActiveShoppingList()` returns the just-generated list with correctly joined
    `catalog_items` display fields for every row.
  - Page-render: `next dev`, signed gate cookie, curl `/shopping-list` against both the
    real cold-start household (empty state, no active list, no broken render) and the
    demo household after generating a real list (item rows render, `Copy as text`
    control present).
  - Every row inserted for this check is deleted afterward (`shopping_lists` cascade or
    explicit `shopping_list_items` + `shopping_lists` cleanup); any plan_entries row
    touched (the snooze test) is reverted.

## S-24 — Check-off-to-purchase-log with price prompt

- **Integration (live Supabase, real household -- not the demo household, to keep this
  story's ledger writes isolated from E-6/E-8's seeded fixtures):**
  - Pick one real item with an active shopping-list row (generate one if needed) and a
    known `default_pack_size`/`base_unit`. Call `logShoppingListPurchase` with a real
    price. Confirm, by hand-derivation against live Supabase (not by re-reading the
    code): exactly one new `stock_movements` row (`type='purchase'`, `qty_base` equal to
    the row's snapshotted `qty_base`, `source_receipt_id` null); exactly one new
    `price_history` row (`unit_price` equal to the entered price, `merchant` null);
    `item_stats.purchase_count` increased by exactly 1; `predicted_next_purchase_at`
    moved forward relative to its pre-call value; `v_current_stock` for the item
    increased by exactly `qty_base`; **`item_stats.rate_correction` unchanged** from its
    pre-call value (the direct proof S-15 reconciliation was not invoked).
  - Call `logShoppingListPurchase` again on the SAME `shopping_list_items` row (simulate
    a double-click): confirm zero additional `stock_movements`/`price_history` rows and
    `purchase_count` unchanged -- the `purchase_logged_at IS NULL` guard held.
  - `setChecked(id, true)` then `setChecked(id, false)` on a different, not-yet-logged
    row: confirm zero `stock_movements`/`price_history` rows at any point, and
    `purchase_logged_at`/`logged_price` stay null throughout.
  - Snooze-reset: snooze one item on `/plan`, generate a shopping list including it
    (stale-snapshot scenario -- generation itself would normally filter snoozed items
    out, so snooze it AFTER generating), log a purchase for it via the shopping list,
    confirm its `plan_entries.state` reverts to `'pending'`. Repeat with `state='excluded'`
    and confirm it is NOT reset (still `'excluded'` after the purchase log).
  - **Cross-epic correctness check (the one way E-9 could silently damage E-5):** after
    the null-source purchase movement above exists, commit a real receipt (or simulate
    via a second manual purchase movement with a receipt-like `source_receipt_id`) for
    the SAME item at a later `occurred_at`, and confirm `reconcileRateCorrection` (S-15)
    correctly finds the null-source checkoff movement as its "previous purchase" --
    i.e. the `.or(source_receipt_id.neq.X, source_receipt_id.is.null)` filter's null
    branch works as its own code comment claims, verified live, not assumed.
  - Page-render: curl `/shopping-list` after a real logged purchase -- `Logged: ₹X`
    renders for that row, price input is gone for it, still present for others.
  - Every row inserted for this check is deleted afterward (`stock_movements`,
    `price_history`, `item_stats` reset or deleted, `plan_entries` reverted,
    `shopping_lists`/`shopping_list_items` cleaned up).

## Epic gate

Final `advisor` pass across the full changeset (migration + both stories) before
shipping, once the build is clean and both stories' live-Supabase verification above
has actually run -- not before.
