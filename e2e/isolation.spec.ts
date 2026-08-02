import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const TEST_PASSWORD = 'E2eTestPassword123!';

// S-66/E-21/REQ-32: the hard gate on the multi-tenant epic. Two real,
// independently signed-up households, each with a manually-entered item
// only they should ever see. Uses two separate browser contexts (not the
// shared authenticated fixture, which only carries one session) so both
// sessions exist simultaneously and neither leaks into the other's
// cookies. Every other e2e spec in this suite implicitly trusts RLS to
// isolate the single household it signs up as -- this is the one spec
// that actually proves isolation holds BETWEEN two households, both by
// list-view absence (the UI never shows it) and by direct-id-probe denial
// (the DB never returns it, not just "the UI happened not to render a
// link to it").

function uniqueTestEmail(tag: string): string {
  return `e2e-isolation-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
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

async function createManualItem(page: Page, itemName: string): Promise<void> {
  await page.goto('/add/manual');
  await page.getByLabel('Search item name').fill(itemName);
  await page.getByRole('button', { name: `Add "${itemName}" as a new item` }).click();
  await page.getByLabel('Category', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Create item & log purchase' }).click();
  await expect(page.getByText('Purchase logged')).toBeVisible();
}

function itemIdFromInventoryLink(href: string | null): string {
  if (!href) throw new Error('inventory item link has no href');
  const id = href.split('/inventory/')[1];
  if (!id) throw new Error(`could not parse item id from href: ${href}`);
  return id;
}

test('cross-household isolation: household A cannot see or reach household B\'s item, and vice versa', async ({ browser }) => {
  // Two full signup+onboarding+manual-entry cycles plus several
  // navigations, sequentially -- naturally heavier than every other spec
  // in this suite (each of which does at most one). The default 30s test
  // timeout is too tight for that combined workload, not a sign anything
  // here is actually slow.
  test.setTimeout(90_000);

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const itemNameA = 'zzz-isolation-item-A-' + Date.now();
  const itemNameB = 'zzz-isolation-item-B-' + Date.now();

  const emailA = await signUpAndOnboard(pageA, 'a');
  await createManualItem(pageA, itemNameA);

  const emailB = await signUpAndOnboard(pageB, 'b');
  await createManualItem(pageB, itemNameB);

  // Get each item's real id from its own household's inventory list.
  await pageA.goto('/inventory');
  const linkA = pageA.locator(`a[href^="/inventory/"]:has-text("${itemNameA}")`).first();
  const itemIdA = itemIdFromInventoryLink(await linkA.getAttribute('href'));

  await pageB.goto('/inventory');
  const linkB = pageB.locator(`a[href^="/inventory/"]:has-text("${itemNameB}")`).first();
  const itemIdB = itemIdFromInventoryLink(await linkB.getAttribute('href'));

  // List-view isolation: neither household's inventory list shows the
  // other's item.
  await expect(pageA.getByText(itemNameB)).toHaveCount(0);
  await expect(pageB.getByText(itemNameA)).toHaveCount(0);

  // Direct-id-probe denial: this is the assertion that actually
  // distinguishes "RLS enforces this" from "the UI happens to filter it"
  // -- household A navigating straight to household B's item detail URL
  // must be denied at the data layer (404, matching getInventoryItem's
  // "not found" == "not visible to me" behavior), not shown B's data.
  await pageA.goto(`/inventory/${itemIdB}`);
  await expect(pageA.getByText('Page not found')).toBeVisible();
  await expect(pageA.getByText(itemNameB)).toHaveCount(0);

  await pageB.goto(`/inventory/${itemIdA}`);
  await expect(pageB.getByText('Page not found')).toBeVisible();
  await expect(pageB.getByText(itemNameA)).toHaveCount(0);

  // Sanity check: each household CAN still reach its own item (proves the
  // 404 above is real isolation, not a broken route). .first() -- the item
  // name legitimately renders twice on its own detail page (MobileTopBar
  // title + the card's own title).
  await pageA.goto(`/inventory/${itemIdA}`);
  await expect(pageA.getByText(itemNameA).first()).toBeVisible();

  await pageB.goto(`/inventory/${itemIdB}`);
  await expect(pageB.getByText(itemNameB).first()).toBeVisible();

  // household_members table probe: this is the table RLS itself depends
  // on (every other table's policy resolves through it), so its own
  // lockdown gets a direct assertion rather than resting on the UI-level
  // isolation above. Two independent raw supabase-js clients (bypassing
  // the app entirely) sign in as A and B respectively and hit the table
  // straight -- this is what actually distinguishes "RLS enforces this"
  // from "the app's queries happen to always filter it."
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY must be set for the household_members probe');
  }

  const clientA = createClient(supabaseUrl, supabaseAnonKey);
  const { error: signInErrorA } = await clientA.auth.signInWithPassword({ email: emailA, password: TEST_PASSWORD });
  if (signInErrorA) throw signInErrorA;

  const clientB = createClient(supabaseUrl, supabaseAnonKey);
  const { error: signInErrorB } = await clientB.auth.signInWithPassword({ email: emailB, password: TEST_PASSWORD });
  if (signInErrorB) throw signInErrorB;

  const { data: rowsVisibleToA, error: selectErrorA } = await clientA.from('household_members').select('*');
  expect(selectErrorA).toBeNull();
  // Only A's own membership row, never B's or anyone else's.
  expect(rowsVisibleToA).toHaveLength(1);
  expect(rowsVisibleToA?.[0]?.user_id).toBe((await clientA.auth.getUser()).data.user?.id);

  const { data: userB } = await clientB.auth.getUser();
  const { data: memberRowB } = await clientB.from('household_members').select('household_id').single();
  const householdIdB = memberRowB?.household_id;

  const { data: userA } = await clientA.auth.getUser();
  const { error: crossInsertError } = await clientA
    .from('household_members')
    .insert({ household_id: householdIdB, user_id: userA.user?.id, role: 'owner' });
  // Denied at the data layer -- A cannot grant itself membership in B's household.
  expect(crossInsertError).not.toBeNull();

  expect(userB.user?.id).not.toBe(userA.user?.id);

  await contextA.close();
  await contextB.close();
});
