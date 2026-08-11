import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-98: every zero-data card on the Insights page (projection, top-spend,
// price alerts, waste) rendered its empty condition as plain text with no
// link back to capture -- not a hard dead end (bottom nav still works),
// but each card independently missed the one obvious next action on a
// data-empty page.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-insights-cta-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

test('insights: all four zero-data cards link to /add on a cold-start household', async ({ page }) => {
  await signUpAndOnboard(page, 'cold');
  await page.goto('/insights');

  await expect(page.getByText('Not enough purchase history yet', { exact: false })).toBeVisible();
  await expect(page.getByText('No priced purchases in the trailing 90 days', { exact: false })).toBeVisible();
  await expect(page.getByText('No notable price changes', { exact: false })).toBeVisible();
  await expect(page.getByText('No waste logged this month', { exact: false })).toBeVisible();

  const addLinks = page.getByRole('link', { name: 'Add a receipt' });
  await expect(addLinks).toHaveCount(4);
  for (const link of await addLinks.all()) {
    await expect(link).toHaveAttribute('href', '/add');
  }
});

test('insights: the waste card CTA disappears once real waste data exists, others stay', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'waste');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin.from('categories').select('id, default_base_unit').not('parent_id', 'is', null).limit(1).single();
  if (categoryError || !category) throw categoryError;

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-98 waste fixture', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  // Waste report reads via an RPC scanning this month's 'waste' movements
  // -- needs prior positive stock to waste from.
  const { error: purchaseError } = await admin
    .from('stock_movements')
    .insert({ household_id: householdId, catalog_item_id: catalogItem.id, type: 'purchase', qty_base: 5, occurred_at: new Date().toISOString() });
  if (purchaseError) throw purchaseError;

  const { error: wasteError } = await admin
    .from('stock_movements')
    .insert({ household_id: householdId, catalog_item_id: catalogItem.id, type: 'waste', qty_base: -2, occurred_at: new Date().toISOString() });
  if (wasteError) throw wasteError;

  await page.goto('/insights');
  await expect(page.getByText('S-98 waste fixture')).toBeVisible();
  await expect(page.getByText('No waste logged this month', { exact: false })).toHaveCount(0);

  // The other three cards still have no real data -- their CTAs stay.
  await expect(page.getByText('Not enough purchase history yet', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add a receipt' })).toHaveCount(3);

  await admin.from('stock_movements').delete().eq('catalog_item_id', catalogItem.id);
  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});
