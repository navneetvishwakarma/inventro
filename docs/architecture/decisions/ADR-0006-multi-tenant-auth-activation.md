---
doc: adr
id: ADR-0006
title: Multi-tenant auth activation (Supabase Auth + household_members + RLS keyed on auth.uid())
status: accepted
date: 2026-08-01
---

# ADR-0006: Multi-tenant auth activation

## Context

ADR-0004 deliberately paid down the schema cost of multi-tenancy in v1
(`household_id` on every table, RLS policies written but disabled) while
explicitly deferring the "auth" half of what it called an "auth + RLS-enable
project." PRD REQ-26 scoped v1 to a single shared-passcode gate with no user
identity. `docs/product/10-gtm-strategy.md` names real auth + multi-tenancy
as the first precondition for any GTM motion to exist.

v2 activates that deferred half so the app can run more than one household —
starting with the founder testing tenant isolation directly, ahead of any
real GTM decision.

Three facts fix the shape of this decision:

1. **RLS as written today is inert against how the app connects to
   Postgres.** `lib/supabase/server.ts` only ever mints a **service-role**
   client (`createServiceClient()`) — every current query bypasses RLS
   regardless of policy content. Enabling RLS with no other change is a
   no-op.
2. **The written policies key off a speculative setting.** `supabase/
   migrations/20260728131120_rls_policies_disabled.sql`'s own header says so:
   `current_setting('app.current_household_id')` was "the plausible future
   mechanism, not a claim that it's wired up anywhere today." No session
   ever sets it. There is no `household_members`/auth model to derive it
   from.
3. **No password/session dependency exists yet.** `package.json` has no
   bcrypt/argon2/jose/jsonwebtoken. `lib/gate.ts`'s cookie signs a fixed
   constant payload (`'ok'`) — zero identity concept, nothing to extend.

## Decision

**Adopt Supabase Auth (email + password) as the identity provider**, and
make it the whole of "simple username/password login" — the login form
asks for email + password, no OAuth, magic link, or passkeys. This is the
one credential-handling library already installed in this project's
dependency graph (`@supabase/supabase-js`) and it removes hand-rolled
password hashing and session/JWT handling from this codebase entirely —
the one place in this app where a homegrown mistake would be genuinely
dangerous. `auth.users` and its hashing live inside Supabase, not in this
repo.

**Add `household_members(household_id, user_id, role, created_at)`**,
composite PK `(household_id, user_id)`, FK to `households` and
`auth.users`. Signup creates a household and inserts its creator as
`owner` in the same transaction — there is no separate invite flow in v2
(see Non-goals below). A user belongs to exactly one household in v2;
testing multiple households means creating multiple accounts, not
switching households within one session. This is what actually exercises
isolation, and it's simpler than a switcher.

**Rewrite the RLS policies in a NEW migration, not the existing one.**
The disabled-policy migration stays as a historical record of the
speculative design; a new migration drops those policies, creates ones
keyed on membership:

```sql
create policy household_isolation on <table>
  for all to authenticated
  using (household_id in (select household_id from household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from household_members where user_id = auth.uid()));
```

and issues `alter table <table> enable row level security` for every
table currently in the disabled-policy migration's scope (`categories`
stays exempt — global reference data, no `household_id` column).

**Split the Supabase client layer instead of replacing it:**

