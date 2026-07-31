-- S-31: log_manual_purchase()'s p_unit_price is re-scoped as the TOTAL
-- PAID for p_qty_base, same reasoning as the shopping-list checkoff fix
-- (20260730172000) -- this flow shows a "Price (optional)" field right
-- next to a known quantity, no unit concept. p_unit_price stays nullable
-- (optional at this call site); price_per_base_unit is derived only when
-- both are present and p_qty_base > 0. unit_price insert unchanged.

create or replace function log_manual_purchase(
  p_household_id uuid,
  p_catalog_item_id uuid,
  p_new_item_name text,
  p_new_item_brand text,
  p_new_item_category_slug text,
  p_raw_text text,
  p_qty_base numeric,
  p_unit_price numeric,
  p_occurred_at timestamptz
)
returns table(out_catalog_item_id uuid, out_created_new boolean)
language plpgsql
as $$
declare
  v_catalog_item_id uuid;
  v_category record;
  v_normalized_text text;
  v_now timestamptz := now();
  v_created_new boolean := false;
  v_price_per_base_unit numeric;
  v_price_basis text := 'legacy_unverified';
begin
  if p_catalog_item_id is not null then
    select id into v_catalog_item_id from catalog_items where id = p_catalog_item_id and household_id = p_household_id and is_archived = false;
    if not found then
      raise exception 'catalog item % not found (or archived) for household %', p_catalog_item_id, p_household_id;
    end if;
  else
    if p_new_item_name is null then
      raise exception 'either p_catalog_item_id or p_new_item_name must be provided';
    end if;

    if p_new_item_category_slug = 'uncategorized' then
      raise exception 'a new item must have a real category, not uncategorized';
    end if;

    select id, default_base_unit into v_category
    from categories
    where slug = p_new_item_category_slug and parent_id is not null;

    if not found then
      raise exception 'unresolved category_slug %, cannot create catalog item', p_new_item_category_slug;
    end if;

    v_normalized_text := lower(regexp_replace(trim(coalesce(p_new_item_brand || ' ', '') || p_new_item_name), '\s+', ' ', 'g'));

    insert into catalog_items (household_id, canonical_name, brand, category_id, base_unit, default_pack_size, is_staple)
    values (p_household_id, p_new_item_name, p_new_item_brand, v_category.id, v_category.default_base_unit, null, false)
    returning id into v_catalog_item_id;

    insert into item_aliases (household_id, catalog_item_id, raw_text, normalized_text, source, confidence)
    values (p_household_id, v_catalog_item_id, coalesce(p_raw_text, p_new_item_name), v_normalized_text, 'manual', 1.0);

    v_created_new := true;
  end if;

  insert into stock_movements (household_id, catalog_item_id, type, qty_base, occurred_at, source_receipt_id, note)
  values (p_household_id, v_catalog_item_id, 'purchase', p_qty_base, p_occurred_at, null, 'manual entry');

  if p_unit_price is not null then
    if p_qty_base > 0 then
      v_price_per_base_unit := p_unit_price / p_qty_base;
      v_price_basis := 'per_base_unit';
    end if;

    insert into price_history (household_id, catalog_item_id, merchant, unit_price, observed_at, qty_base, price_per_base_unit, price_basis)
    values (
      p_household_id, v_catalog_item_id, null, p_unit_price, p_occurred_at,
      case when v_price_basis = 'per_base_unit' then p_qty_base else null end,
      v_price_per_base_unit,
      v_price_basis
    );
  end if;

  insert into item_stats (catalog_item_id, household_id, purchase_count, last_purchased_at, updated_at)
  values (v_catalog_item_id, p_household_id, 1, p_occurred_at, v_now)
  on conflict (catalog_item_id) do update
    set purchase_count = item_stats.purchase_count + 1,
        last_purchased_at = greatest(item_stats.last_purchased_at, excluded.last_purchased_at),
        updated_at = v_now;

  return query select v_catalog_item_id, v_created_new;
end;
$$;
