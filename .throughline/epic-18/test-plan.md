# E-18 test plan — Critical rendering hotfixes (found during REQ-30 audit)

Both stories are same-day P0 hotfixes; verification is proof-by-reproduction
(broken before, fixed after) rather than new automated test files, matching
how each was actually verified at the time.

| Story | What proves it's done |
|---|---|
| S-48 | Computed-style inspection (MobileTopBar's `px-4`: 0px -> 16px) in both light and dark theme; visual check across Today/Add/Review/Insights/Catalog/Settings confirms spacing utilities apply everywhere. |
| S-49 | `/review/[id]` for a receipt with a missing Storage object: reproduced hanging 60s+ pre-fix, confirmed resolving in ~4s post-fix with the "No preview available." fallback rendering correctly. |

## Cross-story acceptance

Both fixes are live in production; no new regression across Today/Add/Review/
Insights/Catalog/Settings routes per the existing `npm run test:e2e` route
smoke suite (E-17).
