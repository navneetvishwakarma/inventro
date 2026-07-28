# Inventro

> Predicted, recurring grocery replenishment from a photographed receipt.

Inventro turns a photographed receipt, order screenshot, or order-confirmation
PDF into structured inventory in under 15 seconds, infers household
consumption without any manual "I used this" logging, and converts that into
cadence-bucketed running lists (daily → yearly) plus a rolling budget view —
so shopping shifts from reactive ("we're out of rice again") to planned.

v1 is a private, single-household tool: no signup, no multi-tenancy, gated
by a shared passcode rather than real authentication. See
[`docs/product/06-prd.md`](docs/product/06-prd.md) for the full scope and
non-goals.

## Status

Planning is complete and approved; the build hasn't started yet. Current
state: **0 of 36 stories done, 16 epics, on track** — see
[`PROGRESS_DASHBOARD.html`](PROGRESS_DASHBOARD.html) (regenerate with
`node scripts/build-dashboard.mjs`) for the live picture once work begins.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript |
| Hosting | Vercel (free/hobby tier), Vercel Cron for scheduled jobs |
| UI kit | Astryx (`@astryxdesign/core`), shadcn/ui fallback — decided Day 1 of the build, see [ADR-0002](docs/architecture/decisions/ADR-0002-ui-kit-astryx-vs-shadcn.md) |
| Client data cache | TanStack Query |
| Validation | Zod, at every boundary (LLM output, forms, API payloads) |
| Database | Supabase Postgres 15 + `pg_trgm` |
| File storage | Supabase Storage, private bucket, signed URLs (60s TTL) |
| LLM | Gemini Flash (primary), Gemini Pro (escalation) — see [ADR-0003](docs/architecture/decisions/ADR-0003-llm-provider-gemini-flash.md) |
| Email | Resend |
| Access control | Shared-passcode middleware gate (not real auth) — see [ADR-0004](docs/architecture/decisions/ADR-0004-single-household-tenancy-scaffold.md) |

Full detail and the reasoning behind each choice:
[`docs/architecture/02-tech-stack.md`](docs/architecture/02-tech-stack.md)
and [`docs/architecture/decisions/`](docs/architecture/decisions/).

## Documentation

This repo runs on the [Throughline workflow](AGENTS.md) — `docs/engineering/backlog.json`
is the single source of truth for what work exists, its order, and its
status. Start here:

- [`docs/00-working-spec.md`](docs/00-working-spec.md) — the original
  consolidated spec; source of truth for the prediction algorithm, domain
  model, LLM extraction contract, and acceptance tests.
- [`docs/product/06-prd.md`](docs/product/06-prd.md) — requirements
  (`REQ-01`..`REQ-27`), non-goals, success metrics.
- [`docs/architecture/`](docs/architecture/) — system overview, data model,
  API design, infrastructure, security, and ADRs.
- [`docs/engineering/01-tech-plan.md`](docs/engineering/01-tech-plan.md) —
  build phases, milestones, and risks.
- [`AGENTS.md`](AGENTS.md) — the machine-facing operating manual (also
  followed by `CLAUDE.md` and `GEMINI.md`).

## Working with the contract

```
node scripts/validate.mjs         # validate docs/engineering/backlog.json
node scripts/sync-status.mjs      # mirror GitHub issue state into the contract
node scripts/build-dashboard.mjs  # render PROGRESS_DASHBOARD.html
```

Application setup instructions (`pnpm install`, `pnpm dev`, environment
variables) will land here once the Day 1 scaffolding in
[`docs/engineering/01-tech-plan.md`](docs/engineering/01-tech-plan.md) is
built.

## License

MIT — see [LICENSE](LICENSE).
