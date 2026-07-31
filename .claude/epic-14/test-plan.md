# E-14 test plan (Settings & cost controls)

No test runner exists in this repo (confirmed E-0 through E-13). Verification is: throwaway
`npx tsx` scripts for pure functions, live-Supabase scripts (service-role client, real
project, cleanup after) for anything touching the DB, and `npm run build` as the final gate.
Consistent with `.claude/epic-13/test-plan.md`'s pattern.

## S-33: Settings screen

| Acceptance / invariant | Verification |
|---|---|
| Household config writes name/monthly_budget/notify_email | Live script: call `updateHouseholdSettingsAction` (or its underlying lib function) against the real household, read back via `getHousehold()`, confirm all three fields round-trip. Revert to prior values after. |
| monthly_budget rejects negative values server-side | Throwaway script: call the update path with `monthly_budget: -5`; assert it returns a typed error and the households row is unchanged. |
| notify_email rejects syntactically-invalid input | Throwaway script: call with `notify_email: 'not-an-email'`; assert typed error, row unchanged. Then call with a valid address; assert it writes. |
| notify_email write closes E-13's gap | After setting a real-looking notify_email, call `buildDailyDigest()`/the digest route logic (or inspect the skip-reason branch) and confirm the 'no notify_email configured' skip reason no longer fires for that path (RESEND_API_KEY remains unset in this environment, so the send itself still honestly skips on THAT reason instead -- expected, documented). |
| Category management pointer works | Page-render check: `/settings` renders a link to `/catalog`; confirm the href. |
| JSON export is valid JSON, scoped to the real household | Call the export action live; `JSON.parse()` the result; confirm every row's household_id (where present) equals `DEFAULT_HOUSEHOLD_ID` and none equal `DEMO_HOUSEHOLD_ID`. |
| CSV export is valid CSV | Call the export action live; confirm a header row plus N data rows, comma count consistent per row, parses with a trivial split-based check. |
| Demo-data wipe only touches is_demo rows | Live script: snapshot row counts for both households across the 6 wiped tables; run the wipe; confirm demo household's rows are 0 and the real household's row counts are UNCHANGED. Reseed demo data after (`npm run seed:history`) so the fixture is left in its original state. |
| wipeDemoHouseholdData() cannot target the real household | Code-read + assertion check: confirm the function takes no caller-supplied household id and the `DEMO_HOUSEHOLD_ID !== getDefaultHouseholdId()` assertion is present and would throw if it ever weren't (can't be triggered live since the two are fixed distinct UUIDs -- verified by inspection, not a live test). |
| Settings page respects onboarding gate | Page-render check with a fixture household that has `onboarded_at: null` (or by inspecting the redirect logic directly) confirms redirect to `/onboarding`. |

## S-34: Cost meter + loop-bug guard

| Acceptance / invariant | Verification |
|---|---|
| currentKolkataDayRange() boundaries | Throwaway `npx tsx` script: fixed instants just before/at/after Kolkata midnight; confirm the returned [start,end) bounds classify each correctly (mirrors the existing month-range function's own verification style). |
| getTodayReceiptCount() scoping | Live script: read the real household's actual current-day receipt count directly via a raw count query; compare against the new function's return value -- must match exactly. |
| Guard blocks the 101st receipt of the day | Live script against the real household: temporarily insert 100 fixture `receipts` rows dated to today's Kolkata day (minimal columns, no Storage/LLM calls involved), call `getTodayReceiptCount()` to confirm it reads 100, then call the guarded upload action with one more file and confirm it returns `{ok:false, error:...}` WITHOUT a new Storage object or `ingest_jobs` row being created. Delete all 100 fixture rows afterward; confirm receipt count back at baseline. |
| Guard allows uploads under the cap | Live script: with today's count at 0 (real current state, confirmed before the test), call the guarded action with a small real file; confirm it succeeds normally (same behavior as before this story). |
| Partial-batch behavior at the boundary | Throwaway unit-style script against the guard's pure boundary logic (not the live DB): given a starting count of 99 and a batch of 3 files, confirm exactly 1 succeeds and 2 are blocked, in order. |
| getCostMeterSummary() aggregates correctly | Live script: read the real household's actual receipts with non-null parse_cost for the current Kolkata month, compute totalSpendUsd/receiptCount/avgCostPerReceipt/countByModelTier by hand from the raw rows, compare against the function's output -- must match exactly. |
| avgCostPerReceipt never NaN/Infinity at 0 receipts | Throwaway script: call the aggregation logic with an empty input array; confirm it returns 0, not NaN. |
| Settings page renders the cost meter | Page-render check (`next dev` + signed gate cookie + curl `/settings`): confirms the cost meter card renders with the real household's actual current numbers, and the today-count banner state (plain/amber/red) matches whichever bucket the real current count falls into. |

## Epic-level

| Check | How |
|---|---|
| `npm run build` clean | Run after all stories land; must complete with zero errors, both new routes (`/settings` at minimum) registered. |
| `npx tsc --noEmit` clean | Run before build as a faster signal. |
| `npx eslint app/ lib/` clean | Run alongside tsc. |
| No RLS/security regression | Diff review: confirm no new client-exposed Supabase call, no anon key added to any client component: settings actions all run server-side via `createServiceClient()`, same as every other mutation in this app. |
