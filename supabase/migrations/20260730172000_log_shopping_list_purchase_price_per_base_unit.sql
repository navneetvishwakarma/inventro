-- S-31: log_shopping_list_purchase()'s p_unit_price is re-scoped as the
-- TOTAL PAID for the quantity being logged (v_qty_base), not a per-unit
-- rate -- this checkoff flow never showed the user a unit-price concept,
-- only a bare "Price" field next to a known quantity, so "total paid" is
-- what a human actually types there. p_unit_price is required (never null)
-- at this call site (app/shopping-list/shopping-list-item-row.tsx disables
-- the log button until a price is entered), so price_per_base_unit is
-- always derivable whenever v_qty_base > 0. The existing unit_price column
-- insert is unchanged.

create or replace function log_shopping_list_purchase(
  p_shopping_list_item_id uuid,
  p_unit_price numeric
)
returns table(out_catalog_item_id uuid, out_household_id uuid, out_already_logged boolean)
language plpgsql
as $$
declare
  v_item shopping_list_items%rowtype;
  v_default_pack_size numeric;
  v_qty_base numeric;
  v_now timestamptz := now();
  v_price_per_base_unit numeric;
  v_price_basis text := 'legacy_unverified';
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

  if v_qty_base > 0 then
    v_price_per_base_unit := p_unit_price / v_qty_base;
    v_price_basis := 'per_base_unit';
  end if;

  insert into price_history (household_id, catalog_item_id, merchant, unit_price, observed_at, qty_base, price_per_base_unit, price_basis)
  values (
    v_item.household_id, v_item.catalog_item_id, null, p_unit_price, v_now,
    case when v_price_basis = 'per_base_unit' then v_qty_base else null end,
    v_price_per_base_unit,
    v_price_basis
  );

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
