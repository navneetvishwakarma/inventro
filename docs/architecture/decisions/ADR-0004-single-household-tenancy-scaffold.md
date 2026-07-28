---
doc: adr
project: Inventro
status: accepted
updated: 2026-07-28
story: "S-02"
---

# ADR-0004: Carry a `household_id` tenancy scaffold from day one, without building real multi-tenancy now

## Status

Accepted.

## Context

v1 has exactly one tenant and no auth — a passcode gate is the only access
control ([working spec](../../00-working-spec.md) §2). But the working spec commits to multi-tenancy as a
later phase (`docs/product/10-gtm-strategy.md`), and retrofitting a tenant key
into a schema that already has real household data in it is a materially
harder migration than carrying an always-identical UUID from the start. The
decision is how much multi-tenant-readiness to pay for now, given that none of
it is used yet.

## Decision

Every table carries `household_id`, sourced from a `DEFAULT_HOUSEHOLD_ID` env
constant. All database access stays server-side — no Supabase client in the
browser, no anon key shipped to the client; mutations via Server Actions, reads
via server components/Route Handlers. RLS policies are written into the
migration file but left `DISABLED`. Access is gated by a single shared passcode
in `middleware.ts`, explicitly not real authentication.

## Options Considered

### Option A: Full `household_id` + RLS-disabled scaffold now (chosen)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low incremental cost — one extra column per table, one boolean flip later (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) |
| Cost | Free — no additional infra |
| Scalability | High — multi-tenant migration becomes an auth + RLS-enable project, not a schema rewrite |
| Team familiarity | N/A |

**Pros:** the single largest cost driver of "add multi-tenancy later" (adding
a tenant column to every table with existing rows, backfilling it, updating
every query) is fully paid down now while there is zero data to migrate;
RLS policies are written and reviewable today even though inert, so enabling
them later is a flag flip with already-reviewed logic.
**Cons:** every query must remember to filter by `household_id` even though it
never varies in v1 — pure boilerplate today, but boilerplate that's free to
carry and expensive to add retroactively.

### Option B: No tenancy column, add auth/multi-tenancy as a v2 rewrite

**Pros:** marginally simpler schema and queries in v1.
**Cons:** the exact anti-pattern this ADR exists to avoid — retrofitting a
tenant key into a schema with real data requires a backfill migration, an
audit of every existing query for a missing filter, and redesigning RLS from
scratch against live data instead of an empty table. Materially more expensive
than the incremental cost of Option A.

### Option C: Build real auth and multi-tenancy now, skip the deferred phase entirely

**Pros:** no future migration needed at all.
**Cons:** directly contradicts the project's own scope contract (`docs/product/06-prd.md`
non-goals, working spec §15) — this is a 3-day build for one household; real
auth, invites, and RLS enforcement are explicitly out of scope and would
consume time needed for the prediction engine and capture pipeline, which are
the actual product bet.

## Trade-off Analysis

This is a case where the cheap-now, expensive-later asymmetry is large enough
to make Option A correct even though none of the tenancy machinery is
exercised in v1. The cost is a handful of `WHERE household_id = ...` clauses
that never vary; the alternative is a live-data migration project later.

## Consequences

- The passcode gate (not real auth) is the accepted access-control gap for
  v1 — explicitly scoped to grocery data only (PRD REQ-26); nothing beyond
  that should be stored in this system until the multi-tenant phase lands.
- Enabling RLS later is `ALTER TABLE` per table against already-written
  policies, not a design exercise.
- Every new table added after v1 must follow the same `household_id`
  convention or the scaffold's value is lost piecemeal.

## Alternatives considered

- **No tenancy column (Option B)** — rejected, see above.
- **Full auth now (Option C)** — rejected, out of scope per the PRD non-goals.
