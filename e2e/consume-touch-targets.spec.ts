import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-95: 'Used it up', 'Used some', 'Wasted', and the 25/50/75% fraction
// buttons in consume-actions.tsx all used Button's size="sm" (32px) --
// the highest-frequency ledger-writing taps in the app, under the 44px
// target already used elsewhere in this design system (Checkbox's size-11
// hit area). Asserts real getBoundingClientRect(), not a class-name match.

const TEST_PASSWORD = 'E2eTestPassword123!';
const MIN_TOUCH_TARGET = 44;

function uniqueTestEmail(tag: string): string {
  return `e2e-consume-touch-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

async function assertMinTouchTarget(page: Page, name: string) {
  const box = await page.getByRole('button', { name }).boundingBox();
  expect(box, `expected a bounding box for button "${name}"`).not.toBeNull();
  expect(box!.height, `"${name}" height`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  expect(box!.width, `"${name}" width`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
}

test('inventory item detail: consume-action buttons meet the 44px touch target', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'targets');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin.from('categories').select('id, default_base_unit').not('parent_id', 'is', null).limit(1).single();
  if (categoryError || !category) throw categoryError;

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-95 fixture item', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  await page.goto(`/inventory/${catalogItem.id}`);
  await expect(page.getByRole('button', { name: 'Used it up' })).toBeVisible();

  await assertMinTouchTarget(page, 'Used it up');
  await assertMinTouchTarget(page, 'Used some');
  await assertMinTouchTarget(page, 'Wasted');

  await page.getByRole('button', { name: 'Used some' }).click();
  await assertMinTouchTarget(page, '25%');
  await assertMinTouchTarget(page, '50%');
  await assertMinTouchTarget(page, '75%');

  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});
