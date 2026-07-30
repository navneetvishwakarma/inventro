# Manual test log

> Per-epic manual/E2E checks that aren't automated, appended by `define-epic`
> as each epic's issues are created. See `.claude/epic-<N>/test-plan.md` for
> the full unit/integration/manual breakdown behind each entry here.

## E-0: Foundation & platform scaffolding — [#5](https://github.com/navneetvishwakarma/inventro/issues/5)

- **S-01** [#6](https://github.com/navneetvishwakarma/inventro/issues/6) — deployed Vercel URL loads without error (smoke test).
- **S-02** [#7](https://github.com/navneetvishwakarma/inventro/issues/7) — spot-check ~15 seeded catalog items across categories against working spec §6's stated priors (milk ~2d, rice ~45d, detergent ~60d) to catch a systematically wrong seed before it biases every cold-start prediction.
- **S-03** [#8](https://github.com/navneetvishwakarma/inventro/issues/8) — grep the production build output for the Supabase anon key string (A26, shared with PRD REQ-26's acceptance).
- **Cross-story** — once all three land, confirm E-0's composite acceptance (schema + RLS-disabled + seed data + passcode gate) holds simultaneously on the same live deployment.

## E-3: Canonicalization & matching — [#20](https://github.com/navneetvishwakarma/inventro/issues/20)

- **S-11** [#21](https://github.com/navneetvishwakarma/inventro/issues/21) — feed a 20-line PDF order confirmation fixture (with a delivery fee and GST row) through extraction + the E-3 pipeline; confirm both non-inventory rows land `review_state='excluded'` and every other row is processed normally (A3).
- **S-09** [#22](https://github.com/navneetvishwakarma/inventro/issues/22) — after the seed-alias backfill migration, confirm every one of the ~300 S-02 catalog items now has an alias (no orphans). Then: a brand-new product lands `review_state='new_item'` with no catalog_items/item_aliases row created; a line matching a test-seeded existing item's alias (standing in for a prior commit, since E-4 doesn't exist yet) resolves `matched_item_id` to that same item without creating a duplicate.
- **S-10** [#23](https://github.com/navneetvishwakarma/inventro/issues/23) — a fixture receipt with mixed units (kg, l, dozen, pack-of-N, `2 x 500ml`), each line pre-matched to an existing item, commits to the correct base-unit quantities; a matched line with a nonsense unit string lands `qty_base=1` and `review_state` demoted to `'needs_review'`; a `'new_item'` line stays `qty_base=null`.
- **Cross-story** — once all three land, run one real multi-line receipt (mixed units, one new product, one repeat of a test-seeded item, one fee row) through capture -> extraction -> E-3 end to end on the live deployment; confirm the new product is flagged `new_item` (not auto-created), the repeat resolves without a duplicate, and the fee row stayed excluded.

## E-4: Review & commit — [#25](https://github.com/navneetvishwakarma/inventro/issues/25)

- **S-12** [#26](https://github.com/navneetvishwakarma/inventro/issues/26) — open `/review/[id]` for a receipt with no extractable date: confirm the date field renders unconfirmed and Commit stays disabled; confirm a date manually and confirm Commit becomes available (A21). Resolve one `needs_review` line via "Save & match" and one `new_item` line via "Confirm as new item"; confirm a `category_slug='uncategorized'` new-item confirmation is rejected. Confirm the past-order banner appears/disappears correctly as the confirmed date crosses `household.stock_epoch`.
- **S-13** [#27](https://github.com/navneetvishwakarma/inventro/issues/27) — commit the reviewed receipt from S-12's manual check; confirm `receipts.status='committed'`, the new item now has a real `catalog_items`/`item_aliases` row, and every committed line's item shows correct `qty_base` via `v_current_stock` (A1, Day 1 gate). Repeat with a backdated receipt (before `stock_epoch`): confirm current stock does NOT change without the override checkbox, and DOES change with it (A18) — and that the original purchase movement stays at the historical date either way.
- **Cross-story** — once both land, run one real receipt end to end: capture -> extraction -> E-3 -> S-12 review (resolving every line, confirming the date) -> S-13 commit, entirely on the live deployment. This is the epic's acceptance clause verbatim ("Upload a real receipt, review it, see items in inventory").
