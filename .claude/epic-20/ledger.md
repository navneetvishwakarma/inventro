| story | scope | files | tests | commit | status | risks |
|-------|-------|-------|-------|--------|--------|-------|
| S-56 | schema | supabase/migrations/20260802090000_household_members.sql | `supabase db push` applied clean; verified `select` against household_members columns OK; `auth.admin.createUser` smoke test confirms email+password provider enabled | pending | done | Fresh-start decision recorded in migration comment: existing DEFAULT_HOUSEHOLD_ID household (2 receipts, dev fixture) gets no backfill row -- becomes unreachable once RLS enables in S-60, intentional per ADR-0006 |
