import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-102: shopping-list-item-row.tsx's price Input (size="sm", 36px) and
// "Log purchase" Button (size="sm", 32px) sat under 44px while the row's
// own checkbox was correctly 44px. Separately, onboarding/wizard.tsx's
// step-navigation buttons used the default 40px size while login/signup
// already correctly use size="lg" (48px).

const TEST_PASSWORD = 'E2eTestPassword123!';
const MIN_TOUCH_TARGET = 44;

function uniqueTestEmail(tag: string): string {
  return `e2e-sub44-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
}

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set for this fixture');
  return createClient(url, key);
}

async function householdIdForEmail(email: string): Promise<string> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY must be set for this fixture');

  const client = createClient(url, anonKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signInError) throw signInError;

  const { data, error } = await client.from('household_members').select('household_id').single();
  if (error || !data) throw error ?? new Error('no household_members row for ' + email);
  return data.household_id;
}

async function assertMinTouchTarget(locator: ReturnType<Page['getByLabel']> | ReturnType<Page['getByRole']>, label: string) {
  const box = await locator.boundingBox();
  expect(box, `expected a bounding box for ${label}`).not.toBeNull();
  expect(box!.height, `${label} height`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  expect(box!.width, `${label} width`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
}

test('shopping list row: price input and Log purchase button meet the 44px touch target', async ({ page }) => {
  const email = uniqueTestEmail('row');
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

  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin.from('categories').select('id, default_base_unit').not('parent_id', 'is', null).limit(1).single();
  if (categoryError || !category) throw categoryError;

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-102 fixture item', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  const { error: statsError } = await admin
    .from('item_stats')
    .insert({ household_id: householdId, catalog_item_id: catalogItem.id, cadence_override: 'weekly' });
  if (statsError) throw statsError;

  await page.goto('/shopping-list');
  await page.getByRole('button', { name: 'Weekly' }).click();
  await page.waitForURL((url) => url.pathname === '/shopping-list', { timeout: 15_000 });
  await expect(page.getByText('S-102 fixture item')).toBeVisible();

  const priceInput = page.getByLabel('Total paid');
  const logButton = page.getByRole('button', { name: 'Log purchase' });
  await assertMinTouchTarget(priceInput, 'Total paid input');
  await assertMinTouchTarget(logButton, 'Log purchase button');

  await admin.from('item_stats').delete().eq('catalog_item_id', catalogItem.id);
  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});

test('onboarding wizard: step-navigation buttons use the 48px lg size, matching login/signup', async ({ page }) => {
  const email = uniqueTestEmail('wizard');
  await page.goto('/signup');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('#confirmPassword').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /create household/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/onboarding'), { timeout: 15_000 });

  // Step 1
  await assertMinTouchTarget(page.getByRole('button', { name: 'Continue' }), 'step 1 Continue');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2
  await assertMinTouchTarget(page.getByRole('button', { name: 'Back' }), 'step 2 Back');
  await assertMinTouchTarget(page.getByRole('button', { name: 'Continue' }), 'step 2 Continue');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3
  await assertMinTouchTarget(page.getByRole('button', { name: 'Skip' }), 'step 3 Skip');
  await assertMinTouchTarget(page.getByRole('button', { name: /^Finish/ }), 'step 3 Finish');
});
