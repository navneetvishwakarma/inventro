-- S-02: RLS policies written but DISABLED (ADR-0004).
-- Row Level Security defaults to disabled until `ALTER TABLE ... ENABLE ROW
-- LEVEL SECURITY` is run — that flip is deferred to the multi-tenant phase.
-- These policies are inert today (no ENABLE call in this migration) but
-- reviewable now against the real schema, so enabling later is a flag flip,
-- not a design exercise.
--
-- Scoping key: app.current_household_id, a session-level Postgres setting.
-- No household_members/auth model exists yet (single household, no real
-- auth — ADR-0004) so this is the plausible future mechanism, not a claim
-- that it's wired up anywhere today. `categories` is global system-seeded
-- reference data and is intentionally excluded (no household_id column).

create policy household_isolation on households
  for all to authenticated
  using (id = (current_setting('app.current_household_id', true))::uuid)
  with check (id = (current_setting('app.current_household_id', true))::uuid);

create policy household_isolation on catalog_items
  for all to authenticated
  using (household_id = (current_setting('app.current_household_id', true))::uuid)
  with check (household_id = (current_setting('app.current_household_id', true))::uuid);

create policy household_isolation on item_aliases
  for all to authenticated
  using (household_id = (current_setting('app.current_household_id', true))::uuid)
  with check (household_id = (current_setting('app.current_household_id', true))::uuid);

create policy household_isolation on receipts
  for all to authenticated
  using (household_id = (current_setting('app.current_household_id', true))::uuid)
  with check (household_id = (current_setting('app.current_household_id', true))::uuid);

create policy household_isolation on receipt_lines
  for all to authenticated
  using (household_id = (current_setting('app.current_household_id', true))::uuid)
  with check (household_id = (current_setting('app.current_household_id', true))::uuid);

create policy household_isolation on stock_movements
  for all to authenticated
  using (household_id = (current_setting('app.current_household_id', true))::uuid)
  with check (household_id = (current_setting('app.current_household_id', true))::uuid);

create policy household_isolation on item_stats
  for all to authenticated
  using (household_id = (current_setting('app.current_household_id', true))::uuid)
  with check (household_id = (current_setting('app.current_household_id', true))::uuid);

create policy household_isolation on item_stats_history
  for all to authenticated
  using (household_id = (current_setting('app.current_household_id', true))::uuid)
  with check (household_id = (current_setting('app.current_household_id', true))::uuid);

create policy household_isolation on plan_entries
  for all to authenticated
  using (household_id = (current_setting('app.current_household_id', true))::uuid)
  with check (household_id = (current_setting('app.current_household_id', true))::uuid);

create policy household_isolation on shopping_lists
  for all to authenticated
  using (household_id = (current_setting('app.current_household_id', true))::uuid)
  with check (household_id = (current_setting('app.current_household_id', true))::uuid);

create policy household_isolation on shopping_list_items
  for all to authenticated
  using (household_id = (current_setting('app.current_household_id', true))::uuid)
  with check (household_id = (current_setting('app.current_household_id', true))::uuid);

create policy household_isolation on price_history
  for all to authenticated
  using (household_id = (current_setting('app.current_household_id', true))::uuid)
  with check (household_id = (current_setting('app.current_household_id', true))::uuid);

create policy household_isolation on ingest_jobs
  for all to authenticated
  using (household_id = (current_setting('app.current_household_id', true))::uuid)
  with check (household_id = (current_setting('app.current_household_id', true))::uuid);
