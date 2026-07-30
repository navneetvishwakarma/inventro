# Epic E-4 — Review & commit — test plan

No test runner exists in this repo (E-0 through E-3 precedent). Pure-function checks ("Unit:" below) are one-off `tsx` scripts run against fixture tables, results recorded in `ledger.md`, script discarded. Everything else is integration, against the live Supabase project, same pattern as prior epics.

## S-12 — Review queue split view

- **Unit (tsx script):** `confirmPurchaseDateAction`'s date validation (reject empty string, reject an unparsable string, accept an ISO date) — the pure validation piece, no DB call.
- **Integration (live Supabase project):**
  - A receipt with `purchased_at=null` (no date extracted): `/review/[id]` shows the date field unconfirmed; attempting commit is rejected (both client-disabled and, redundantly, by S-13's server guard if called directly).
  - Confirming a date via `confirmPurchaseDateAction` sets `purchased_at` + `purchased_at_confirmed=true` in one write; re-reading the receipt shows both fields consistent (A21, first half).
  - A receipt whose `purchased_at` is confirmed to a date before the household's `stock_epoch`: past-order banner renders; after editing to a date >= `stock_epoch`, the banner disappears on the next render (confirms it's derived from current state, not cached).
  - A `needs_review` line: 'Save & match' against corrected text resolves it to `matched` or leaves it `needs_review` with an updated `match_confidence`, matching S-09's ladder behavior exactly (reused, not reimplemented).
  - A `new_item` line: 'Confirm as new item' with `category_slug='uncategorized'` is rejected server-side; with a real category it's accepted and the line stays `review_state='new_item'`.
  - A line: 'Mark non-inventory' flips it to `review_state='excluded'`, `is_non_inventory=true`, and it drops out of the actionable table into the collapsed "excluded" note.
  - `lib/llm/extract.ts` patch: running extraction on a document with an extractable date sets `date_source='document'`; one with no extractable date leaves `purchased_at` and `date_source` both null.

## S-13 — Commit

- **Unit (tsx script):** the TS-side `qty_base` computation for `new_item` lines (category's `default_base_unit` as target, reusing `normalizeUnitToBase`) — table-driven, same rule set as S-10's existing cases, confirming no drift now that it's called from a second call site.
- **Integration (live Supabase project, real household), using a receipt run through capture -> extraction -> E-3 -> S-12 review to reach a committable state:**
  - **Happy path (A1):** a receipt with one `matched` line and one `new_item` line, both resolvable, purchase date confirmed to today (>= stock_epoch): after `commitReceiptAction`, `receipts.status='committed'`; the `new_item` line now has a real `catalog_items` row + one `item_aliases` row (source='commit'); both lines have `stock_movements` type='purchase' rows; `v_current_stock` reflects both items' `qty_base` correctly (Day 1 gate).
  - **Guard — unconfirmed date:** calling `commitReceiptAction` (bypassing the disabled UI button, i.e. calling the Server Action directly) on a receipt with `purchased_at_confirmed=false` raises and writes nothing — confirm via `stock_movements` count unchanged.
  - **Guard — unresolved needs_review line:** same, for a receipt with one line still `review_state='needs_review'`.
  - **A18, backdated, no override:** commit a receipt dated before `stock_epoch`, override unchecked. Confirm `stock_movements` has the historical `purchase` row, and `v_current_stock` for that item shows **no increase** — this is the case that actually proves the `stock_epoch` filter is doing its job, not just that the code ran.
  - **A18, backdated, override checked:** same receipt/item, override checked. Confirm `v_current_stock` **does** increase, the extra `initial` movement is dated `>= stock_epoch` (today), and the original `purchase` movement is still at the historical date (not moved) — the frequency engine (E-5) needs that historical date intact.
  - **Two similar new_item lines, one receipt:** two lines with deliberately similar item text, both `review_state='new_item'` going into commit. Confirm two distinct `catalog_items` rows are created (no accidental merge via a mid-commit trigram hit against the first line's freshly-inserted alias) — directly verifies the advisor-caught ordering bug is fixed.
  - **Negative — excluded line:** a receipt including one `review_state='excluded'` line: after commit, confirm no `stock_movements`, `price_history`, or `item_stats` row exists for that line's would-be item, and `item_stats.purchase_count` for the OTHER committed lines' items is not inflated by it.
  - **item_stats bookkeeping:** an item purchased for the second time (second receipt, second commit): `item_stats.purchase_count` increments to 2, `last_purchased_at` advances to the later date.
  - **Atomicity:** force a mid-loop failure (e.g. a line with an unresolved category_slug mixed into an otherwise-valid receipt) — confirm zero `stock_movements`/`price_history`/`catalog_items` rows were created for ANY line on that receipt (not just the failing one), and `receipts.status` is unchanged from its pre-commit value.

## Cross-story check (epic-level)

Once both land: run one real multi-line receipt (mixed matched/new_item/needs_review lines, one non-inventory fee row, one unit ambiguity) through capture -> extraction -> E-3 -> S-12 review (resolving the needs_review line, confirming the new item, confirming the date) -> S-13 commit, entirely on the live deployment. Confirm the receipt ends `status='committed'` and every non-excluded line's item is visible with correct `qty_base` via `v_current_stock` — this is the epic's acceptance clause verbatim ("Upload a real receipt, review it, see items in inventory").
