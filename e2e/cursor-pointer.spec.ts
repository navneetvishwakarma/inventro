import { test, expect } from '@playwright/test';

// S-89: enabled Button and Checkbox only set cursor-not-allowed when
// disabled -- Tailwind v4 preflight leaves the enabled state at
// cursor: default, inconsistent with Radio/ListRow's existing
// cursor-pointer. Checks computed style directly rather than a class-name
// string match, since Tailwind's cascade/specificity could make a class
// present without actually winning.

test('enabled Button shows cursor-pointer', async ({ page }) => {
  await page.goto('/login');
  const cursor = await page.locator('button[type="submit"]').first().evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).toBe('pointer');
});

test('enabled Checkbox shows cursor-pointer', async ({ page }) => {
  const email = `e2e-cursor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
  await page.goto('/signup');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('E2eTestPassword123!');
  await page.locator('#confirmPassword').fill('E2eTestPassword123!');
  await page.getByRole('button', { name: /create household/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/onboarding'), { timeout: 15_000 });
  await page.getByRole('button', { name: /continue/i }).click();

  const cursor = await page.getByRole('checkbox').first().evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).toBe('pointer');
});
