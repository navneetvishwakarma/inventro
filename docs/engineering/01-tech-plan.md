---
doc: tech-plan
project: Inventro
status: approved
updated: 2026-07-28
---

# Inventro — Technical Plan

> The narrative layer above the backlog: how the build is sequenced. The
> machine-readable version of this lives in `docs/engineering/backlog.json`
> (epics E-0..E-15, stories S-01..S-36).

## Build phases

| Phase | Name | Goal | Gate |
|-------|------|------|------|
| D1 | Foundation & ingest | A receipt becomes inventory (E-0..E-4) | Upload a real receipt, review it, see items in inventory |
| D2 | Intelligence | Predictions and plans work (E-5..E-9) | Validation scorecard (§12) passes; manual overrides persist across recompute |
| D3 | Capture polish, trust, ship | Real-world capture reliability + everything else (E-10..E-15) | All §11 acceptance tests (A1–A26) pass on the production URL |

## Milestones

- **M1 — Day 1 gate** — schema + ledger + passcode gate + onboarding + capture→parse→review→commit loop working end to end (E-0 through E-4).
- **M2 — Day 2 gate** — `computeItemStats` tuned against the synthetic validation scorecard (E-5, E-6); Inventory, Plan, and Shopping List screens live (E-7, E-8, E-9).
- **M3 — Ship gate** — capture polish against real q-commerce screenshots/PDFs, budget/insights, catalog manager, notifications, cost controls, PWA, and the full security pass (E-10 through E-15).

## Sequencing notes

The ledger (S-02), the canonicalization matcher (S-09), and `computeItemStats`
(S-14) are the load-bearing pieces — every other screen is presentation over a
correct core, so they're built and tested before any screen beyond Review.

**Critical path:** S-01 → S-02 → S-06 → S-09/S-10/S-11 → S-12 → S-13 → S-14 →
S-18 (validation gate) → S-21 (Plan screen). Everything in E-10 through E-15
can proceed in parallel once S-06 (capture pipeline) and S-21 (Plan screen)
exist, since capture-format variants and downstream screens (Insights,
Notifications, Settings) don't block each other.

**Astryx spike is a Day 1, hour-1 decision, not a backlog item** — it's a
go/no-go on the UI kit itself (see ADR-0002), made before S-04 onward are built
against it, with shadcn/ui as the pre-agreed fallback if StyleX/Next 15
friction shows up by hour 2.

**Longest pole:** S-18 (validation scorecard tuning) has no fixed duration —
it's tune-until-it-passes against the §12 cohorts, not a fixed-size task. If
S3 doesn't clear 70% by the end of Day 2, the response is to keep tuning
constants (α, shrinkage, MAD threshold, hysteresis margin), not to change
product scope.

**External dependencies:** Gemini API (Flash + Pro tiers), Supabase
(Postgres + Storage + Cron), Resend (email), Vercel (hosting + cron trigger).
All on free/hobby tiers except the Gemini paid tier (required for the
no-training-on-input guarantee, see ADR-0003).

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Astryx is beta — API churn, thin docs, StyleX/Next 15 interop | High | 45-minute spike on one real page at hour 1 of Day 1; shadcn/ui fallback decided by hour 2, not Day 3 (ADR-0002) |
| Screenshot extraction accuracy (dominant real-world capture format) | High | Escalation ladder (Flash→Pro), mandatory review queue, "flag bad parse" affordance with raw response retained |
| Thin real purchase history at launch — S3 unmeasurable against real data | Medium | Synthetic validation harness (E-6) carries engine validation pre-launch; real-data S3 check added post-launch (see `docs/product/07-success-metrics.md`) |
| Shared passcode is not real authentication | Medium | Explicitly scoped to grocery data only (REQ-26); RLS shipped disabled but ready for the multi-tenant phase |
| 3-day scope creep | Medium | `docs/product/06-prd.md` non-goals + working-spec §15 deferred list are a contract, not a suggestion |
| `backlog.json` story/epic `estimate` fields sum to ~11.15 / ~9.5 against the 3-day window, and the two totals don't reconcile with each other; `backlog.schema.json` (shared, project-agnostic) leaves the unit as "days or points" | Low | This narrative day-by-day plan and the D1/D2/D3 gates above are what's authoritative for sequencing and scope for Inventro — do not treat a sum over the `estimate` field as a time budget until the unit is declared and the two totals reconciled |
