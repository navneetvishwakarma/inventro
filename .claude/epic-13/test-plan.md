# Epic E-13 — Notifications — test plan

No test runner exists in this repo (E-0 through E-12 precedent). Pure functions get
throwaway `npx tsx` fixture scripts (deleted after); DB-touching behavior is verified
against the live linked Supabase project, exercising real rows and cleaning up anything
inserted for the purpose of the check, with a row-count baseline diff on every touched
table after cleanup. Page-render checks reuse the proven `next dev` + signed gate cookie
+ curl recipe. Cron routes are exercised directly (POST with the real/wrong CRON_SECRET),
same pattern as S-16's recompute-stats route.

## Pre-flight (before any code)

- Confirmed live: `RESEND_API_KEY` is present as an env slot but blank; no
  `notify_email`/email column exists on `households` today. Both are genuine gaps, not
  assumed -- see sub-S-32.json's out-of-scope section for how each is handled without
  blocking the rest of the story.
- Confirmed live: Vercel Hobby plan allows up to 100 cron jobs/project, max frequency
  once/day each -- the two new entries plus the existing recompute-stats entry are within
  that limit.

## S-32 — Notifications

- **Migration applies cleanly** (`npx supabase db push`, `npx supabase migration list`
  shows local/remote timestamps matched). `households.notify_email` is nullable, both
  real households show `null` immediately after.
- **getDueSoonItems() boundary re-verification (this story's actual acceptance
  criterion), live Supabase:** using real/fixture `plan_entries` + `item_stats` rows,
  confirm: an item due in exactly 3 days is included, due in 4 days is excluded, due
  today is included, overdue (due date in the past) is included, a `snoozed` item due in
  2 days is excluded, a `skipped`-and-still-active item due in 1 day is excluded, an
  `excluded` item is excluded regardless of due date. This re-verifies S-22's function at
  the specific boundary this epic's acceptance criterion depends on, not just trusting
  the prior epic's own tests.
- **buildDailyDigest() / buildWeeklyDigest(), pure-function fixture check
  (`npx tsx`):** empty due-list produces a result the cron route will skip on; a
  non-empty list produces a subject/body containing the right item names and count for
  both the 3-day and 7-day windows.
- **POST /api/cron/digest-daily, live:**
  - No/wrong `Authorization` header -> 401, same fail-closed check as recompute-stats.
  - Real `CRON_SECRET`, due-soon list empty (real household's current state or a
    temporarily-cleared fixture) -> `{ sent: false, reason: 'nothing due within 3 days',
    dueCount: 0 }`, confirmed NO attempt is made to reach Resend (mock/short-circuit
    verified by code path, not just the response shape).
  - Real `CRON_SECRET`, due-soon list non-empty (real or fixture `plan_entries` row) but
    `RESEND_API_KEY` unset (its actual live state) -> `{ sent: false, reason:
    'RESEND_API_KEY not configured', dueCount: N }`, N matching the independently
    computed due-soon count for that moment.
  - Same non-empty case with `households.notify_email` still null (its actual live
    state) -> `{ sent: false, reason: 'no notify_email configured', dueCount: N }`.
  - Confirmed these three skip reasons are distinct strings, never coalesced.
- **POST /api/cron/digest-weekly, live:** same auth check and same three skip-reason
  cases at the 7-day window.
- **In-app badge, page-render check:** `next dev` + signed gate cookie + curl `/` ->
  200; confirm the "View plan" link's rendered HTML includes the due-soon count in
  parentheses when `dueSoon.length > 0`, and confirm the link renders with no badge
  (unchanged from before this story) when `dueSoon.length === 0` -- both states hit by
  toggling a real household's due-soon set via a temporary fixture, not assumed from one
  state alone.
- **vercel.json:** confirm both new entries parse as valid cron expressions matching
  01:30 UTC daily and 12:30 UTC Sunday-only, and that the file otherwise still contains
  the existing recompute-stats entry unchanged.
- Every fixture row created for these checks is deleted afterward; row counts on every
  touched table confirmed back at baseline.

## Incidental fix — normalizeUnitToBase multi-pack qty bug (lib/receipts/canonicalize.ts)

Not part of E-13's scope; fixed opportunistically per E-12's ledger flag. Pure-function
`npx tsx` fixture script, before and after the fix:

- `packSize="2 x 500ml"`, `qtyDisplay="1"`, target unit `ml` -> 1000 both before and
  after (qty=1 case must be unaffected by the fix).
- `packSize="2 x 500ml"`, `qtyDisplay="2"`, target unit `ml` -> before: 1000 (bug,
  ignores qty); after: 2000 (correct).
- `packSize="2 x 500ml"`, `qtyDisplay=null`, target unit `ml` -> before and after: 1000
  (null qty must default to a multiplier of 1, matching every other branch's `qty ?? 1`
  convention).
- `packSize="pack of 6"`, `qtyDisplay="2"`, target unit `piece` -> 12 before and after
  (confirms this branch was never buggy -- it already multiplies by qty -- and the fix
  does not change its behavior).

## Epic gate

Final `advisor` pass across the full changeset after the story lands and `npm run
build` is clean -- documented in ledger.md regardless of outcome.
