-- S-56/E-20/REQ-31 (ADR-0006): the join table real auth needs. Signup
-- (S-57) inserts a household + this row (role='owner') in the same
-- transaction. RLS keyed on this table lands separately in S-60/E-21 --
-- this migration is schema only, no policy changes.
--
-- Fresh-start decision (recorded here, not silently done): the existing
-- DEFAULT_HOUSEHOLD_ID household ('VPF1201-Test', 2 receipts, 23 stock
-- movements -- confirmed via direct query before this migration was
-- written) is v1 dev/test fixture data, not real usage. No backfill row
-- is created for it. Once RLS enables (S-60) it becomes unreachable
-- through the request-scoped client; this is intentional, not an
-- oversight -- ADR-0006's whole point is testing isolation via fresh
-- signups, not carrying v1 fixture data forward.
create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

comment on table household_members is
  'S-56/ADR-0006: one row per (household, user). v2 is one member per household (no invite flow) -- role exists so a later invite feature is an application-logic change, not a schema migration.';
