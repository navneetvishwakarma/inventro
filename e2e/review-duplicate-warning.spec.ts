import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-92: the near-duplicate warning ("Possible duplicate of another receipt")
// only carried near_duplicate_of's id -- there was nothing to click or read
// to verify the claim, so the "informed" intent in
// docs/ux/03-review-commit-journey.md wasn't actually met. Now inline-
// summarizes the duplicate (merchant/date/total) and links to it. Must stay
// non-blocking -- committing is still possible with the warning showing.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-review-dup-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

test('review detail: near-duplicate warning links to and summarizes the actual duplicate, and commit is still possible', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'main');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin.from('categories').select('slug').not('parent_id', 'is', null).limit(1).single();
  if (categoryError || !category) throw categoryError;

  const { data: olderReceipt, error: olderError } = await admin
    .from('receipts')
    .insert({
      household_id: householdId,
      status: 'parsed',
      storage_paths: [],
      merchant: 'S-92 Fixture Mart',
      purchased_at: '2026-08-01T10:00:00.000Z',
      purchased_at_confirmed: true,
      total_amount: 42.5,
    })
    .select('id')
    .single();
  if (olderError || !olderReceipt) throw olderError;

  const { data: receipt, error: receiptError } = await admin
    .from('receipts')
    .insert({
      household_id: householdId,
      status: 'parsed',
      storage_paths: [],
      merchant: 'S-92 Fixture Mart',
      purchased_at: '2026-08-01T10:05:00.000Z',
      purchased_at_confirmed: true,
      total_amount: 42.5,
      near_duplicate_of: olderReceipt.id,
    })
    .select('id')
    .single();
  if (receiptError || !receipt) throw receiptError;

  const { error: lineError } = await admin.from('receipt_lines').insert({
    household_id: householdId,
    receipt_id: receipt.id,
    line_no: 1,
    raw_text: 'S-92 fixture item',
    item_name: 'S-92 fixture item',
    category_slug: category.slug,
    qty_base: 1,
    review_state: 'matched',
  });
  if (lineError) throw lineError;

  await page.goto(`/review/${receipt.id}`);

  await expect(page.getByText('Possible duplicate of S-92 Fixture Mart', { exact: false })).toBeVisible();
  await expect(page.getByText('42.50', { exact: false })).toBeVisible();

  const dupLink = page.getByRole('link', { name: 'View possible duplicate' });
  await expect(dupLink).toBeVisible();
  await expect(dupLink).toHaveAttribute('href', `/review/${olderReceipt.id}`);

  // Non-blocking: commit must still be possible with the warning showing.
  await expect(page.getByRole('button', { name: 'Commit to inventory' })).toBeEnabled();

  await dupLink.click();
  await page.waitForURL((url) => url.pathname === `/review/${olderReceipt.id}`, { timeout: 10_000 });

  await admin.from('receipts').delete().eq('id', receipt.id);
  await admin.from('receipts').delete().eq('id', olderReceipt.id);
});
