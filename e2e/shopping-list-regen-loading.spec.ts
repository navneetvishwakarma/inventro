import { test, expect, type Page } from '@playwright/test';

// S-99: generate-list-panel.tsx's bucket buttons and "Generate" button only
// passed disabled={isPending}, not Button's existing loading prop -- during
// the round-trip every button in the row dimmed uniformly, with no spinner
// and no per-button distinction of which one was actually clicked. Now the
// clicked button alone renders the loading spinner (aria-busy="true"); the
// others stay merely disabled, unchanged.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-shop-loading-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

test('shopping list: the clicked generate button shows a loading spinner, others stay merely disabled', async ({ page }) => {
  await signUpAndOnboard(page, 'regen');
  await page.goto('/shopping-list');

  // Structural, not accessible-name-based: Button's loading prop replaces
  // its text children with just a spinner icon (button.tsx), so a
  // getByRole('button', { name: 'Generate' }) locator stops resolving the
  // instant loading flips true -- this is the one button inside the
  // "Due within (days)" row, alongside the days Input.
  const generateButton = page.locator('div:has(#days) > button');
  const dailyBucketButton = page.getByRole('button', { name: 'Daily' });

  await expect(generateButton).not.toHaveAttribute('aria-busy', 'true');

  // A cold-start household's generate round-trip (zero candidates,
  // archive-nothing) can complete faster than a real network+DB round
  // trip is reliably observable in a single-poll test -- delay the Server
  // Action's own POST specifically (same-URL POST, distinct from the
  // plain GET navigation) so the loading window is guaranteed wide enough
  // to assert against, without faking the feature itself.
  await page.route('**/shopping-list', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((r) => setTimeout(r, 800));
    }
    await route.continue();
  });

  // Not awaited before asserting -- the loading window is exactly what
  // this test needs to observe, not the settled end state.
  await generateButton.click();
  await expect(generateButton).toHaveAttribute('aria-busy', 'true');
  // A different button in the same row is disabled but never claims busy.
  await expect(dailyBucketButton).toBeDisabled();
  await expect(dailyBucketButton).not.toHaveAttribute('aria-busy', 'true');

  await page.waitForURL((url) => url.pathname === '/shopping-list', { timeout: 15_000 });
});
