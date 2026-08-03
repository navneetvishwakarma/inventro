import { test, expect } from './fixtures';

// S-71/E-22: Shopping list, Catalog manager, Settings, and Review queue
// had no entry in layout.tsx's TABBAR_ITEMS and no backHref on their
// MobileTopBar -- reachable only via inbound links, with no in-app way
// back except the OS back gesture. Parents chosen from real inbound
// links (grepped, not guessed): Shopping list, Settings, and Review queue
// are each linked only from Today ("/"); Catalog manager has three inbound
// sources (Today, Inventory, Settings) but Settings is the only one with a
// dedicated, purpose-built entry point ("Manage catalog" under a "Catalog"
// card), so that's its parent here.

const PAGES: Array<{ path: string; backHref: string }> = [
  { path: '/shopping-list', backHref: '/' },
  { path: '/settings', backHref: '/' },
  { path: '/review', backHref: '/' },
  { path: '/catalog', backHref: '/settings' },
];

for (const { path, backHref } of PAGES) {
  test(`Mobile back nav: ${path} has a working back action to ${backHref}`, async ({ page }) => {
    await page.goto(path);
    const back = page.getByRole('link', { name: 'Back' });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute('href', backHref);
    await back.click();
    await page.waitForURL((url) => url.pathname === backHref);
  });
}
