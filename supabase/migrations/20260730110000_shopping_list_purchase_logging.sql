-- S-24: checking a shopping-list item off with a price optionally logs a
-- real purchase (no receipt). purchase_logged_at/logged_price are what the
-- existing schema can't express: whether THIS row already produced a
-- ledger write, distinct from `checked` (a bare boolean a user can toggle
-- back and forth without touching history, ADR-0001).
--
-- log_shopping_list_purchase() mirrors commit_receipt()'s (S-13) per-line
-- bookkeeping body -- one stock_movements 'purchase' row (source_receipt_id
-- null, the null is load-bearing: lib/predictions/reconcile.ts's existing
-- comment says its source_receipt_id.is.null branch exists precisely for
-- shopping-list checkoffs), one price_history row, one item_stats upsert
-- bump -- but for exactly one item instead of a receipt's worth of lines,
-- and atomically guarded (FOR UPDATE row lock + purchase_logged_at IS NULL
-- check) so a double-click/double-submit race cannot double-log the same
-- checkoff: the second concurrent call blocks on the lock, then on
-- acquiring it sees purchase_logged_at already set and takes the no-op
-- branch.
--
-- Deliberately does NOT invoke S-15's reconcileRateCorrection (that stays
-- TypeScript-side, called by the caller only when this function reports
-- already_logged=false) -- reconciliation is receipt-commit-only by S-15's
-- own invariants, same reasoning recordConsumption already established for
-- consumption movements.

alter table shopping_list_items add column purchase_logged_at timestamptz;
alter table shopping_list_items add column logged_price numeric;

create or replace function log_shopping_list_purchase(
  p_shopping_list_item_id uuid,
  p_unit_price numeric
)
returns table(catalog_item_id uuid, household_id uuid, already_logged boolean)
language plpgsql
as $$
declare
  v_item shopping_list_items%rowtype;
  v_default_pack_size numeric;
  v_qty_base numeric;
  v_now timestamptz := now();
begin
  select * into v_item from shopping_list_items where id = p_shopping_list_item_id for update;
  if not found then
    raise exception 'shopping_list_item % not found', p_shopping_list_item_id;
  end if;

  if v_item.purchase_logged_at is not null then
    update shopping_list_items set checked = true where id = p_shopping_list_item_id;
    return query select v_item.catalog_item_id, v_item.household_id, true;
    return;
  end if;

  select default_pack_size into v_default_pack_size from catalog_items where id = v_item.catalog_item_id;
  v_qty_base := coalesce(v_item.qty_base, v_default_pack_size, 1);

  insert into stock_movements (household_id, catalog_item_id, type, qty_base, occurred_at, source_receipt_id)
  values (v_item.household_id, v_item.catalog_item_id, 'purchase', v_qty_base, v_now, null);

  insert into price_history (household_id, catalog_item_id, merchant, unit_price, observed_at)
  values (v_item.household_id, v_item.catalog_item_id, null, p_unit_price, v_now);

  insert into item_stats (catalog_item_id, household_id, purchase_count, last_purchased_at, updated_at)
  values (v_item.catalog_item_id, v_item.household_id, 1, v_now, v_now)
  on conflict (catalog_item_id) do update
    set purchase_count = item_stats.purchase_count + 1,
        last_purchased_at = greatest(item_stats.last_purchased_at, excluded.last_purchased_at),
        updated_at = v_now;

  update shopping_list_items
    set checked = true, purchase_logged_at = v_now, logged_price = p_unit_price
    where id = p_shopping_list_item_id;

  return query select v_item.catalog_item_id, v_item.household_id, false;
end;
$$;
