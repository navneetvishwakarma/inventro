import { test, expect } from './fixtures';

// REQ-30: design fidelity remediation vs design/screens/*.html. Each test
// asserts a specific, previously-audited mismatch is fixed.

test('Plan: "Always exclude" uses the ghost button variant, not destructive (S-51)', async ({ page }) => {
  await page.goto('/plan');
  const button = page.getByRole('button', { name: 'Always exclude' }).first();
  const count = await button.count();
  test.skip(count === 0, 'No pending-bucket item in the seeded household to show this action');
  await expect(button).toHaveClass(/bg-transparent/);
  await expect(button).not.toHaveClass(/bg-error-subtle/);
});

test('Settings: Save button spans the full card width (S-52)', async ({ page }) => {
  await page.goto('/settings');
  const save = page.getByRole('button', { name: 'Save' });
  // Full-width means the button's own box is close to its immediate
  // parent's content width, not shrunk to fit its text.
  const { buttonWidth, parentWidth } = await save.evaluate((el) => {
    const parent = el.parentElement!;
    return { buttonWidth: el.getBoundingClientRect().width, parentWidth: parent.getBoundingClientRect().width };
  });
  expect(buttonWidth).toBeGreaterThan(parentWidth * 0.85);
});

test('Inventory: filter bar renders unwrapped, no duplicate title card (S-50)', async ({ page }) => {
  await page.goto('/inventory');
  // MobileTopBar already renders "Inventory" once -- the filter section
  // must not repeat it inside its own CardTitle (design/screens/08-
  // inventory-list.html's FilterBarWeb/FilterTriggerMobile render
  // unwrapped, no title, no card). CardTitle always carries
  // data-slot="card-title" (components/ui/card.tsx) -- a stable selector
  // that doesn't collide with the Sidebar/TabBar/MobileTopBar's own
  // "Inventory" text.
  await expect(page.locator('[data-slot="card-title"]', { hasText: 'Inventory' })).toHaveCount(0);
});

test('Inventory: out-of-stock rows show an "Out of stock" badge, not a blank sparkline (S-50)', async ({ page }) => {
  await page.goto('/inventory');
  // CardTitle renders a <div>, not a semantic heading -- data-slot is the
  // reliable selector (same pattern as the duplicate-title test above).
  const hasSection = (await page.locator('[data-slot="card-title"]', { hasText: 'Out of stock' }).count()) > 0;
  test.skip(!hasSection, 'No out-of-stock items in the seeded household');
  const badge = page.locator('[data-slot="badge"]', { hasText: 'Out of stock' });
  await expect(badge.first()).toBeVisible();
});

test('Review queue (mobile): merchant name is plain dark text, not link-blue (S-53)', async ({ page }) => {
  await page.goto('/review');
  // The desktop table's equivalent link (text-link) is also in the DOM,
  // hidden via CSS at this mobile viewport -- .last() is the visible
  // TableRowMobile version (same DOM-order pattern as routes.spec.ts).
  const merchant = page.getByText('Unknown merchant').last();
  const count = await merchant.count();
  test.skip(count === 0, 'No unresolved-merchant receipts in the seeded household');
  await expect(merchant).toHaveClass(/text-foreground/);
});
