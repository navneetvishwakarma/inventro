import { test, expect, type Page } from '@playwright/test';

// S-101: both ProgressBar components (insights, settings) were plain divs
// with a width percentage -- no role="progressbar", no aria-valuenow/
// min/max. The numeric value was available as adjacent text, so this
// wasn't a hard WCAG blocker, but a screen-reader user got no signal from
// the bar itself.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-progress-aria-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

test('settings: cost-meter progress bar carries correct ARIA semantics', async ({ page }) => {
  await signUpAndOnboard(page, 'settings');
  await page.goto('/settings');

  const bar = page.getByRole('progressbar');
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuenow', '0');
  await expect(bar).toHaveAttribute('aria-valuemin', '0');
  await expect(bar).toHaveAttribute('aria-valuemax', '100');
});

test('insights: budget progress bar aria-valuenow stays in sync with the rendered percentage', async ({ page }) => {
  await signUpAndOnboard(page, 'insights');

  await page.goto('/settings');
  await page.getByLabel('Monthly grocery budget (optional)').fill('1000');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  await page.goto('/insights');
  const bar = page.getByRole('progressbar');
  await expect(bar).toBeVisible();
  // No purchases yet -- 0 of 1000 spent, same 0% the visual width would show.
  await expect(bar).toHaveAttribute('aria-valuenow', '0');
  await expect(bar).toHaveAttribute('aria-valuemin', '0');
  await expect(bar).toHaveAttribute('aria-valuemax', '100');
});
