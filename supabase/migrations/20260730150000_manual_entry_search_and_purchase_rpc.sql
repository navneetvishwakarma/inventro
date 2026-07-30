-- S-29: manual entry needs two RPCs. search_catalog_items() powers the live
-- typeahead (household-scoped, recency-ranked when the query is empty,
-- trigram-ranked otherwise, with an ILIKE floor for short queries pg_trgm's
-- similarity() is weak on). log_manual_purchase() mirrors
-- log_shopping_list_purchase()'s (S-24) atomic write pattern exactly --
-- stock_movements + price_history + item_stats bump in one function -- with
-- an added new-item branch mirroring commit_receipt()'s (S-13) category
-- resolution for a genuinely new catalog item. RETURNS TABLE columns are
-- out_-prefixed per the S-24 ambiguous-column fix precedent (migration
-- 20260730120000): plpgsql implicitly declares RETURNS TABLE columns as
-- in-scope variables, which collides with real column names of the same
-- name referenced inside the function body otherwise.

create or replace function search_catalog_items(p_household_id uuid, p_query text, p_limit int default 8)
returns table (
  out_catalog_item_id uuid,
  out_canonical_name text,
  out_brand text,
  out_base_unit base_unit_type,
  out_default_pack_size numeric,
  out_category_id uuid,
  out_last_purchased_at timestamptz,
  out_last_qty_base numeric,
  out_score real
)
language sql
stable
as $$
  with ranked as (
    select
      ci.id as catalog_item_id,
      ci.canonical_name,
      ci.brand,
      ci.base_unit,
      ci.default_pack_size,
      ci.category_id,
      ist.last_purchased_at,
      case
        when p_query = '' then 1.0::real
        else greatest(
          similarity(lower(ci.canonical_name), p_query),
          coalesce((select max(similarity(a.normalized_text, p_query)) from item_aliases a where a.catalog_item_id = ci.id), 0),
          case when lower(ci.canonical_name) like '%' || p_query || '%' or (ci.brand is not null and lower(ci.brand) like '%' || p_query || '%') then 0.5 else 0 end
        )
      end as score
    from catalog_items ci
    left join item_stats ist on ist.catalog_item_id = ci.id
    where ci.household_id = p_household_id and ci.is_archived = false
  )
  select
    r.catalog_item_id,
    r.canonical_name,
    r.brand,
    r.base_unit,
    r.default_pack_size,
    r.category_id,
    r.last_purchased_at,
    -- S-24's exact fallback chain: latest real purchase, else the item's
    -- default pack size, else 1 -- a first-ever manual purchase of a
    -- seeded-but-never-bought item still prefills something.
    coalesce(
      (select sm.qty_base from stock_movements sm where sm.catalog_item_id = r.catalog_item_id and sm.type = 'purchase' order by sm.occurred_at desc limit 1),
      r.default_pack_size,
      1
    ) as last_qty_base,
    r.score
  from ranked r
  where p_query = '' or r.score > 0.15
  order by r.score desc, r.last_purchased_at desc nulls last
  limit p_limit;
$$;

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
    insert into price_history (household_id, catalog_item_id, merchant, unit_price, observed_at)
    values (p_household_id, v_catalog_item_id, null, p_unit_price, p_occurred_at);
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
