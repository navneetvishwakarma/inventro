// vitest runs lib/**/*.test.ts under plain Node, not Next's client/server
// bundler split -- 'server-only''s real module throws unconditionally
// outside that split. Aliased in vitest.config.mts so importing a
// server-only-guarded module (e.g. lib/receipts/canonicalize.ts,
// lib/predictions/reconcile.ts) under test doesn't need this in every file.
export {};
