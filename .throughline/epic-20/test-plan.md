# E-20 test plan — Authentication foundation

## S-56 — Supabase Auth + household_members schema migration
- **Integration**: apply the migration against a scratch Supabase project/local instance; assert `household_members` exists with the stated columns, PK, and FKs (query `information_schema`).
- **Manual**: confirm email+password provider toggle in the Supabase dashboard; record in ledger.

## S-57 — Signup Server Action
- **Unit**: none (Server Action is thin glue over Supabase Auth + two inserts) — covered by integration/E2E instead.
- **E2E** (`e2e/auth.spec.ts`): fill signup form with a fresh email → lands on `/onboarding`; assert exactly one `households` row and one `household_members` row exist for the new user (via a test-only query helper, service-role, test harness only).
- **E2E**: signup with an already-used email → inline error shown, no new `households`/`household_members` row created (diff row counts before/after).

## S-58 — Login/logout
- **E2E**: correct credentials → reaches a gated route (e.g. `/today`) without redirect.
- **E2E**: wrong password → generic "Invalid email or password" shown, still on `/login`, no session cookie set (assert via `page.context().cookies()`).
- **E2E**: logout → next request to a gated route redirects to `/login`.
- **Build-output check**: `grep` the built client bundle (`.next/static`) for the Supabase anon key value — must not appear (replaces A26).

## S-59 — Session gate
- **E2E**: unauthenticated request to `/inventory` (navigation) → redirects to `/login?next=/inventory`.
- **E2E**: unauthenticated request to a data/API route → 401, no redirect.
- **E2E**: PWA assets (`/manifest.webmanifest`, `/sw.js`, `/offline.html`, `/icons/*`) reachable with no session (regression check against the existing exemption).
- **Unit/E2E**: `next` param containing an absolute URL or `//evil.com` is rejected/normalized to `/`, not used as a redirect target (open-redirect guard).
