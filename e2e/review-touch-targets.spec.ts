import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-91: the named per-line review actions (Save & match, Confirm as new
// item, Mark non-inventory, Retry extraction, Confirm date) used Button's
// size="sm" (h-8, 32px) -- under the 44x44px touch target Checkbox already
// gets via its size-11 hit area in the same rows. Asserts real
// getBoundingClientRect() height, not a class-name string match, since a
// class present doesn't guarantee it wins the cascade.

const TEST_PASSWORD = 'E2eTestPassword123!';
const MIN_TOUCH_TARGET = 44;

function uniqueTestEmail(tag: string): string {
  return `e2e-review-touch-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

async function assertMinTouchTarget(page: Page, name: string) {
  const box = await page.getByRole('button', { name }).boundingBox();
  expect(box, `expected a bounding box for button "${name}"`).not.toBeNull();
  expect(box!.height, `"${name}" height`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  expect(box!.width, `"${name}" width`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
}

test('review detail: per-line action buttons meet the 44px touch target', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'needsreview');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin.from('categories').select('slug').not('parent_id', 'is', null).limit(1).single();
  if (categoryError || !category) throw categoryError;

  const { data: receipt, error: receiptError } = await admin
    .from('receipts')
    .insert({ household_id: householdId, status: 'parsed', storage_paths: [], purchased_at: new Date().toISOString(), purchased_at_confirmed: true })
    .select('id')
    .single();
  if (receiptError || !receipt) throw receiptError;

  const { error: lineError } = await admin.from('receipt_lines').insert({
    household_id: householdId,
    receipt_id: receipt.id,
    line_no: 1,
    raw_text: 'S-91 fixture item',
    item_name: 'S-91 fixture item',
    category_slug: category.slug,
    review_state: 'needs_review',
  });
  if (lineError) throw lineError;

  await page.goto(`/review/${receipt.id}`);
  await expect(page.getByRole('button', { name: 'Save & match' })).toBeVisible();

  await assertMinTouchTarget(page, 'Save & match');
  await assertMinTouchTarget(page, 'Confirm as new item');
  await assertMinTouchTarget(page, 'Mark non-inventory');
  // Receipt seeded with purchased_at_confirmed: true, so this renders as
  // "Update date" (see receipt.purchased_at_confirmed in review-detail.tsx).
  await assertMinTouchTarget(page, 'Update date');

  await admin.from('receipts').delete().eq('id', receipt.id);
});

test('review detail: Retry extraction on a failed receipt meets the 44px touch target', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'failed');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: receipt, error: receiptError } = await admin
    .from('receipts')
    .insert({ household_id: householdId, status: 'pending', storage_paths: [], purchased_at: null, purchased_at_confirmed: false })
    .select('id')
    .single();
  if (receiptError || !receipt) throw receiptError;

  const { error: jobError } = await admin
    .from('ingest_jobs')
    .insert({ household_id: householdId, receipt_id: receipt.id, state: 'failed', error: 'S-91 fixture failure' });
  if (jobError) throw jobError;

  await page.goto(`/review/${receipt.id}`);
  await expect(page.getByRole('button', { name: 'Retry extraction' })).toBeVisible();
  await assertMinTouchTarget(page, 'Retry extraction');

  await admin.from('ingest_jobs').delete().eq('receipt_id', receipt.id);
  await admin.from('receipts').delete().eq('id', receipt.id);
});
