import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-93: catalog-manager.tsx's merge onDone handler just closed the merge UI
// and let the revalidated list quietly drop the merged row -- no "Merged
// successfully" feedback, unlike Settings' wipe flow (data-tools-panel.tsx),
// even though the audit called this a "destructive-feeling action" that
// needs resolution feedback. Now shows a success Alert naming both items.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-catalog-merge-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

test('catalog manager: a successful merge shows a success confirmation', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'confirm');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin.from('categories').select('id, default_base_unit').not('parent_id', 'is', null).limit(1).single();
  if (categoryError || !category) throw categoryError;

  const { data: itemA, error: itemAError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-93 fixture A', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (itemAError || !itemA) throw itemAError;

  const { data: itemB, error: itemBError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-93 fixture B', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (itemBError || !itemB) throw itemBError;

  await page.goto('/catalog');
  await expect(page.getByText('S-93 fixture A')).toBeVisible();
  await expect(page.getByText('S-93 fixture B')).toBeVisible();

  await page.getByText('S-93 fixture A').click();
  await page.getByText('S-93 fixture B').click();
  // Two "Merge selected" buttons render (desktop hidden md:inline-flex,
  // mobile fixed bottom bar) -- .last() is the visible one on this repo's
  // default mobile viewport, matching confirmations.spec.ts's established
  // convention for the same dual-button pattern.
  await page.getByRole('button', { name: 'Merge selected' }).last().click();

  // CardTitle renders a plain <div>, not a heading element -- no implicit
  // "heading" role to assert on.
  await expect(page.getByText('Merge these two items?')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm merge' }).click();

  await expect(page.getByText(/^Merged .+ into .+\.$/)).toBeVisible({ timeout: 20_000 });
  // Additive, not a gate: the merged (loser) row must actually be gone.
  // getByText('S-93 fixture B') alone would also match the success message
  // above ("Merged S-93 fixture B into..."), so scope to the row's checkbox.
  await expect(page.getByRole('checkbox', { name: 'S-93 fixture B' })).toHaveCount(0);

  await admin.from('catalog_items').delete().in('id', [itemA.id, itemB.id]);
});
