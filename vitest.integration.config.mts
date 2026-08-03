// S-47: seeded-DB integration harness -- deliberately a SEPARATE config
// from vitest.config.mts (whose `include: lib/**/*.test.ts` is the fast,
// offline, zero-network suite `npm test` runs on every push). These tests
// need real Supabase credentials and a live network round trip, so they
// get their own command (`npm run test:integration`) rather than slowing
// or risking the default suite with network flakiness.
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
      'server-only': path.resolve(import.meta.dirname, 'test/stubs/server-only.ts'),
    },
  },
});
