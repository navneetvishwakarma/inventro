-- S-60/E-21/REQ-32 (ADR-0006): the real RLS mechanism, replacing the
-- speculative current_setting('app.current_household_id') policies from
-- 20260728131120 (left in place as a historical record -- ADR-0006 is
-- explicit this is a new migration, not an edit to that one). That
-- migration's own header said the setting was "the plausible future
-- mechanism, not a claim that it's wired up anywhere today" -- nothing
-- ever set it, so those policies were dead code even before now.
--
-- New predicate: household_id in (select household_id from
-- household_members where user_id = auth.uid()) -- keyed on the real
-- membership table (S-56), not a session setting nobody sets.
--
-- This alone does nothing until the app stops using createServiceClient()
-- (service-role bypasses RLS unconditionally) for these tables --
-- S-62/S-63/S-64 do that migration. Enabling RLS here is still correct to
-- do now: it's inert-safe (service-role still works everywhere until the
-- client-swap stories land) and it's what S-66's isolation test verifies
-- end to end.
-- households is the one table in this set keyed on its own `id`, not a
-- `household_id` column (it IS the household) -- handled separately from
-- the loop below, matching the original disabled-policy migration's own
-- distinction.
drop policy if exists household_isolation on households;
create policy household_isolation on households
  for all to authenticated
  using (id in (select household_id from household_members where user_id = auth.uid()))
  with check (id in (select household_id from household_members where user_id = auth.uid()));
alter table households enable row level security;

do $$
declare
  t text;
  tables text[] := array[
    'catalog_items', 'item_aliases', 'receipts',
    'receipt_lines', 'stock_movements', 'item_stats', 'item_stats_history',
    'plan_entries', 'shopping_lists', 'shopping_list_items',
    'price_history', 'ingest_jobs'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists household_isolation on %I', t);
    execute format(
      'create policy household_isolation on %I for all to authenticated ' ||
      'using (household_id in (select household_id from household_members where user_id = auth.uid())) ' ||
      'with check (household_id in (select household_id from household_members where user_id = auth.uid()))',
      t
    );
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- categories stays exempt -- global system-seeded reference data, no
-- household_id column (unchanged from ADR-0004/the original migration).
