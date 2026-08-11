import { test, expect } from '@playwright/test';

// S-100: docs/design/tokens.md (G3-approved 2026-08-03) specified v2
// values for --background, --surface-sunken, --border, --border-strong,
// --shadow-sm, and --shadow-md, in both light and dark -- app/globals.css
// still carried the v1 values for all of these until this story. Asserts
// the actual computed custom-property values on the live page, not just
// that the CSS file's text changed, as a regression guard against a
// future revert or a merge that silently reintroduces the v1 hex values.

// Browsers normalize hex colors to rgb() in getComputedStyle -- these are
// the exact v2 hex values from tokens.md's table.
const LIGHT_BACKGROUND = 'rgb(241, 232, 228)'; // #F1E8E4
const DARK_BACKGROUND = 'rgb(23, 16, 14)'; // #17100E

test('design tokens v2: light theme custom properties match the approved values', async ({ page }) => {
  await page.goto('/login');
  const values = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      background: style.getPropertyValue('--background').trim(),
      surfaceSunken: style.getPropertyValue('--surface-sunken').trim(),
      border: style.getPropertyValue('--border').trim(),
      borderStrong: style.getPropertyValue('--border-strong').trim(),
    };
  });
  expect(values.background.toUpperCase()).toBe('#F1E8E4');
  expect(values.surfaceSunken.toUpperCase()).toBe('#F5EDEA');
  expect(values.border.toUpperCase()).toBe('#E4D5D0');
  expect(values.borderStrong.toUpperCase()).toBe('#D2BDB6');

  // The value actually painted, not just the raw custom property -- proves
  // --color-background's @theme inline indirection resolves through.
  await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BACKGROUND);
});

test('design tokens v2: dark theme background and shadow formula are distinct from light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/login');
  const values = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      background: style.getPropertyValue('--background').trim(),
      shadowSm: style.getPropertyValue('--shadow-sm').trim(),
    };
  });
  expect(values.background.toUpperCase()).toBe('#17100E');
  // Chromium normalizes computed-style rgba() custom properties to
  // 8-digit hex (#000000 + alpha) rather than echoing rgba() back --
  // dark's shadow-sm is a flat black falloff, not the light theme's
  // warm-tinted #3c1814-based formula.
  expect(values.shadowSm.toLowerCase()).toContain('#000000');
  expect(values.shadowSm.toLowerCase()).not.toContain('#3c1814');

  await expect(page.locator('body')).toHaveCSS('background-color', DARK_BACKGROUND);
});

test('design tokens v2: light theme shadow-sm uses the new warm-tinted formula', async ({ page }) => {
  await page.goto('/login');
  const shadowSm = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--shadow-sm').trim());
  expect(shadowSm.toLowerCase()).toContain('#3c1814');
});
