import { test, expect, type Page } from '@playwright/test';

// S-96: the only prior signal that digest emails don't send when
// RESEND_API_KEY is unset/empty was small gray helper text under the
// email field -- a user entering an address saw no error and no
// active-status indicator, and could reasonably conclude digest works.
// Settings now reads process.env.RESEND_API_KEY live (Server Component,
// force-dynamic) and shows a warning Alert whenever it's falsy. This
// repo's .env.local happens to declare RESEND_API_KEY with an empty
// value (present as a key, but Boolean('') is false, matching
// digest.ts's own `if (!apiKey)` gate) -- this dev environment's digest
// is genuinely unconfigured today, which is exactly the state this
// story fixes the missing warning for.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-digest-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
}

async function signUpAndOnboard(page: Page, tag: string): Promise<string> {
  const email = uniqueTestEmail(tag);
  await page.goto('/signup');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('#confirmPassword').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /create household/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/onboarding'), { timeout: 15_000 });
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /^skip$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/onboarding'));
  return email;
}

test('settings: digest-disabled warning is visible when RESEND_API_KEY is unset/empty', async ({ page }) => {
  await signUpAndOnboard(page, 'unconfigured');
  await page.goto('/settings');
  await expect(page.getByLabel('Digest email (optional)')).toBeVisible();
  await expect(page.getByText(/digest emails aren.t sending yet/i)).toBeVisible();
});
