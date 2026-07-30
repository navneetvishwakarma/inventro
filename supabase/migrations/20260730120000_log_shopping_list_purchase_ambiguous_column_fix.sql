-- S-24 fix (this story's own live-Supabase verification, pre-merge): the
-- original log_shopping_list_purchase() declared RETURNS TABLE(catalog_item_id
-- uuid, household_id uuid, already_logged boolean). plpgsql implicitly
-- declares RETURNS TABLE columns as in-scope variables for the function
-- body -- so every later unqualified reference to the real columns of the
-- same name (item_stats's `on conflict (catalog_item_id)`) became
-- genuinely ambiguous between the OUT variable and the table column,
-- failing with "column reference \"catalog_item_id\" is ambiguous" the
-- first time this function actually ran. Fixed by renaming the OUT columns
-- (out_*) so they never collide with a real column name referenced inside
-- the body. Same class of fix, same sequential-migration convention S-13
-- already used for commit_receipt() (20260730073000/074000).

-- Renaming RETURNS TABLE columns changes the function's row type, which
-- plain CREATE OR REPLACE refuses ("cannot change return type of existing
-- function") -- drop first, confirmed via this story's own failed push
-- attempt, not assumed.
drop function if exists log_shopping_list_purchase(uuid, numeric);

create function log_shopping_list_purchase(
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
