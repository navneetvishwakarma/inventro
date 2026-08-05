# E-19 test plan — Design fidelity remediation vs design/screens/*.html

Verification per story is a visual/behavioral diff against the approved
`design/screens/*.html` reference, backed by `e2e/fidelity.spec.ts`
(added in this epic's implementation commit, 5b63299) for the assertions
that can be expressed as accessible-role/class checks rather than pixel
comparison.

| Story | What proves it's done |
|---|---|
| S-50 | Inventory filter bar renders unwrapped (no duplicate title Card); out-of-stock rows show the error-tone Badge, not a blank Sparkline; row meta shows exactly two facts. Manually diffed against `design/screens/08-inventory-list.html`. |
| S-51 | `e2e/fidelity.spec.ts` asserts the "Always exclude" button carries `bg-transparent` (ghost) and not `bg-error-subtle` (destructive). |
| S-52 | `e2e/fidelity.spec.ts` asserts the Save button's rendered width is close to its parent's content width (full-width, not shrunk). "Manage catalog" alignment confirmed via a 12-site grep as an existing, deliberate app-wide convention — documented, not changed. |
| S-53 | Manual re-audit of review-queue row density and mobile merchant-name color against `design/screens/06-review-queue.html`, confirming the fix targets only what S-48 didn't already resolve. |

## Cross-story acceptance

`e2e/fidelity.spec.ts` passes as part of the full `npm run test:e2e` suite.
No unaddressed high/medium mismatch remains against the reference, excluding
the confirmed-intentional E-16 IA deviations (5-item mobile tab bar, Today's
extra reachability quick-links).
