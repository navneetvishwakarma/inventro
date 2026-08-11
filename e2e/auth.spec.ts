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

  // Generous timeout deliberately, not the default 5s -- this is
  // consistently the first real signUp() call in a fresh dev-server run,
  // and Next dev mode (Turbopack) lazily compiles the Server Action route
  // on its first hit rather than ahead of time (unlike a production
  // build/start, where this delay doesn't exist). Confirmed via repeated
  // isolated runs: the action itself is not slow, only its first compile.
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
});

// S-88 Fix 1: password-mismatch is a field-level problem, not a page-wide
// failure -- it must surface on the confirmPassword Input itself (aria-invalid
// + its own error slot), not as a separate page Alert. getByRole('alert')
// can't prove absence here: Next's own route announcer
// (id="__next-route-announcer__") always carries role="alert" too (see
// onboarding.spec.ts) -- so the negative assertion below excludes it by id
// rather than asserting zero role="alert" matches.
base('mismatched passwords show a field-level error on confirm password, not a page alert', async ({ page }) => {
  const email = uniqueTestEmail();

  await page.goto('/signup');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('E2eTestPassword123!');
  await page.locator('#confirmPassword').fill('SomethingElse456!');
  await page.getByRole('button', { name: /create household/i }).click();

  const confirmInput = page.locator('#confirmPassword');
  await expect(confirmInput).toHaveAttribute('aria-invalid', 'true');
  const describedBy = await confirmInput.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  await expect(page.locator(`#${describedBy}`)).toHaveText('Passwords do not match.');

  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveCount(0);
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
  // Regression guard on anti-enumeration (S-58/S-88): a bare getByRole('alert')
  // check would still pass if the message ever changed to something
  // email-existence-specific -- Next's own route announcer also carries
  // role="alert" and is always in the DOM (see onboarding.spec.ts), so this
  // asserts the exact generic text on the page's own error Alert instead.
  await expect(page.getByText('Could not create your account. Try a different email, or log in if you already have one.')).toBeVisible();
});

// S-88 Fix 2: verified via GoTrue's own source (supabase/auth
// internal/api/signup.go + password.go) that checkPasswordStrength runs
// unconditionally before any duplicate-email lookup and takes no email
// parameter -- a weak-password response is identical whether or not the
// email is already registered, so distinguishing it does not reopen the
// enumeration oracle the generic message exists to close.
base('weak password signup failure is distinct from the generic error, and duplicate-email stays generic', async ({ page }) => {
  const email = uniqueTestEmail();

  await page.goto('/signup');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('a');
  await page.locator('#confirmPassword').fill('a');
  await page.getByRole('button', { name: /create household/i }).click();

  await expect(page).toHaveURL(/\/signup/);
  const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
  await expect(alert).toBeVisible();
  const alertText = await alert.textContent();
  expect(alertText).not.toContain('Could not create your account');
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

// S-82: a real logout control bound to logoutAction, replacing the
// clearCookies() simulation used above for unrelated session-reset setup.
base('clicking log out clears the session and gates subsequent access', async ({ page }) => {
  const email = uniqueTestEmail();
  const password = 'E2eTestPassword123!';

  await page.goto('/signup');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  await page.getByRole('button', { name: /create household/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  // Settings redirects back to /onboarding until household.onboarded_at is
  // set (app/(app)/settings/page.tsx), so walk the wizard first -- same
  // 3-step happy path as the shared authenticated fixture (fixtures.ts).
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /^skip$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/onboarding'));

  await page.goto('/settings');
  await page.getByRole('button', { name: /log out/i }).click();

  await expect(page).toHaveURL(/\/login/);
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name.startsWith('sb-'))).toBe(false);

  await page.goto('/inventory');
  await expect(page).toHaveURL(/\/login\?next=%2Finventory/);
});
