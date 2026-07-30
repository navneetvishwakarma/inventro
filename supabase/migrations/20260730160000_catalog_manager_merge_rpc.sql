-- S-30: catalog manager's merge tool. merge_catalog_items() reassigns every
-- real FK reference from a "loser" item to a "survivor" item, archives the
-- loser (never a hard delete -- would break the FKs this function just
-- finished reassigning past, and the loser's own history must stay
-- auditable, ADR-0001), and hands purchase_count forward explicitly (the
-- one item_stats field lib/predictions/recompute.ts's toRow() deliberately
-- never writes -- owned by the commit paths, per its own comment -- so
-- recompute alone cannot combine it). Every child-table reassignment is
-- explicitly scoped by household_id, even though the row-level locks on
-- both catalog_items rows already guarantee both belong to p_household_id --
-- deliberate, matching this repo's household-scoping convention everywhere
-- else (ADR-0004) rather than being the one incidental exception.

create or replace function merge_catalog_items(p_household_id uuid, p_survivor_id uuid, p_loser_id uuid)
returns table(out_survivor_id uuid, out_reassigned_movements integer, out_reassigned_aliases integer)
language plpgsql
as $$
declare
  v_survivor catalog_items%rowtype;
  v_loser catalog_items%rowtype;
  v_movements integer;
  v_aliases integer;
  v_survivor_purchase_count integer;
  v_loser_purchase_count integer;
  v_now timestamptz := now();
begin
  if p_survivor_id = p_loser_id then
    raise exception 'cannot merge an item into itself';
  end if;

  select * into v_survivor from catalog_items where id = p_survivor_id and household_id = p_household_id for update;
  if not found then
    raise exception 'survivor item % not found for household %', p_survivor_id, p_household_id;
  end if;

  select * into v_loser from catalog_items where id = p_loser_id and household_id = p_household_id for update;
  if not found then
    raise exception 'loser item % not found for household %', p_loser_id, p_household_id;
  end if;

  if v_survivor.is_archived then
    raise exception 'cannot merge into an archived item %', p_survivor_id;
  end if;
  if v_loser.is_archived then
    raise exception 'loser item % is already archived', p_loser_id;
  end if;

  update item_aliases set catalog_item_id = p_survivor_id where catalog_item_id = p_loser_id and household_id = p_household_id;
  get diagnostics v_aliases = row_count;

  update stock_movements set catalog_item_id = p_survivor_id where catalog_item_id = p_loser_id and household_id = p_household_id;
  get diagnostics v_movements = row_count;

  update price_history set catalog_item_id = p_survivor_id where catalog_item_id = p_loser_id and household_id = p_household_id;

  update receipt_lines set matched_item_id = p_survivor_id where matched_item_id = p_loser_id and household_id = p_household_id;

  -- plan_entries has a unique (household_id, catalog_item_id) index (S-21's
  -- migration 20260730100000) -- if the survivor already has a row, the
  -- loser's is dropped (survivor's plan entry wins) rather than reassigned,
  -- which would violate the constraint.
  delete from plan_entries
    where catalog_item_id = p_loser_id
      and household_id = p_household_id
      and exists (select 1 from plan_entries pe2 where pe2.catalog_item_id = p_survivor_id and pe2.household_id = p_household_id);
  update plan_entries set catalog_item_id = p_survivor_id where catalog_item_id = p_loser_id and household_id = p_household_id;

  update shopping_list_items set catalog_item_id = p_survivor_id where catalog_item_id = p_loser_id and household_id = p_household_id;

  -- purchase_count carry-forward: captured BEFORE either row is touched.
  -- Delete the loser's stats entirely (it's about to be archived); the
  -- survivor's item_stats row is written explicitly here with the combined
  -- count so it exists (with the right count) whether or not the survivor
  -- had a row before, and whether or not the caller's later recompute finds
  -- any purchase events to compute over -- recompute's own upsert never
  -- touches purchase_count (by design), so if this function didn't set it,
  -- a merge of two items with zero purchase movements between them would
  -- leave the survivor's row either stale (survivor-only count) or missing
  -- entirely.
  v_survivor_purchase_count := coalesce((select purchase_count from item_stats where catalog_item_id = p_survivor_id), 0);
  v_loser_purchase_count := coalesce((select purchase_count from item_stats where catalog_item_id = p_loser_id), 0);

  delete from item_stats_history where catalog_item_id in (p_survivor_id, p_loser_id) and household_id = p_household_id;
  delete from item_stats where catalog_item_id = p_loser_id and household_id = p_household_id;

  insert into item_stats (catalog_item_id, household_id, purchase_count, updated_at)
  values (p_survivor_id, p_household_id, v_survivor_purchase_count + v_loser_purchase_count, v_now)
  on conflict (catalog_item_id) do update
    set purchase_count = v_survivor_purchase_count + v_loser_purchase_count,
        updated_at = v_now;

  update catalog_items set is_archived = true where id = p_loser_id and household_id = p_household_id;

  return query select p_survivor_id, v_movements, v_aliases;
end;
$$;
