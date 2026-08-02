-- S-56/E-20 security-review fix (not deferred to E-21's RLS rewrite):
-- Supabase's default public-schema grants gave `anon` and `authenticated`
-- full INSERT/UPDATE/DELETE/SELECT on household_members with zero
-- protection -- confirmed live via information_schema.role_table_grants.
-- Unlike the other 12 tables (whose RLS activation is correctly E-21's
-- job, since the app is still all-service-role until then), this table is
-- new in E-20 and is the authorization source E-21's own policies will
-- trust ("household_id in (select ... from household_members where
-- user_id = auth.uid())") -- leaving it open let any authenticated user
-- self-insert a membership row into an arbitrary household, bypassing
-- create_household_for_user() entirely and pre-loading a cross-tenant
-- grant that would have survived E-21's isolation test (which checks
-- reads, not how membership was acquired).
--
-- All legitimate writes go through create_household_for_user()
-- (20260802091000), which is `security definer` and therefore bypasses
-- RLS by design -- so authenticated gets read-your-own-row only, no
-- direct write path at all.
revoke insert, update, delete, truncate, references, trigger on household_members from authenticated;
revoke all on household_members from anon;

alter table household_members enable row level security;

create policy read_own_membership on household_members
  for select to authenticated
  using (user_id = auth.uid());
