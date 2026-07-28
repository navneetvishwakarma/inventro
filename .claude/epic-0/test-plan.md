# Epic E-0 — Foundation & platform scaffolding — test plan

> Per-story tests verifying each acceptance criterion in `sub-S-*.json`.
> E-0 is `vertical: false` (enabler epic) — none of its stories are directly
> demoable to a user, so there's no E2E product-flow test here, only
> infra/schema verification and the one acceptance test (A26) it owns.

## S-01 — Repo, Next.js 15 + App Router wiring, Vercel deploy

- **Unit:** none — this story is infra wiring, no business logic to unit test yet.
- **Integration:** `next build` succeeds with zero errors/warnings that would block a production build.
- **Manual/E2E:** the deployed Vercel URL loads without error (smoke test — any response, even a placeholder page, confirms the deploy pipeline works end to end).

## S-02 — Full DB schema + RLS written-but-disabled + seed data

- **Unit:** fixture test against `v_current_stock` — seed a `stock_movements` fixture spanning multiple types (`purchase`, `consumption`, `adjustment`, `waste`, `initial`) with `occurred_at` values both before and after a household's `stock_epoch`; assert the view's sum excludes every pre-epoch movement and correctly nets positive/negative types (this is the acceptance criterion itself, made concrete).
- **Integration:**
  - Migration applies cleanly on a fresh Supabase instance with zero errors.
  - RLS is present but disabled: query `pg_class.relrowsecurity` (or Supabase's equivalent) for every table added in this migration and assert `false` — policies exist in the migration file but are not active.
  - `pg_trgm` extension is enabled and queryable (`SELECT similarity('a','a')` or equivalent doesn't error).
- **Manual/E2E:**
  - Seed script populates all 16 top-level categories + sub-categories with `default_base_unit` and `default_prior_days` set on every leaf.
  - Spot-check ~15 seeded catalog items across different categories (a staple like rice, a perishable like milk, a household item like detergent) against working spec Sec6's stated priors (e.g. milk ~2 days, rice ~45 days, detergent ~60 days) to catch a systematically wrong seed before it silently biases every cold-start prediction.

## S-03 — Passcode gate middleware

- **Unit:** none — middleware logic is thin enough to be fully covered by the integration cases below; a dedicated unit layer would just re-test the same three branches.
- **Integration:**
  - Request without any gate cookie → `401`.
  - Request with a valid signed gate cookie → passes through to the app.
  - Request with a tampered/invalid-signature cookie → `401` (not just "missing cookie" — this is the case that actually proves the cookie is signed, not just present).
  - This integration suite **is** acceptance test A26's core assertion — no separate test needed beyond it.
- **Manual/E2E:** grep the production build output for the Supabase anon key string — confirms no client-side secret leakage (the other half of A26, shared with PRD REQ-26's acceptance; verify once the whole epic, including S-01's env scaffolding, is deployed together).

## Cross-story check (epic-level, not story-level)

Once all three stories land: `E-0`'s own acceptance — "Deployed skeleton with full schema, RLS written-but-disabled, seed data, and passcode gate live on the production URL" — is a composite of S-01 + S-02 + S-03's individual acceptances landing together on the same deployed URL. No new test beyond confirming all three hold simultaneously against the same live deployment.
