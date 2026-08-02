import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.local' });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Single worker against a single shared dev-server instance -- parallel
  // workers cold-hitting different not-yet-compiled Turbopack routes
  // simultaneously produced a transient 404 during this story's own
  // verification (see epic-17 ledger).
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    // Mobile-first PWA: MobileTopBar (the page-title source of truth used
    // by these specs) only renders below the `lg` breakpoint, and the
    // primary real-world usage is a phone. Testing at a mobile viewport
    // avoids asserting on chrome that's deliberately hidden at desktop
    // width. iPhone 13's device descriptor defaults to WebKit, which isn't
    // installed here -- keep its viewport/UA, force Chromium explicitly
    // (only Chromium's browser binary is installed in this environment).
    ...devices['iPhone 13'],
    browserName: 'chromium',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
