# E-22 test plan — Usability & flow-completeness fixes

## S-67 — Review queue: failed/stuck/zero-line receipts
- **Unit**: `getReviewQueue()` includes `processing`/`failed` receipts with their status field populated.
- **E2E**: a receipt fixture with `status='failed'` renders the failed-state message with a retry/manual-entry action, not the full edit form.
- **Unit**: `commit_receipt()` rejects a zero-line or non-`parsed` receipt (SQL-level test or integration test against a scratch DB).
- **E2E**: the Commit button is disabled/blocked for a zero-line receipt in the UI.

## S-68 — Correction path for auto-matched lines
- **E2E**: clicking a matched line in review-detail opens the same reassignment control as a needs_review line; reassigning changes the committed catalog item.

## S-69 — Confirmation consistency
- **E2E**: consume actions (used it up/wasted) and shopping-list regeneration each show the chosen confirm pattern before the write happens.
- **E2E**: Settings wipe uses the same in-app pattern, not `window.confirm`.
- **E2E**: regenerating a list with checked-off items shows a warning before archiving.

## S-70 — Inventory empty-state branching
- **E2E**: a brand-new household (zero items) sees cold-start copy; a household with items but an active filter matching nothing sees the filtered-empty copy with "Clear filters".

## S-71 — Mobile back navigation
- **E2E** (mobile viewport): shopping-list, catalog, settings, and review-queue pages each render a working back control.

## S-72 — Spec-parity polish
- **E2E**: Plan page shows a total; item detail shows the four controls; Insights links to Settings when no budget set; login button disables on submit.
