# Manual test log

> Per-epic manual/E2E checks that aren't automated, appended by `define-epic`
> as each epic's issues are created. See `.claude/epic-<N>/test-plan.md` for
> the full unit/integration/manual breakdown behind each entry here.

## E-0: Foundation & platform scaffolding — [#5](https://github.com/navneetvishwakarma/inventro/issues/5)

- **S-01** [#6](https://github.com/navneetvishwakarma/inventro/issues/6) — deployed Vercel URL loads without error (smoke test).
- **S-02** [#7](https://github.com/navneetvishwakarma/inventro/issues/7) — spot-check ~15 seeded catalog items across categories against working spec §6's stated priors (milk ~2d, rice ~45d, detergent ~60d) to catch a systematically wrong seed before it biases every cold-start prediction.
- **S-03** [#8](https://github.com/navneetvishwakarma/inventro/issues/8) — grep the production build output for the Supabase anon key string (A26, shared with PRD REQ-26's acceptance).
- **Cross-story** — once all three land, confirm E-0's composite acceptance (schema + RLS-disabled + seed data + passcode gate) holds simultaneously on the same live deployment.
