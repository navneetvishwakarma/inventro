-- S-57/E-20/REQ-31 (ADR-0006): signup's bootstrap step. Every other RPC in
-- this codebase (e.g. merge_catalog_items, 20260730160000) is `security
-- invoker` by omission because it's only ever called via the service-role
-- client, which already has full access -- invoker vs. definer never
-- mattered before. This one is different: it's called via the
-- request-scoped client (createRequestClient(), lib/supabase/server.ts) as
-- the just-signed-up user, who by definition has no household_members row
-- yet. Once S-60 enables RLS keyed on household_members, a plain invoker
-- function would fail its own insert with a chicken-and-egg RLS violation
-- (can't satisfy "household_id in my memberships" for the very row that
-- grants that membership) -- `security definer` + a pinned search_path is
-- what lets this one function bypass that, deliberately and narrowly,
-- while the rest of the app's isolation model stays enforced by RLS.
create or replace function create_household_for_user(p_household_name text default 'My household')
returns table(out_household_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'create_household_for_user requires an authenticated caller';
  end if;

  insert into households (name)
  values (p_household_name)
  returning id into v_household_id;

  insert into household_members (household_id, user_id, role)
  values (v_household_id, auth.uid(), 'owner');

  return query select v_household_id;
end;
$$;

revoke execute on function create_household_for_user(text) from public;
grant execute on function create_household_for_user(text) to authenticated;
