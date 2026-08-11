import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-97: getPlanItems() filters to cadenceBucket !== null, so a cold-start
// household with zero prediction data rendered identically to a
// fully-stocked household with genuinely nothing due -- both showed
// "Nothing due in this selection -- Good news, nothing needs restocking
// right now." on the Shopping List page (a plain, unhelpfully neutral "No
// items in this bucket yet." on Plan). Now distinguished: zero-prediction
// households get a distinct EmptyState nudging toward /add.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-plan-empty-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

test('plan page: zero prediction data shows a capture-nudge empty state, not a bare "no items" message', async ({ page }) => {
  await signUpAndOnboard(page, 'plan-zero');

  // No catalog_items/item_stats seeded at all -- a genuine cold start.
  await page.goto('/plan');
  await expect(page.getByText('No predictions yet')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add a receipt' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add a receipt' })).toHaveAttribute('href', '/add');
});

test('plan page: an established household with nothing due in a bucket keeps its plain empty message', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'plan-established');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();
  const category = await leafCategory(admin);

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-97 plan established fixture', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  // cadence_override with no predicted_next_purchase_at -- real prediction
  // data exists (cadenceBucket !== null via the override), just nothing
  // due, matching the invariant this story must not regress.
  const { error: statsError } = await admin
    .from('item_stats')
    .insert({ household_id: householdId, catalog_item_id: catalogItem.id, cadence_override: 'weekly' });
  if (statsError) throw statsError;

  // A different bucket than the seeded item's -- genuinely empty for THIS
  // bucket, while the household overall has prediction data.
  await page.goto('/plan?bucket=monthly');
  await expect(page.getByText('No items in this bucket yet.')).toBeVisible();
  await expect(page.getByText('No predictions yet')).toHaveCount(0);

  await admin.from('item_stats').delete().eq('catalog_item_id', catalogItem.id);
  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});

test('shopping list: zero prediction data shows a capture-nudge empty state, not the reassuring "nothing due" copy', async ({ page }) => {
  await signUpAndOnboard(page, 'shop-zero');

  await page.goto('/shopping-list');
  await page.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByText('No predictions yet')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add a receipt' })).toBeVisible();
  await expect(page.getByText('Good news', { exact: false })).toHaveCount(0);
});

test('shopping list: an established household with genuinely nothing due keeps the reassuring copy', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'shop-established');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();
  const category = await leafCategory(admin);

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-97 shop established fixture', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  // Real prediction data (cadence_override set), but no
  // predicted_next_purchase_at -- never appears in getDueSoonItems, so
  // the default "due within 3 days" generation produces a genuinely
  // empty list for an established household.
  const { error: statsError } = await admin
    .from('item_stats')
    .insert({ household_id: householdId, catalog_item_id: catalogItem.id, cadence_override: 'weekly' });
  if (statsError) throw statsError;

  await page.goto('/shopping-list');
  await page.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByText('Good news', { exact: false })).toBeVisible();
  await expect(page.getByText('No predictions yet')).toHaveCount(0);

  await admin.from('item_stats').delete().eq('catalog_item_id', catalogItem.id);
  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});
