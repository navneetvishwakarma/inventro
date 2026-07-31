# E-15 test plan (PWA & ship polish)

No test runner exists in this repo (confirmed E-0 through E-14). Verification is: throwaway
`npx tsx` scripts for pure functions, live-Supabase scripts (service-role client, real
project, cleanup after) for anything touching the DB, curl-based page-render checks against
both local dev and the production URL, and `npm run build` as the final gate. Consistent with
`.claude/epic-14/test-plan.md`'s pattern.

## S-35: PWA manifest + installability

| Acceptance / invariant | Verification |
|---|---|
| manifest.webmanifest is valid, reachable | curl `/manifest.webmanifest` with a signed gate cookie against local dev; `JSON.parse()` the response; confirm required fields (name, icons, start_url, display, share_target) present. |
| Icons reachable and valid SVG | curl `/icons/icon.svg` and `/icons/icon-maskable.svg`; confirm 200 + `image/svg+xml` content-type + well-formed XML. |
| Lighthouse installability criteria met (by hand, no headless browser) | Check the manifest JSON against Chrome's documented installability checklist (name/short_name, icons incl. one >=192px-equivalent, start_url, display standalone/fullscreen/minimal-ui, served over HTTPS) field by field. |
| Service worker registers, precaches shell only | Code-read of `public/sw.js`'s install handler; confirm `SHELL_ASSETS` contains only manifest/icons/offline.html, never a page or API route. |
| SW fetch handler never caches dynamic responses | Code-read: confirm the fetch listener's early-return guards on `event.request.mode !== 'navigate'`, and the navigate branch never calls `cache.put` for a live network response -- only reads the precached offline fallback on failure. |
| Share-target route applies the same guard/dedup checks as manual upload | Live script: call the route handler's underlying logic directly (or via a real multipart POST to `/api/share-target` with a signed gate cookie) with a small real image; confirm a `receipts` row + `ingest_jobs` row are created and the response is a 303 to `/review/<id>`; confirm re-submitting the same bytes is rejected as a duplicate (same `content_hash` path as the manual upload action). Clean up the inserted fixture receipt/storage object afterward. |
| Share-target route stays gated | curl `/api/share-target` (POST, no cookie) against local dev; confirm 401, not a bypass. |
| Daily guard applies to shared files too | Code-read: confirm the route calls `getTodayReceiptCount()`/`allowedCountInBatch()` before any Storage/LLM work, same as `uploadReceiptsAction`. |

## S-36a: Error/empty/loading states, mobile pass, dark mode

| Acceptance / invariant | Verification |
|---|---|
| error.tsx / global-error.tsx render on a thrown error | Throwaway script or code-inspection: temporarily force a throw in a page's data fetch (local dev only, reverted immediately, confirmed via `git diff` clean), confirm the styled boundary renders instead of Next's default crash screen; global-error.tsx code-read confirms it emits its own `<html>/<body>`. |
| not-found.tsx renders for an unmatched route | curl a nonexistent route (`/does-not-exist`) with a signed gate cookie against local dev; confirm the styled 404 renders, not Next's default. |
| loading.tsx covers every route without its own | Code-read: confirm `app/loading.tsx` exists and no page currently defines a conflicting nested `loading.tsx` that would shadow it unexpectedly. |
| Every route has a defined empty state | Per-route code-read confirming a zero-data render path exists (Today/A13 cold-start copy, Inventory's 'No items match these filters', Plan/Shopping List/Insights/Catalog/Review-queue's own zero-row cases) -- listed explicitly in the ledger per route, not asserted in bulk. |
| Dark-mode class toggle works, no FOUC | Code-read of the blocking `<head>` script; confirm it runs before hydration (inline `<script>`, not `useEffect`) and both branches (matches/doesn't match `prefers-color-scheme: dark`) are handled, plus the live `change` listener. |
| Dark-mode color-token fixes are legible | For each of the ~13 grep-found call sites, confirm a `dark:` variant is present and pairs a status color with sufficient contrast against `--background`'s dark value (`oklch(0.145 0 0)`) -- verified by reading the resulting Tailwind classes and their resolved OKLCH values, not a rendered screenshot. |
| Mobile pass: no fixed-width overflow | Code-read of every page/component's inline styles and flex layouts for viewport widths down to ~360px; confirm `overflow-x: hidden` (already global in `globals.css`) is never fighting a wider fixed-width element. |

## S-36b: Security pass + full acceptance-test ship-gate verification

| Acceptance / invariant | Verification |
|---|---|
| Anon key absent from client bundle | `npm run build`; `grep -r "<the real NEXT_PUBLIC_SUPABASE_ANON_KEY value>" .next/` (or a distinguishing substring); confirm zero matches. |
| Unauthenticated request 401s (A26) | `curl -s -o /dev/null -w '%{http_code}' https://inventro-tau.vercel.app/` with no cookie; confirm `401`. |
| Gate cookie still authenticates production | Sign a gate cookie locally using the real `GATE_COOKIE_SECRET` (same HMAC-SHA256 algorithm as `lib/gate.ts`); curl production with that cookie; confirm `200`. |
| A1-A26 sweep table | Documented in the ledger: one row per test, verification method (`live-e2e` for A26; `reachability + code-trace, verified live in E-<n>` for every business-logic test this epic's diff doesn't touch), and pass/fail. |
| This epic's diff didn't break any existing route | curl every route (`/`, `/inventory`, `/plan`, `/shopping-list`, `/insights`, `/catalog`, `/settings`, `/add`, `/add/manual`, `/review`, `/onboarding`) against production with the signed gate cookie; confirm 200 (or the expected redirect, e.g. onboarding gate) for each. |

## Epic-level

| Check | How |
|---|---|
| `npm run build` clean | Run after all stories land; must complete with zero errors, new routes (`/api/share-target` at minimum) registered. |
| `npx tsc --noEmit` clean | Run before build as a faster signal. |
| `npx eslint app/ lib/` clean | Run alongside tsc. |
| No RLS/security regression | Diff review: confirm no new client-exposed Supabase call; the share-target route runs server-side via the same `createServiceClient()`-backed lib functions as every other mutation. |
| Production URL live-verified | The final story (S-36b) is the terminal ship gate for the whole v1 backlog -- its pass table is the record that all §11 acceptance tests hold on production, not just local dev. |
