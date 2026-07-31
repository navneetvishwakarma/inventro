# E-17 test plan — Test infrastructure & regression coverage

This epic's product IS the test suite, so "tests for the tests" isn't
meaningful the way it is for other epics. Verification per story is: does
the suite run, is it green, and does it actually assert the fixture values
it claims to (spot-checked by hand against `docs/MANUAL-TESTS.md` and the
source constants).

| Story | What proves it's done |
|---|---|
| S-42 | `npm test` and `npm run test:e2e` both execute and exit 0 on a trivial smoke assertion; both exit non-zero when that assertion is deliberately broken (red-then-green check during implementation, not left in the final diff). |
| S-43 | `npm test` includes `computeItemStats.test.ts`; the three fixture tests' expected values are hand-verified against `docs/MANUAL-TESTS.md`'s E-5 section before merging, not just "green" (a wrong expectation that happens to pass isn't coverage). |
| S-44 | `npm test` includes `canonicalize.test.ts`; mixed-unit fixtures hand-verified against the working spec's own unit-normalization examples. |
| S-45 | `npm test` includes `reconcile.test.ts`; each of the 6 cases traced back to the exported constants in `reconcile.ts` (post-export change) rather than hand-copied numbers. |
| S-46 | `npm run test:e2e` passes locally against a running dev server; manually confirm the backdating test actually leaves stock unaffected/affected as asserted by checking the Inventory item detail page before and after, once, during implementation (not just trusting the assertion). |

## Cross-story acceptance

Once all five land: a clean checkout, `npm install`, `npm test` and
`npm run test:e2e` (with a local dev server + configured `.env.local`) both
pass with zero manual setup beyond what's already documented in the repo.
This is the epic's own acceptance clause and the prerequisite for every
REQ-29 implementation epic that follows.