- `createServiceClient()` (existing) — retained, narrowed to call sites
  that legitimately act across households with no user session, or on a
  household the caller isn't a member of. Turned out to be more than the
  two originally anticipated once implementation surfaced real gaps
  (E-21's own ledger has the detail on each):
  - `/api/cron/*` (digest + nightly recompute jobs enumerate every
    household).
  - The synthetic seeder (REQ-23, creates `is_demo`-flagged households,
    via its own separate `scripts/lib/supabaseAdmin.ts` client).
  - Storage bucket access (`.storage.*` calls in `lib/llm/extract.ts`,
    `lib/receipts/storage.ts`, `lib/review/data.ts`) — `storage.objects`
    has zero RLS policies for the receipts bucket by original design
    (access control there is private-bucket + signed-URLs, not per-role
    RLS); a request-scoped client gets a permission error on every
    download/upload.
  - `wipeDemoHouseholdData` (`lib/settings/demo-data.ts`) — always
    targets the fixed demo household, which the calling user is never a
    member of, so RLS would (correctly) deny a request-scoped client.
  - The compensating cleanup in signup's Server Action
    (`app/(auth)/signup/actions.ts`) when the household-creation RPC
    fails after `signUp` already issued a session — there's no user
    session left to clean up with otherwise.
- **New** `createRequestClient()` (`@supabase/ssr`'s server client, bound
  to `next/headers` `cookies()`) — used by every user-facing Server
  Action, Route Handler, and Server Component. Its Postgres role is
  `authenticated`, its `auth.uid()` is the signed-in user, so RLS
  actually enforces isolation for these call sites. This is the ~29
  files currently calling `createServiceClient()` and/or
  `getDefaultHouseholdId()`.

Login and signup are **Server Actions**, not client-side Supabase calls —
`createRequestClient().auth.signInWithPassword(...)` runs on the server
and sets the session cookies on the response. **The Supabase anon key
stays a server-only env var, never shipped to the client bundle** — this
preserves the existing "no Supabase key in the client JS" guarantee
(current acceptance test A26) exactly as before; only the mechanism
behind it changes.

**Replace `getDefaultHouseholdId()` with `getCurrentHouseholdId()`**,
sourced from the authenticated user's `household_members` row via the
request-scoped client, not an env var. `DEFAULT_HOUSEHOLD_ID` and
`lib/household.ts` are removed once the migration completes, not kept as
a fallback.

**Replace the passcode gate (`proxy.ts`, `lib/gate.ts`, `/gate`) with a
session gate.** No valid Supabase session → redirect to `/login`, not a
401 page. The exemption list (PWA assets, `api/cron/*`) carries over
unchanged; the mechanism it's checking changes from "signed cookie
present" to "session cookie verifies via `@supabase/ssr`."

## Non-goals (v2)

- **Household invites.** `household_members.role` exists so the schema
  doesn't need a second migration when invites eventually land, but no
  invite-by-email flow, no multi-member households, ships in v2. One
  household = one member = its creator.
- **Password reset via email.** No email delivery is configured yet
  (REQ-20 digest email is P2, still unwired per its own settings-form
  copy: "once email delivery is configured"). A user who forgets their
  password in v2 has no self-serve recovery path. Flagged, not solved —
  revisit once REQ-20's email provider decision lands.
- **Household switching UI.** Per the "one account, one household"
  decision above.
- **RLS on `categories`.** Unchanged from ADR-0004 — global reference
  data, no tenant column.

## Consequences

- `docs/architecture/06-security.md`'s access-control section is
  substantially rewritten, not amended, per that doc's own open question
  — the threat model changes from "single shared secret, blast radius
  scoped to grocery data" to "per-user credentials, blast radius scoped
  to one household, brute-force/enumeration/session-fixation now in
  scope."
- Acceptance test A26 ("unauthenticated request returns 401") is replaced
  by an equivalent session-based test; a NEW cross-household isolation
  test is added and is the hard gate on the multi-tenant epic — two
  households, one seeded item each, assert household A's session cannot
  read household B's row. This is the test that actually proves RLS
  fires, not just that it's declared.
- Every new table added after this point must carry `household_id` AND
  land its RLS policy in the same PR — the scaffold's value erodes
  piecemeal otherwise (unchanged principle from ADR-0004, now enforced
  by a live policy instead of a dormant one).
- The synthetic seeder (REQ-23) and cron routes keep using the
  service-role client by design — this is a documented, narrow exception,
  not a leftover.

## Alternatives considered

- **Enable RLS as-is, keep service-role everywhere.** Rejected — RLS
  would still be a no-op; the service-role key bypasses it unconditionally
  regardless of policy content. This alternative changes nothing about
  actual isolation.
- **Hand-rolled username/password (bcrypt + custom session table).**
  Rejected — adds a new dependency and a new class of security bug
  (password storage, session fixation, timing attacks) that Supabase Auth
  already solves and that this project has zero existing infrastructure
  for. Contradicts "keep it simple."
- **Ship the anon key to the browser, do auth client-side.** Rejected —
  breaks the existing, deliberate "no Supabase key in the client bundle"
  architecture (ADR-0004) for no functional gain; server-side
  `signInWithPassword` achieves the same UX without it.
- **Multi-household-per-user with a switcher.** Rejected for v2 — adds a
  membership-selection UI and a "current household" session concept on
  top of the "current user" one, neither of which is needed to test
  isolation between tenants. Revisit only if a real product reason
  (shared households) emerges.
