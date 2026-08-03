import { test, expect } from './fixtures';
import { test as rawTest, expect as rawExpect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-70/E-22: app/(app)/inventory/page.tsx used to show "No items match
// these filters" + "Clear filters" for a brand-new household with zero
// items ever tracked (A13) -- the same copy used for a real filter
// dead-end, which is actively wrong when there's nothing to clear.

test('Inventory: a brand-new household with zero items sees cold-start copy, not "Clear filters"', async ({ page }) => {
  // fixtures.ts's shared authenticated fixture signs up a fresh household
  // and stops at onboarding's "Skip" step -- exactly A13's cold-start case.
  await page.goto('/inventory');
  await expect(page.getByText('Nothing tracked yet')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add an item' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Clear filters' })).toHaveCount(0);
});

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-invempty-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

rawTest('Inventory: a household with items but a dead-end filter sees "No items match these filters" + Clear filters', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'filtered');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin.from('categories').select('id, default_base_unit').not('parent_id', 'is', null).limit(1).single();
  if (categoryError || !category) throw categoryError;

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-70 fixture item', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  const { error: movementError } = await admin
    .from('stock_movements')
    .insert({ household_id: householdId, catalog_item_id: catalogItem.id, type: 'purchase', qty_base: 1, occurred_at: new Date().toISOString() });
  if (movementError) throw movementError;

  await page.goto('/inventory');
  await rawExpect(page.getByText('Nothing tracked yet')).toHaveCount(0);

  await page.goto('/inventory?q=zzz-no-such-item-anywhere');
  await rawExpect(page.getByText('No items match these filters')).toBeVisible();
  await rawExpect(page.getByRole('link', { name: 'Clear filters' })).toBeVisible();
  await rawExpect(page.getByText('Nothing tracked yet')).toHaveCount(0);

  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});
