import { test, expect } from './fixtures';

test('authenticates through the gate and the cookie persists across navigation', async ({ page }) => {
  // The `page` fixture already logs in (see fixtures.ts) -- this test
  // proves that session survives a fresh navigation, not just the
  // post-login redirect.
  await expect(page).toHaveURL((url) => !url.pathname.startsWith('/gate'));
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText('Household', { exact: true })).toBeVisible();
});
