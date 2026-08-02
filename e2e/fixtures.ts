import { test as base, expect } from '@playwright/test';

// Shared auth fixture -- every spec that needs an authenticated session
// extends `test` from here instead of re-implementing signup per file.
//
// S-59/ADR-0006: replaces the old passcode-gate fixture. Signs up a fresh
// throwaway household per test run rather than logging into a fixed
// seeded account -- there is no shared seeded household anymore (the old
// DEFAULT_HOUSEHOLD_ID fixture was deliberately abandoned, S-56's ledger)
// and this is also the more honest test: it exercises the real signup ->
// isolated-household path every other spec's session then runs inside.
//
// Consequence, recorded rather than silently absorbed: specs written
// against the old seeded household's specific data (fidelity.spec.ts's
// "no out-of-stock items" skip branches, etc.) now skip more often, since
// a freshly signed-up household starts empty (A13). That's the designed
// escape hatch for this situation, not a new gap -- but it is reduced
// coverage until a follow-up story re-seeds a demo account for e2e use.
function uniqueTestEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
}

export const test = base.extend({
  // Playwright's fixture callback param is conventionally named `use` --
  // aliased here since eslint-plugin-react-hooks otherwise mistakes it for
  // React 19's `use()` hook and flags this as a misplaced hook call.
  page: async ({ page }, runTest) => {
    const email = uniqueTestEmail();
    const password = 'E2eTestPassword123!';

    await page.goto('/signup');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('#confirmPassword').fill(password);
    await page.getByRole('button', { name: /create household/i }).click();
    await page.waitForURL((url) => url.pathname.startsWith('/onboarding'));

    // Walk the 3-step wizard (household name -> presets -> tick-off) so
    // every other spec lands on a real, onboarded page -- routes.spec.ts
    // et al. assert page-identity content that only renders once
    // household.onboarded_at is set (every app/(app)/** page redirects to
    // /onboarding otherwise). Household name is prefilled; skip presets
    // and the optional tick-off step, matching the "Skip" happy path.
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /^skip$/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/onboarding'));

    await runTest(page);
  },
});

export { expect };
