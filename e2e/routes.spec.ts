import { test, expect } from './fixtures';

// Every static route from this backlog's shipped epics (E-0..E-16). The two
// [id] routes are reached by clicking a real link from their list page
// instead of a hardcoded id, so this suite has zero direct DB dependency.
const STATIC_ROUTES: { path: string; text: string }[] = [
  { path: '/', text: 'Today' },
  { path: '/add', text: 'Add' },
  { path: '/add/manual', text: 'Add manually' },
  { path: '/catalog', text: 'Catalog manager' },
  { path: '/insights', text: 'Spend vs. budget' },
  { path: '/inventory', text: 'Inventory' },
  { path: '/plan', text: 'Plan' },
  { path: '/review', text: 'Review queue' },
  { path: '/settings', text: 'Household' },
  { path: '/shopping-list', text: 'Generate a shopping list' },
];

for (const { path, text } of STATIC_ROUTES) {
  test(`${path} returns 200 and renders its page identity`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    // The same text can appear up to three times (desktop-only Sidebar
    // link, MobileTopBar title, TabBar label) -- at this suite's mobile
    // viewport the Sidebar copy is hidden and renders first in the DOM, so
    // `.last()` is the one guaranteed visible.
    await expect(page.getByText(text, { exact: true }).last()).toBeVisible();
  });
}

test('/inventory/[id] is reachable from the inventory list and renders', async ({ page }) => {
  await page.goto('/inventory');
  const firstItemLink = page.locator('a[href^="/inventory/"]').first();
  const count = await firstItemLink.count();
  test.skip(count === 0, 'No inventory items in the seeded household to navigate to');
  await firstItemLink.click();
  await expect(page).toHaveURL(/\/inventory\/[^/]+$/);
});

test('/review/[id] is reachable from the review queue and renders', async ({ page }) => {
  await page.goto('/review');
  // review-detail.tsx also links to /review/[id] from a "past order"
  // banner that isn't always rendered visibly -- `.last()` is the main
  // queue-list link, which always is.
  const firstReceiptLink = page.locator('a[href^="/review/"]').last();
  const count = await firstReceiptLink.count();
  test.skip(count === 0, 'No pending receipts in the seeded household to navigate to');
  await firstReceiptLink.click();
  await expect(page).toHaveURL(/\/review\/[^/]+$/);
});

// One read-only happy-path interaction per section -- accessible
// roles/names only, so these survive REQ-29's visual redesign. Nothing
// here writes to the database (no checkoffs, no commits, no purchases).

test('Plan: clicking a bucket tab changes the active tab', async ({ page }) => {
  await page.goto('/plan');
  // Scoped to the Tabs component's own role="group" wrapper (tabs.tsx) --
  // an unscoped name regex over the whole page can pick up unrelated
  // buttons whose accessible name happens to contain the same words.
  const tabs = page.getByRole('group').getByRole('button');
  const tabCount = await tabs.count();
  test.skip(tabCount < 2, 'Not enough bucket tabs to test switching');
  await tabs.nth(1).click();
  // PlanBucketTabs navigates via router.push to /plan?bucket=... (a
  // searchParams-driven server re-render, not a client-only state flip) --
  // wait for that navigation before re-checking, and re-query `tabs` (lazy,
  // re-evaluates against the post-navigation DOM) rather than trusting a
  // captured text label, since the accessible name computed for
  // getByRole's `name` match collapses whitespace differently than
  // Element.textContent does for this component's adjacent label/count spans.
  await page.waitForURL(/\/plan\?bucket=/);
  await expect(tabs.nth(1)).toHaveAttribute('aria-pressed', 'true');
});

test('Catalog: search input accepts and retains typed text', async ({ page }) => {
  await page.goto('/catalog');
  const search = page.getByPlaceholder('Search catalog…');
  await search.fill('zzz-no-such-item-zzz');
  await expect(search).toHaveValue('zzz-no-such-item-zzz');
});
