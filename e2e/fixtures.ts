import { test as base, expect } from '@playwright/test';

// Shared gate-auth fixture -- every spec that needs an authenticated
// session extends `test` from here instead of re-implementing the login
// flow per file.
export const test = base.extend({
  // Playwright's fixture callback param is conventionally named `use` --
  // aliased here since eslint-plugin-react-hooks otherwise mistakes it for
  // React 19's `use()` hook and flags this as a misplaced hook call.
  page: async ({ page }, runTest) => {
    const passcode = process.env.GATE_PASSCODE;
    if (!passcode) throw new Error('GATE_PASSCODE not set (expected in .env.local)');
    await page.goto('/gate');
    await page.locator('input[type="password"]').fill(passcode);
    await page.getByRole('button', { name: /enter/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/gate'));
    await runTest(page);
  },
});

export { expect };
