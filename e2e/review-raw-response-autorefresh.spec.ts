import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// S-103: FailedCard had access to ingest_jobs.raw_response but never
// rendered it, despite the review-commit journey doc calling for a "flag
// this parse as bad" affordance with the raw response visible. Separately,
// ProcessingCard had no polling, so a completed extraction only appeared
// after a manual reload.

const TEST_PASSWORD = 'E2eTestPassword123!';

function uniqueTestEmail(tag: string): string {
  return `e2e-review-raw-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

test('review detail: a failed extraction exposes the raw LLM response behind a disclosure', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'raw');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: receipt, error: receiptError } = await admin
    .from('receipts')
    .insert({ household_id: householdId, status: 'pending', storage_paths: [], purchased_at: null, purchased_at_confirmed: false })
    .select('id')
    .single();
  if (receiptError || !receipt) throw receiptError;

  const rawText = 'S-103 FIXTURE RAW MODEL OUTPUT: {malformed json here}';
  const { error: jobError } = await admin.from('ingest_jobs').insert({
    household_id: householdId,
    receipt_id: receipt.id,
    state: 'failed',
    error: 'schema validation failed: test fixture',
    raw_response: { text: rawText },
  });
  if (jobError) throw jobError;

  await page.goto(`/review/${receipt.id}`);
  await expect(page.getByText('Extraction failed')).toBeVisible();

  const disclosure = page.getByText('View raw response');
  await expect(disclosure).toBeVisible();
  await expect(page.getByText(rawText)).not.toBeVisible();
  await disclosure.click();
  await expect(page.getByText(rawText)).toBeVisible();

  await admin.from('ingest_jobs').delete().eq('receipt_id', receipt.id);
  await admin.from('receipts').delete().eq('id', receipt.id);
});

test('review detail: a still-processing receipt auto-refreshes to the parsed state without a manual reload', async ({ page }) => {
  const email = await signUpAndOnboard(page, 'poll');
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin.from('categories').select('slug').not('parent_id', 'is', null).limit(1).single();
  if (categoryError || !category) throw categoryError;

  const { data: receipt, error: receiptError } = await admin
    .from('receipts')
    .insert({ household_id: householdId, status: 'pending', storage_paths: [], purchased_at: null, purchased_at_confirmed: false })
    .select('id')
    .single();
  if (receiptError || !receipt) throw receiptError;

  const { error: jobError } = await admin.from('ingest_jobs').insert({ household_id: householdId, receipt_id: receipt.id, state: 'processing' });
  if (jobError) throw jobError;

  await page.goto(`/review/${receipt.id}`);
  await expect(page.getByText('Still parsing')).toBeVisible();

  // Simulate the extraction completing mid-poll, exactly like a real
  // background job would -- no page action from the test, no reload.
  const { error: updateJobError } = await admin.from('ingest_jobs').update({ state: 'done' }).eq('receipt_id', receipt.id);
  if (updateJobError) throw updateJobError;
  const { error: updateReceiptError } = await admin.from('receipts').update({ status: 'parsed' }).eq('id', receipt.id);
  if (updateReceiptError) throw updateReceiptError;
  const { error: lineError } = await admin.from('receipt_lines').insert({
    household_id: householdId,
    receipt_id: receipt.id,
    line_no: 1,
    raw_text: 'S-103 autorefresh fixture item',
    item_name: 'S-103 autorefresh fixture item',
    category_slug: category.slug,
    review_state: 'needs_review',
  });
  if (lineError) throw lineError;

  // 4s poll interval -- wide margin for real request latency under load
  // (several real cycles' worth), no reload/goto anywhere in this test.
  await expect(page.getByText('Still parsing')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText('S-103 autorefresh fixture item')).toBeVisible();

  await admin.from('ingest_jobs').delete().eq('receipt_id', receipt.id);
  await admin.from('receipts').delete().eq('id', receipt.id);
});
