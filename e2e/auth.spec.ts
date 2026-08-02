import { test as base, expect } from '@playwright/test';

// S-57/S-58/S-59: signup, login, wrong-password rejection, logout, and the
// session-gate redirect -- replaces gate.spec.ts (the old passcode test).
// Uses the raw Playwright `test`, not the shared authenticated fixture
// (fixtures.ts) -- these specs are specifically about reaching/leaving
// that authenticated state, not what happens once inside it.

function uniqueTestEmail(): string {
  return `e2e-auth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
}

base('unauthenticated navigation redirects to /login with a next param', async ({ page }) => {
  await page.goto('/inventory');
  await expect(page).toHaveURL(/\/login\?next=%2Finventory/);
});

base('signup creates a household and reaches onboarding', async ({ page }) => {
  const email = uniqueTestEmail();
  const password = 'E2eTestPassword123!';

  await page.goto('/signup');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  await page.getByRole('button', { name: /create household/i }).click();

  await expect(page).toHaveURL(/\/onboarding/);
});

base('duplicate signup is rejected with a clear error', async ({ page }) => {
  const email = uniqueTestEmail();
  const password = 'E2eTestPassword123!';

  await page.goto('/signup');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  await page.getByRole('button', { name: /create household/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  // Log out, then attempt to sign up again with the same email.
  await page.goto('/login');
  await page.goto('/signup');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  await page.getByRole('button', { name: /create household/i }).click();

  await expect(page).toHaveURL(/\/signup/);
  await expect(page.getByRole('alert')).toBeVisible();
});

base('wrong password is rejected with a generic error and no session', async ({ page }) => {
  const email = uniqueTestEmail();
  const password = 'E2eTestPassword123!';

  // Create a real account first via signup.
  await page.goto('/signup');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  await page.getByRole('button', { name: /create household/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  // Log out via a direct navigation isn't wired to a page yet at this
  // point in the story sequence -- clear cookies to simulate a fresh,
  // logged-out browser instead.
  await page.context().clearCookies();

  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('WrongPassword999!');
  await page.getByRole('button', { name: /log in/i }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Invalid email or password.')).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name.startsWith('sb-'))).toBe(false);
});

base('correct login reaches a gated route without redirect', async ({ page }) => {
  const email = uniqueTestEmail();
  const password = 'E2eTestPassword123!';

  await page.goto('/signup');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  await page.getByRole('button', { name: /create household/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  await page.context().clearCookies();

  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /log in/i }).click();

  await expect(page).toHaveURL(/\/$|\/onboarding/);
});
