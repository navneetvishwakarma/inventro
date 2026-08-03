import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-67/E-22: getReviewQueue() used to filter to status='parsed' only, so a
// receipt stuck in processing or permanently failed vanished from the
// queue with no trace, and review-detail.tsx rendered the full editable
// form regardless of status, so a zero-line receipt could be committed.
// These fixtures are seeded directly via a service-role client (the app
// itself never manufactures a 'failed' receipt deterministically -- that
// requires the LLM call to actually fail) into a freshly signed-up
// household, read back through that household's own authenticated
// session -- exactly like a real stuck/failed extraction would appear to
// that user. Signs up directly (not the shared fixtures.ts fixture) so the
// household id can be derived deterministically from this test's own user,
// not inferred by "most recently created household" against a shared live
// database other processes may also be writing to.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-review-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

test('review queue and detail: a failed extraction surfaces a retry/manual-entry state, not silence', async ({ page }) => {
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
    .insert({ household_id: householdId, receipt_id: receipt.id, state: 'failed', error: 'schema validation failed: test fixture' });
  if (jobError) throw jobError;

  await page.goto('/review');
  await expect(page.getByText('Failed').last()).toBeVisible();

  await page.goto(`/review/${receipt.id}`);
  await expect(page.getByText('Extraction failed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry extraction' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Enter manually' })).toBeVisible();
  // The full editable review form (Commit button) must NOT render for a
  // failed receipt -- that's the exact silent-commit-adjacent bug this
  // story closes.
  await expect(page.getByRole('button', { name: 'Commit to inventory' })).toHaveCount(0);

  await admin.from('ingest_jobs').delete().eq('receipt_id', receipt.id);
  await admin.from('receipts').delete().eq('id', receipt.id);
});

test('review queue and detail: a still-processing receipt shows a processing state, not the empty edit form', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'processing');
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
    .insert({ household_id: householdId, receipt_id: receipt.id, state: 'processing' });
  if (jobError) throw jobError;

  await page.goto('/review');
  await expect(page.getByText('Processing').last()).toBeVisible();

  await page.goto(`/review/${receipt.id}`);
  await expect(page.getByText('Still parsing')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commit to inventory' })).toHaveCount(0);

  await admin.from('ingest_jobs').delete().eq('receipt_id', receipt.id);
  await admin.from('receipts').delete().eq('id', receipt.id);
});

test('review detail: a parsed receipt with zero committable lines blocks commit with a clear reason', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'zeroline');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: receipt, error: receiptError } = await admin
    .from('receipts')
    .insert({
      household_id: householdId,
      status: 'parsed',
      storage_paths: [],
      purchased_at: new Date().toISOString(),
      purchased_at_confirmed: true,
    })
    .select('id')
    .single();
  if (receiptError || !receipt) throw receiptError;

  await page.goto(`/review/${receipt.id}`);
  const commitButtons = page.getByRole('button', { name: 'Commit to inventory' });
  await expect(commitButtons.first()).toBeDisabled();
  await expect(page.getByText('this receipt has no items to commit').last()).toBeVisible();

  await admin.from('receipts').delete().eq('id', receipt.id);
});

// S-68: a matched line used to render as an inert ListRow -- only
// needs_review lines were clickable/editable. Proves the affordance (click
// opens the same reassignment control) and that an action taken there
// actually persists, using "Mark non-inventory" as the simplest
// deterministic action available (reassigning to a different catalog item
// depends on the live trigram-match algorithm's exact score, which isn't
// something this test should have to reproduce to prove the UI wiring).
test('review detail: a matched line is clickable and opens the same reassignment control as needs_review', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'matched');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin.from('categories').select('id, slug, default_base_unit').not('parent_id', 'is', null).limit(1).single();
  if (categoryError || !category) throw categoryError;

  const { data: catalogItem, error: catalogItemError } = await admin
    .from('catalog_items')
    .insert({ household_id: householdId, canonical_name: 'S-68 fixture item', category_id: category.id, base_unit: category.default_base_unit })
    .select('id')
    .single();
  if (catalogItemError || !catalogItem) throw catalogItemError;

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
    raw_text: 'S-68 fixture item',
    item_name: 'S-68 fixture item',
    category_slug: category.slug,
    qty_base: 1,
    matched_item_id: catalogItem.id,
    match_confidence: 0.9,
    review_state: 'matched',
  });
  if (lineError) throw lineError;

  await page.goto(`/review/${receipt.id}`);
  await expect(page.getByText('S-68 fixture item').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save & match' })).toHaveCount(0);

  await page.getByText('S-68 fixture item').first().click();
  await expect(page.getByRole('button', { name: 'Save & match' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark non-inventory' })).toBeVisible();

  await page.getByRole('button', { name: 'Mark non-inventory' }).click();
  await expect(page.getByText('1 non-inventory row(s) excluded.')).toBeVisible();

  await admin.from('receipts').delete().eq('id', receipt.id);
  await admin.from('catalog_items').delete().eq('id', catalogItem.id);
});
