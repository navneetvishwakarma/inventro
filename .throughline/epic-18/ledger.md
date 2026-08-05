# Epic E-18 — Critical rendering hotfixes (found during REQ-30 audit) — ledger

Backfilled retroactively: both stories shipped same-day, ahead of the formal
E-19 audit epic, and were reconciled into `backlog.json` with real
`verify.ci`/`verify.commit` from the start (commit 538ab22) — but never got
a GH issue or a local ledger directory until now. GH issues #132-134 created
and closed retroactively for contract completeness; no new code changed.

| story | scope | files | tests | commit | status | risks |
|-------|-------|-------|-------|--------|--------|-------|
| S-48 | app-wide unlayered CSS reset (`* { padding: 0; margin: 0; }`) silently beating every Tailwind spacing utility, in both themes | `app/globals.css` | Computed-style inspection (MobileTopBar's `px-4`: 0px -> 16px) in both themes; visual check across Today/Add/Review/Insights/Catalog/Settings | 97f7692 | done | Same bug class already fixed once in PR #79 for an unlayered color rule (`a { color: var(--link) }`) — that fix didn't touch this second unlayered rule, so the padding/margin half of the same class of bug survived. Root-caused from a real device screenshot (Android Chrome, dark mode) |
| S-49 | Unhandled rejection in `/review/[id]`'s document/text preview fetch hung the whole page indefinitely when a receipt's Storage object no longer existed | `app/(app)/review/[id]/page.tsx` | Reproduced pre-fix (60s+, never resolved) and confirmed resolved post-fix (~4s, renders correctly); matches production's own runtime-error log for this route (StorageApiError: Object not found, first seen 2026-07-30) | caead90 | done | The graceful "No preview available." fallback already existed in review-detail.tsx — it just never got exercised because the failure was unhandled upstream. Fix catches the per-file preview fetch rather than adding a new fallback path |
