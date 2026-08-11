import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-104: docs/design/pages/inventory.md's v2 target calls for a
// highlighted endpoint on the price sparkline ("give sparklines the same
// care as type") -- sparkline.tsx rendered a flat single-color polyline
// with no marker, on both the item-card and item-detail usages.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-sparkline-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

test('sparkline: marks its latest data point on both the item card and item-detail price-trend card', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'endpoint');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin.from('categories').select('id, default_base_unit').not('parent_id', 'is', null).limit(1).single();
  if (categoryError || !category) throw categoryError;

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-104 sparkline fixture', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  // ItemCard's out-of-stock branch renders a Badge, not a Sparkline, by
  // design (sparkline "only makes sense once there's a depletion trend to
  // show") -- needs real stock so it lands in the in-stock/sparkline
  // branch.
  const { error: movementError } = await admin
    .from('stock_movements')
    .insert({ household_id: householdId, catalog_item_id: catalogItem.id, type: 'purchase', qty_base: 10, occurred_at: new Date().toISOString() });
  if (movementError) throw movementError;

  const now = Date.now();
  const { error: priceError } = await admin.from('price_history').insert([
    { household_id: householdId, catalog_item_id: catalogItem.id, unit_price: 40, observed_at: new Date(now - 3 * 86_400_000).toISOString() },
    { household_id: householdId, catalog_item_id: catalogItem.id, unit_price: 55, observed_at: new Date(now - 2 * 86_400_000).toISOString() },
    { household_id: householdId, catalog_item_id: catalogItem.id, unit_price: 48, observed_at: new Date(now - 1 * 86_400_000).toISOString() },
  ]);
  if (priceError) throw priceError;

  await page.goto('/inventory');
  await expect(page.getByText('S-104 sparkline fixture')).toBeVisible();
  const cardSparkline = page.getByRole('img', { name: 'Price trend' }).first();
  await expect(cardSparkline).toBeVisible();
  await expect(cardSparkline.locator('circle')).toHaveCount(1);

  await page.goto(`/inventory/${catalogItem.id}`);
  const detailSparkline = page.getByRole('img', { name: 'Price trend' });
  await expect(detailSparkline).toBeVisible();
  await expect(detailSparkline.locator('circle')).toHaveCount(1);

  await admin.from('price_history').delete().eq('catalog_item_id', catalogItem.id);
  await admin.from('stock_movements').delete().eq('catalog_item_id', catalogItem.id);
  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});
