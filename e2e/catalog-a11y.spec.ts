import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-87: the Recategorize Select in catalog-manager.tsx only passed
// placeholder="Recategorize..." -- Select only renders a <label> when a
// `label` prop is given, and placeholder isn't wired to any ARIA attribute,
// so the control had no accessible name at all (WCAG 4.1.2). Seeded via
// service-role, following review-states.spec.ts/confirmations.spec.ts's
// established technique -- a fresh household has zero catalog_items, and
// the Select only renders per non-archived item.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-catalog-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

test('catalog manager: Recategorize control has an accessible name', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'a11y');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin.from('categories').select('id, default_base_unit').not('parent_id', 'is', null).limit(1).single();
  if (categoryError || !category) throw categoryError;

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-87 fixture item', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

  await page.goto('/catalog');
  await expect(page.getByText('S-87 fixture item')).toBeVisible();

  // Accessible-name-based locator: this only finds the control if it has a
  // real accessible name (label or aria-label), not just visible placeholder
  // text -- exactly the WCAG 4.1.2 gap this story fixes.
  await expect(page.getByRole('combobox', { name: /recategorize item/i })).toBeVisible();

  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});
