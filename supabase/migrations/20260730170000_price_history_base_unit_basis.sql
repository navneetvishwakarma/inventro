-- S-31: price_history has never stored a consistent, comparable per-item
-- price -- unit_price means "per the receipt's printed display unit" for
-- commit_receipt() lines, and an ambiguous single number for the two
-- manual-write paths. Additive fix: two new nullable columns
-- (price_per_base_unit, qty_base) plus a basis flag, rather than
-- redefining unit_price itself -- lib/inventory/data.ts already reads
-- price_history.unit_price for E-7's shipped Inventory sparkline/avg-price
-- display, and silently changing that column's meaning would break it.
--
-- Confirmed live before writing this migration: price_history has ZERO
-- rows in both households despite 1157 stock_movements -- no write path
-- has ever actually inserted a price row with a real price in practice.
-- The backfill below is therefore expected (and verified) to be a no-op
-- against today's data; it exists for correctness/completeness and any
-- future re-run against a database that does carry historical rows.

alter table price_history
  add column qty_base numeric,
  add column price_per_base_unit numeric,
  add column price_basis text not null default 'legacy_unverified'
    check (price_basis in ('per_base_unit', 'legacy_unverified'));

create index price_history_household_basis_idx on price_history (household_id, price_basis);

comment on column price_history.price_per_base_unit is
  'Price per ONE base unit (gram/ml/piece, matching catalog_items.base_unit) -- the only basis directly comparable across items/receipts/time. Null unless price_basis=''per_base_unit''.';
comment on column price_history.qty_base is
  'Base-unit quantity this specific price observation covers, so price_per_base_unit * qty_base = money spent on this observation with no join required.';
comment on column price_history.price_basis is
  '''per_base_unit'' = price_per_base_unit/qty_base are trustworthy and comparable. ''legacy_unverified'' (default) = pre-fix row or a write-time derivation that could not be safely computed; unit_price is kept as originally written but its basis is unknown/inconsistent.';

-- Best-effort backfill: only touches a price_history row when EXACTLY ONE
-- receipt_lines row uniquely matches on (household_id, catalog_item_id,
-- observed_at = receipts.purchased_at, unit_price), since S-27's
-- backdating/multi-file queue mean several receipts can share a
-- purchased_at with the same item at the same price -- an ambiguous match
-- is left legacy_unverified rather than guessed. Requires line_total (the
-- extraction escalation ladder's own cross-validated total) and a
-- positive qty_base on the matched line.
with candidates as (
  select
    ph.id as price_history_id,
    rl.id as receipt_line_id,
    rl.line_total,
    rl.qty_base as line_qty_base,
    count(*) over (partition by ph.id) as match_count
  from price_history ph
  join receipt_lines rl
    on rl.household_id = ph.household_id
   and rl.matched_item_id = ph.catalog_item_id
   and rl.unit_price = ph.unit_price
   and rl.qty_base is not null
   and rl.qty_base > 0
   and rl.line_total is not null
  join receipts r
    on r.id = rl.receipt_id
   and r.purchased_at = ph.observed_at
  where ph.price_basis = 'legacy_unverified'
)
update price_history ph
set
  qty_base = c.line_qty_base,
  price_per_base_unit = c.line_total / c.line_qty_base,
  price_basis = 'per_base_unit'
from candidates c
where c.price_history_id = ph.id
  and c.match_count = 1;
