-- S-31: commit_receipt() now also derives price_per_base_unit at the
-- existing price_history insert. Primary: line_total / qty_base (line_total
-- is already cross-validated against the receipt's stated total within 5%
-- by the extraction escalation ladder -- working spec Sec7 -- the most
-- trustworthy total-spend figure available, and this avoids re-deriving
-- any unit-conversion ratio in SQL). Secondary fallback, only when
-- line_total is null AND pack_size is null (normalizeUnitToBase's "N x
-- Munit" multi-pack branch ignores its qty argument entirely -- confirmed
-- by reading lib/receipts/canonicalize.ts before writing this migration --
-- so a pack_size-driven qty_base cannot be safely inverted back to a
-- per-display-unit ratio; skip the fallback rather than risk a wrong
-- number flagged as trustworthy): unit_price * leading-numeric(qty_display)
-- / qty_base. Either branch succeeding sets price_basis='per_base_unit';
-- otherwise the row is left at its default 'legacy_unverified'. unit_price
-- itself is inserted exactly as before -- unchanged.

create or replace function commit_receipt(
  p_receipt_id uuid,
  p_past_order_override boolean,
  p_new_item_qty_base jsonb default '{}'::jsonb
)
returns void
language plpgsql
as $$
declare
  v_receipt receipts%rowtype;
  v_stock_epoch timestamptz;
  v_line record;
  v_category record;
  v_catalog_item_id uuid;
  v_qty_base numeric;
  v_now timestamptz := now();
  v_normalized_text text;
  v_price_per_base_unit numeric;
  v_price_basis text;
  v_qty_display_leading_numeric numeric;
begin
  select * into v_receipt from receipts where id = p_receipt_id for update;
  if not found then
    raise exception 'receipt % not found', p_receipt_id;
  end if;
  if v_receipt.purchased_at is null or not v_receipt.purchased_at_confirmed then
    raise exception 'receipt % purchase date not confirmed', p_receipt_id;
  end if;
  if exists (select 1 from receipt_lines where receipt_id = p_receipt_id and review_state = 'needs_review') then
    raise exception 'receipt % has unresolved needs_review lines', p_receipt_id;
  end if;

  select stock_epoch into v_stock_epoch from households where id = v_receipt.household_id;

  for v_line in
    select * from receipt_lines where receipt_id = p_receipt_id and review_state in ('matched', 'new_item')
  loop
    if v_line.review_state = 'new_item' then
      select id, default_base_unit into v_category
      from categories
      where slug = v_line.category_slug and parent_id is not null;

      if not found then
        raise exception 'line % has an unresolved category_slug %, cannot create catalog item', v_line.id, v_line.category_slug;
      end if;

      v_normalized_text := lower(regexp_replace(trim(coalesce(v_line.brand || ' ', '') || v_line.item_name), '\s+', ' ', 'g'));

      insert into catalog_items (household_id, canonical_name, brand, category_id, base_unit, default_pack_size, is_staple)
      values (
        v_receipt.household_id,
        v_line.item_name,
        v_line.brand,
        v_category.id,
        v_category.default_base_unit,
        case when v_line.pack_size ~ '^[0-9]+(\.[0-9]+)?$' then v_line.pack_size::numeric else null end,
        false
      )
      returning id into v_catalog_item_id;

      insert into item_aliases (household_id, catalog_item_id, raw_text, normalized_text, source, confidence)
      values (v_receipt.household_id, v_catalog_item_id, v_line.raw_text, v_normalized_text, 'commit', 1.0);

      v_qty_base := coalesce((p_new_item_qty_base ->> v_line.id::text)::numeric, 1);

      update receipt_lines set matched_item_id = v_catalog_item_id, qty_base = v_qty_base where id = v_line.id;
    else
      v_catalog_item_id := v_line.matched_item_id;
      v_qty_base := v_line.qty_base;
    end if;

    insert into stock_movements (household_id, catalog_item_id, type, qty_base, occurred_at, source_receipt_id)
    values (v_receipt.household_id, v_catalog_item_id, 'purchase', v_qty_base, v_receipt.purchased_at, p_receipt_id);

    -- Past-order override: mirrors completeOnboarding's "already have this at
    -- home" pattern exactly -- an 'initial' movement dated now() counts
    -- toward v_current_stock (occurred_at >= stock_epoch) without touching
    -- the purchase-interval history E-5 will read (type='purchase' only).
    if p_past_order_override and v_receipt.purchased_at < v_stock_epoch then
      insert into stock_movements (household_id, catalog_item_id, type, qty_base, occurred_at, source_receipt_id, note)
      values (v_receipt.household_id, v_catalog_item_id, 'initial', v_qty_base, v_now, p_receipt_id, 'past-order override: still on hand');
    end if;

    if v_line.unit_price is not null then
      v_price_per_base_unit := null;
      v_price_basis := 'legacy_unverified';

      if v_line.line_total is not null and v_qty_base > 0 then
        v_price_per_base_unit := v_line.line_total / v_qty_base;
        v_price_basis := 'per_base_unit';
      elsif v_line.line_total is null and v_line.pack_size is null and v_qty_base > 0 then
        v_qty_display_leading_numeric := substring(v_line.qty_display from '^[0-9]+(\.[0-9]+)?')::numeric;
        if v_qty_display_leading_numeric is not null then
          v_price_per_base_unit := v_line.unit_price * v_qty_display_leading_numeric / v_qty_base;
          v_price_basis := 'per_base_unit';
        end if;
      end if;

      insert into price_history (household_id, catalog_item_id, merchant, unit_price, observed_at, qty_base, price_per_base_unit, price_basis)
      values (
        v_receipt.household_id, v_catalog_item_id, v_receipt.merchant, v_line.unit_price, v_receipt.purchased_at,
        case when v_price_basis = 'per_base_unit' then v_qty_base else null end,
        v_price_per_base_unit,
        v_price_basis
      );
    end if;

    -- Minimal bookkeeping only -- the full prediction engine (EWMA, cadence,
    -- confidence) is E-5, not built yet.
    insert into item_stats (catalog_item_id, household_id, purchase_count, last_purchased_at, updated_at)
    values (v_catalog_item_id, v_receipt.household_id, 1, v_receipt.purchased_at, v_now)
    on conflict (catalog_item_id) do update
      set purchase_count = item_stats.purchase_count + 1,
          last_purchased_at = greatest(item_stats.last_purchased_at, excluded.last_purchased_at),
          updated_at = v_now;
  end loop;

  update receipts set status = 'committed' where id = p_receipt_id;
end;
$$;
