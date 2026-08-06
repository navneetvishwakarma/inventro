# E-21 test plan — Multi-tenant data isolation

## S-60 — RLS policy rewrite
- **Integration**: apply the migration; for each covered table, query `pg_policies` and `pg_class.relrowsecurity` to confirm RLS is enabled and the policy predicate matches the `auth.uid()`-via-`household_members` shape.
- **Integration**: as a Postgres role with no `household_members` row, confirm every covered table returns zero rows (RLS deny-by-default).

## S-61 — Request-scoped client
- **Unit/integration**: within a request carrying a valid Supabase session cookie, `createRequestClient()` + `select auth.uid()` returns the signed-in user's id (not null, not the service-role's implicit bypass).
- **Unit**: `getCurrentHouseholdId()` returns the correct id for a user with a membership row; throws for one without.

## S-62 / S-63 / S-64 — Migration slices
- **Regression**: existing REQ-02..REQ-24 acceptance tests (A1-A12, A18, A21, A22, A24, A25) re-run against each slice's migrated files, must stay green.
- **Grep gate**: after each slice, `grep -rn "createServiceClient\|getDefaultHouseholdId"` within that slice's file list returns zero matches.

## S-65 — Narrow service-role usage
- **Grep gate**: `grep -rn createServiceClient app lib` returns only `app/api/cron/recompute-stats/route.ts` and the cron-facing onboarding lookup.
- **Build check**: `DEFAULT_HOUSEHOLD_ID` absent from `.env.example` and the codebase.

## S-66 — Cross-household isolation (epic gate)
- **E2E** (`e2e/isolation.spec.ts`): the full two-household matrix described in its own spec — list-view isolation AND direct-id-probe denial, both directions (A→B, B→A). This is the story that actually proves the epic's acceptance criterion; every other story's tests are necessary but not sufficient without this one green.
