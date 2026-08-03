import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-72/E-22: bundled P2 spec-parity polish. Login's pending-submit-button
// sub-item is NOT covered here -- verified already implemented
// (app/(auth)/login/login-form.tsx and signup/page.tsx both already use
// useActionState's isPending), no code change made, so nothing new to test.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-specparity-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

test('Insights: "no budget set yet" links to Settings', async ({ page }) => {
  await signUpAndOnboard(page, 'insights');
  await page.goto('/insights');
  const link = page.getByRole('link', { name: 'Set a budget in Settings' });
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForURL((url) => url.pathname === '/settings');
});

test('Plan: shows a running estimated total for a bucket with priced items', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'plantotal');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();
  const category = await leafCategory(admin);

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-72 plan fixture', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  // Two purchases -> a real avgUnitPrice90d, plus a plan_entries row so
  // this item lands in a known bucket without depending on the prediction
  // engine's own cadence classification from a single data point.
  const { error: movementError } = await admin.from('stock_movements').insert([
    { household_id: householdId, catalog_item_id: catalogItem.id, type: 'purchase', qty_base: 1, occurred_at: new Date(Date.now() - 86_400_000).toISOString() },
  ]);
  if (movementError) throw movementError;

  const { error: priceError } = await admin
    .from('price_history')
    .insert({ household_id: householdId, catalog_item_id: catalogItem.id, unit_price: 42, observed_at: new Date().toISOString() });
  if (priceError) throw priceError;

  const { error: statsError } = await admin
    .from('item_stats')
    .insert({ household_id: householdId, catalog_item_id: catalogItem.id, cadence_override: 'weekly', avg_unit_price_90d: 42 });
  if (statsError) throw statsError;

  await page.goto('/plan?bucket=weekly');
  await expect(page.getByText('S-72 plan fixture')).toBeVisible();
  await expect(page.getByText('₹42.00', { exact: false })).toBeVisible();
  await expect(page.getByText('estimated', { exact: false })).toBeVisible();

  await admin.from('item_stats').delete().eq('catalog_item_id', catalogItem.id);
  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});

test('Item detail: staple toggle, perishability, cadence override, and archive all work from the item page', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'itemadmin');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();
  const category = await leafCategory(admin);

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-72 item admin fixture', category_id: category.id, base_unit: category.default_base_unit, is_staple: false })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  // setCadenceOverride() writes item_stats.cadence_override, which only
  // exists once a recompute has run at least once (the same structural
  // guarantee the Plan page relies on: getPlanItems() only ever shows
  // items with cadenceBucket !== null, which implies an item_stats row
  // already exists). item-detail shows items regardless of purchase
  // history, so the cadence-override control itself is scoped to only
  // render when cadenceBucket !== null (see item-admin-controls.tsx) --
  // seed a cadence_bucket here so that branch is actually reachable.
  const { error: statsSeedError } = await admin
    .from('item_stats')
    .insert({ household_id: householdId, catalog_item_id: catalogItem.id, cadence_bucket: 'monthly' });
  if (statsSeedError) throw statsSeedError;

  await page.goto(`/inventory/${catalogItem.id}`);

  // Staple toggle. The Checkbox primitive (@base-ui/react/checkbox) keeps a
  // visually-hidden native <input> purely for form semantics -- the real
  // interactive element is the ARIA role="checkbox" node, not that input.
  const stapleCheckbox = page.getByRole('checkbox', { name: 'Staple item (always in your typical basket)' });
  await expect(stapleCheckbox).not.toBeChecked();
  await stapleCheckbox.click();
  await expect(stapleCheckbox).toBeChecked();

  // Perishability. The input's displayed value is local useState seeded
  // from the perishabilityDays prop at mount -- it wouldn't reset even if
  // the write silently failed, so a page reload (fresh mount, fresh prop
  // from the server) is the only way to prove the write actually persisted.
  await page.getByLabel('Perishability (days, optional)').fill('14');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel('Perishability (days, optional)')).toHaveValue('14');

  // Cadence override: move to a bucket, then revert.
  await page.getByLabel('Cadence').selectOption({ label: 'Weekly' });
  await expect(page.getByRole('button', { name: 'Revert to auto' })).toBeVisible();
  await page.getByRole('button', { name: 'Revert to auto' }).click();
  await expect(page.getByRole('button', { name: 'Revert to auto' })).toHaveCount(0);

  // Archive: confirm gate, then redirect to /inventory since the archived
  // item is filtered out of getInventoryItem().
  await page.getByRole('button', { name: 'Archive item' }).click();
  await expect(page.getByText('Archive this item?')).toBeVisible();
  await page.getByRole('button', { name: 'Archive', exact: true }).last().click();
  await page.waitForURL((url) => url.pathname === '/inventory');

  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});
