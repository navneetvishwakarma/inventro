import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-83: the wizard used to propagate any DB error straight to app/error.tsx,
// which remounts the wizard from scratch -- household name, budget, preset
// picks, and tick-off selections were all lost. These fixtures follow
// review-states.spec.ts's established technique: seed/mutate exact DB state
// directly via a service-role client rather than trying to time a live
// network failure mid-request.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-onboarding-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
}

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set for this fixture');
  return createClient(url, key);
}

async function signUp(page: Page, tag: string): Promise<string> {
  const email = uniqueTestEmail(tag);
  await page.goto('/signup');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('#confirmPassword').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /create household/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/onboarding'), { timeout: 15_000 });
  return email;
}

async function membershipForEmail(email: string): Promise<{ householdId: string; userId: string }> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY must be set for this fixture');

  const client = createClient(url, anonKey);
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signInError) throw signInError;

  const { data, error } = await client.from('household_members').select('household_id').single();
  if (error || !data) throw error ?? new Error('no household_members row for ' + email);
  return { householdId: data.household_id, userId: signInData.user.id };
}

test('onboarding wizard shows an inline error and keeps wizard state on a failed submit, then succeeds on retry', async ({ page }) => {
  const email = await signUp(page, 'fail');
  const { householdId, userId } = await membershipForEmail(email);
  const admin = serviceClient();

  await page.locator('#name').fill('Fail Retry Household');
  await page.locator('#budget').fill('5000');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('How do you shop?')).toBeVisible();

  const preset = page.getByRole('checkbox', { name: 'Weekly grocery run' });
  await preset.click();
  await expect(preset).toBeChecked();

  // Fault injection: remove this session's household_members row so
  // getCurrentHouseholdId() throws inside applyPresetsAction -- a real
  // thrown error from a real code path, not a mocked one.
  const { error: deleteError } = await admin.from('household_members').delete().eq('household_id', householdId).eq('user_id', userId);
  if (deleteError) throw deleteError;

  const continueButton = page.getByRole('button', { name: /continue|loading/i });
  await continueButton.click();

  // Next.js's own built-in route announcer (id="__next-route-announcer__")
  // also uses role="alert" and is always present in the DOM, so a bare
  // getByRole('alert') check is ambiguous with it and would pass without
  // ever observing the real failure. Match this wizard's own error message
  // text instead -- see the GENERIC_ONBOARDING_ERROR string in
  // app/onboarding/actions.ts (not exported: 'use server' files may only
  // export async functions).
  const errorAlert = page.getByText('Your progress is still here', { exact: false });
  await expect(errorAlert).toBeVisible();
  // Still on step 2 -- the generic app/error.tsx boundary was NOT hit, and
  // the preset pick survived the failed submit.
  await expect(page.getByText('How do you shop?')).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(preset).toBeChecked();
  await expect(continueButton).toHaveText('Continue');
  await expect(continueButton).toBeEnabled();

  // Fix the underlying fault and retry with the same click -- no state was
  // lost, so the user just presses the same button again.
  const { error: restoreError } = await admin.from('household_members').insert({ household_id: householdId, user_id: userId, role: 'owner' });
  if (restoreError) throw restoreError;

  await continueButton.click();
  await expect(page.getByText('Already have these at home?')).toBeVisible();

  await page.getByRole('button', { name: /^skip$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/onboarding'), { timeout: 15_000 });

  const { data: household, error: householdError } = await admin.from('households').select('onboarded_at, name, monthly_budget').eq('id', householdId).single();
  if (householdError) throw householdError;
  expect(household?.onboarded_at).not.toBeNull();
  expect(household?.name).toBe('Fail Retry Household');
  expect(household?.monthly_budget).toBe(5000);
});

test('completing onboarding after a partial prior failure does not duplicate stock_movements', async ({ page }) => {
  const email = await signUp(page, 'dup');
  const { householdId } = await membershipForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin.from('categories').select('id').not('parent_id', 'is', null).limit(1).single();
  if (categoryError || !category) throw categoryError ?? new Error('no leaf category seeded');

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'Test Staple Item', category_id: category.id, base_unit: 'piece', default_pack_size: 3, is_staple: true })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError ?? new Error('failed to seed catalog item');

  // Simulate a completeOnboarding call that already inserted the movement
  // but never reached the households update (household.onboarded_at is
  // still null) -- exactly the partial-failure state S-83's guard protects.
  const { error: movementError } = await admin
    .from('stock_movements')
    .insert({ household_id: householdId, catalog_item_id: catalogItem.id, type: 'initial', qty_base: 3, occurred_at: new Date().toISOString() });
  if (movementError) throw movementError;

  // Reload so the server component's getStapleItems() picks up the
  // just-seeded is_staple item into the tick-off snapshot.
  await page.goto('/onboarding');

  await page.locator('#name').fill('Dup Guard Household');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('How do you shop?')).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).click();

  await expect(page.getByText('Already have these at home?')).toBeVisible();
  const item = page.getByRole('checkbox', { name: 'Test Staple Item' });
  await item.click();
  await expect(item).toBeChecked();

  await page.getByRole('button', { name: /^finish/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/onboarding'), { timeout: 15_000 });

  const { data: household, error: householdError } = await admin.from('households').select('onboarded_at').eq('id', householdId).single();
  if (householdError) throw householdError;
  expect(household?.onboarded_at).not.toBeNull();

  const { data: movements, error: movementsError } = await admin
    .from('stock_movements')
    .select('id')
    .eq('household_id', householdId)
    .eq('catalog_item_id', catalogItem.id)
    .eq('type', 'initial');
  if (movementsError) throw movementsError;
  expect(movements).toHaveLength(1);
});
