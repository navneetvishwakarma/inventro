import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-94: the 25/50/75% quick-fraction consume buttons wrote a ledger
// movement on a single tap with no confirm step, inconsistent with 'Used
// it up'/'Wasted' (S-69). Also, recordConsumption resolved to 0 whenever
// virtualStockBase was already 0 and returned early with no write and no
// signal -- a fraction tap on a zero-stock item silently did nothing.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-consume-frac-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

async function leafCategory(admin: ReturnType<typeof serviceClient>) {
  const { data, error } = await admin.from('categories').select('id, default_base_unit').not('parent_id', 'is', null).limit(1).single();
  if (error || !data) throw error ?? new Error('no leaf category found');
  return data;
}

test('consume actions: a 25% fraction tap requires confirmation before writing', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'confirm');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();
  const category = await leafCategory(admin);

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-94 confirm fixture', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  const { error: movementError } = await admin
    .from('stock_movements')
    .insert({ household_id: householdId, catalog_item_id: catalogItem.id, type: 'purchase', qty_base: 8, occurred_at: new Date().toISOString() });
  if (movementError) throw movementError;

  await page.goto(`/inventory/${catalogItem.id}`);
  await page.getByRole('button', { name: 'Used some' }).click();

  // Cancel path: tapping 25% must not write immediately -- a confirm step
  // has to appear first.
  await page.getByRole('button', { name: '25%' }).click();
  await expect(page.getByText('Log 25% used?')).toBeVisible();
  await expect(page.getByText('consumption', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Log 25% used?')).toHaveCount(0);
  await expect(page.getByText('consumption', { exact: true })).toHaveCount(0);

  // Confirm path: now it actually writes. showUsedSome stayed true across
  // Cancel (it's independent state from pendingConfirm), so the fraction
  // row is already visible -- clicking "Used some" again here would toggle
  // it closed instead.
  await page.getByRole('button', { name: '25%' }).click();
  await expect(page.getByText('Log 25% used?')).toBeVisible();
  await page.getByRole('button', { name: 'Log 25%', exact: true }).last().click();
  await expect(page.getByText('Log 25% used?')).toHaveCount(0);
  await expect(page.getByText('consumption', { exact: true }).last()).toBeVisible();

  await admin.from('stock_movements').delete().eq('catalog_item_id', catalogItem.id);
  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});

test('consume actions: a fraction tap on zero stock surfaces a nothing-to-log message, not a silent no-op', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'zero');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();
  const category = await leafCategory(admin);

  // No stock_movements at all -- rawStockBase/virtualStockBase both
  // default to 0 for a brand-new catalog item.
  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-94 zero-stock fixture', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  await page.goto(`/inventory/${catalogItem.id}`);
  await page.getByRole('button', { name: 'Used some' }).click();
  await page.getByRole('button', { name: '50%' }).click();
  await expect(page.getByText('Log 50% used?')).toBeVisible();
  await page.getByRole('button', { name: 'Log 50%', exact: true }).last().click();

  await expect(page.getByText('Nothing to log', { exact: false })).toBeVisible();
  // Additive/explanatory, not silently swallowed -- and still no write.
  await expect(page.getByText('consumption', { exact: true })).toHaveCount(0);

  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});
