# Epic E-19 — Design fidelity remediation vs design/screens/*.html — ledger

Backfilled retroactively: this epic shipped (PR #104) and its GH issues
(#99-#103) were opened and closed correctly, but the local ledger directory
was never written and `verify.ci`/`verify.commit` was never recorded on the
stories — `sync-status.mjs`'s auto-close only flips `status`, it doesn't
stamp verify evidence. Reconstructed from the real merged diff (5b63299,
PR #104) plus each GH sub-issue's own body, not invented after the fact.

| story | scope | files | tests | commit | status | risks |
|-------|-------|-------|-------|--------|--------|-------|
| S-50 | Inventory list: unwrap the duplicate title Card, restore out-of-stock badge, drop the third meta line | `app/(app)/inventory/page.tsx`, `app/(app)/inventory/item-card.tsx`, `components/ui/badge.tsx` (added `data-slot="badge"`), `components/ui/table.tsx` | `e2e/fidelity.spec.ts` (new); manual visual check vs `design/screens/08-inventory-list.html` | 5b63299 (merged to main via PR #104, cf2c8b2) | done | Two-item meta (qty, cadence) chosen over three — the reference never shows "last bought" alongside the other two facts at once, not an oversight |
| S-51 | Plan: "Always exclude" button variant destructive -> ghost | `app/(app)/plan/plan-item-actions.tsx` | `e2e/fidelity.spec.ts` — asserts `bg-transparent` class present, `bg-error-subtle` absent (skips if no pending-bucket item in the seeded household) | 5b63299 (merged to main via PR #104, cf2c8b2) | done | none |
| S-52 | Settings: Save button full-width (direct flex-col child, not wrapped in a shrinking flex row); Manage catalog alignment investigated | `app/(app)/settings/settings-form.tsx` | `e2e/fidelity.spec.ts` — asserts Save button width is close to its parent's content width | 5b63299 (merged to main via PR #104, cf2c8b2) | done | "Manage catalog" `self-start` alignment left unchanged — confirmed via a 12-site grep as a deliberate, consistent app-wide convention for secondary/ghost action links, not a bug. Documented rather than changed, per the story's own acceptance criteria |
| S-53 | Review queue (mobile): merchant name forces `text-foreground` instead of inheriting the ambient link-color base rule | `app/(app)/inventory/page.tsx` (table row styling shared with review queue), `components/ui/table.tsx` | `e2e/fidelity.spec.ts`; manual re-audit against `design/screens/06-review-queue.html` post-S-48 | 5b63299 (merged to main via PR #104, cf2c8b2) | done | Explicitly scoped as a re-audit — both findings (row density, merchant color) were flagged before S-48's padding fix landed and were confirmed still-real before this fix, not re-fixing what S-48 already handled |
