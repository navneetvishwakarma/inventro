import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-69/E-22: three previously-inconsistent (or absent) confirmation
// patterns for destructive/ledger-writing actions -- native window.confirm
// (Settings wipe), a full inline confirm-with-preview (Catalog merge, left
// as is -- welded to its own two-item shape), and no confirmation at all
// (consume actions, shopping-list regeneration). This spec covers the
// three call sites this story actually changed.
//
// Seeded directly via service-role (not the shared fixtures.ts fixture) so
// a catalog item with known, non-zero stock -- and a checked-off shopping
// list item -- can be deterministically present. Reaching either state
// through the real flows (manual-entry's default quantity, the prediction
// engine bucket-generation depends on) isn't something this test should
// have to reproduce.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-confirm-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

test('consume actions: Used it up and Wasted both require confirmation before writing', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'consume');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();
  const category = await leafCategory(admin);

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-69 consume fixture', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  // Known, non-zero stock -- recordConsumption() silently no-ops when
  // rawStockBase is 0 (lib/inventory/consume.ts: "amount <= 0 -> return"),
  // which would make this test pass for the wrong reason if stock started
  // at zero.
  const { error: movementError } = await admin
    .from('stock_movements')
    .insert({ household_id: householdId, catalog_item_id: catalogItem.id, type: 'purchase', qty_base: 5, occurred_at: new Date().toISOString() });
  if (movementError) throw movementError;

  await page.goto(`/inventory/${catalogItem.id}`);
  await expect(page.getByText('purchase', { exact: true }).last()).toBeVisible();

  // Cancel path: no movement written, back to the plain button row.
  await page.getByRole('button', { name: 'Used it up' }).click();
  await expect(page.getByText('Mark as used up?')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Mark as used up?')).toHaveCount(0);
  await expect(page.getByText('consumption', { exact: true })).toHaveCount(0);
  await expect(page.getByText('waste', { exact: true })).toHaveCount(0);

  // Confirm path: Wasted actually writes.
  await page.getByRole('button', { name: 'Wasted' }).click();
  await expect(page.getByText('Mark as wasted?')).toBeVisible();
  await page.getByRole('button', { name: 'Wasted', exact: true }).last().click();
  await expect(page.getByText('Mark as wasted?')).toHaveCount(0);
  // consume.ts stores this movement as type='waste' (not 'wasted') --
  // rendered via a plain `capitalize` CSS class, so the text content
  // itself stays lowercase.
  await expect(page.getByText('waste', { exact: true }).last()).toBeVisible();
});

test('Settings: wipe demo data uses the in-app confirm panel, not window.confirm', async ({ page }) => {
  await signUpAndOnboard(page, 'wipe');
  // If this used window.confirm, an unhandled native dialog would block
  // the test (Playwright auto-dismisses unhandled dialogs, which would
  // itself prove the point, but asserting the in-app panel directly is a
  // stronger, more specific check).
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Wipe demo data' }).click();
  await expect(page.getByText('Wipe demo data?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  // Cancel only -- this is a shared demo household other tests/features
  // also use; this test verifies the confirmation UI, not the wipe itself.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Wipe demo data?')).toHaveCount(0);
});

test('shopping list: regenerating over a list with checked-off items warns before archiving it', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'shoplist');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();
  const category = await leafCategory(admin);

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-69 fixture item', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  const { data: list, error: listError } = await admin
    .from('shopping_lists')
    .insert({ household_id: householdId, name: 'S-69 fixture list', status: 'active' })
    .select('id')
    .single();
  if (listError || !list) throw listError;

  const { error: itemError } = await admin
    .from('shopping_list_items')
    .insert({ household_id: householdId, shopping_list_id: list.id, catalog_item_id: catalogItem.id, checked: true });
  if (itemError) throw itemError;

  await page.goto('/shopping-list');
  await expect(page.getByText('S-69 fixture item')).toBeVisible();

  await page.getByRole('button', { name: 'Weekly' }).click();
  await expect(page.getByText('Replace the current list?')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Replace the current list?')).toHaveCount(0);
  // Cancelled -- the fixture list and its checked item must still be there.
  await expect(page.getByText('S-69 fixture item')).toBeVisible();

  await admin.from('shopping_list_items').delete().eq('shopping_list_id', list.id);
  await admin.from('shopping_lists').delete().eq('id', list.id);
  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});
