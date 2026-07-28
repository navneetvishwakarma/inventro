---
doc: Riskiest Assumption Validation
project: PANTRY
status: approved
updated: 2026-07-28
---

# PANTRY — Riskiest Assumption Validation

## Assumption under test

The prediction engine (§5 of the [working spec](../00-working-spec.md) / `computeItemStats`) can hit
**±25% interval accuracy after 4 purchases, for ≥70% of items** (success
criterion S3), despite having almost no real purchase history at launch.

## Why a live spike doesn't work here

A live spike (asking a few users to log purchases for two weeks) can't produce
4+ purchase cycles for slow-moving items (rice, detergent, quarterly items) in
any reasonable timeframe, and this is a single-household v1 with no user pool to
spike against. The cheapest decisive test is therefore synthetic: generate
purchase histories with **known ground-truth intervals** and score the engine
against them before it ever touches a real receipt.

## Test design

`pnpm seed:history` (gated `ENABLE_SEED=true`, `is_demo` household only) generates
12 months of history across ~70 catalog items in 7 cohorts designed to stress
every part of the algorithm: clean periodic, high-variance, outlier-injected,
drifting intervals, cold-start (1–3 purchases), perishable-with-implausible-rate,
and quantity-inconsistent. `pnpm validate:predictions` scores predicted vs.
ground-truth interval per cohort and prints a pass/fail scorecard (full design:
working spec §12).

## Decision

**Proceed.** This is treated as a Day 2 build-time gate, not a pre-build spike —
`computeItemStats` is written as a pure, unit-testable function specifically so
it can be tuned (α, shrinkage constant, MAD threshold, hysteresis margin) against
the scorecard with evidence before any UI is built on top of it. If the overall
S3 scorecard (n≥4 cohort) fails to clear 70%, the response is to retune the
constants in §5, not to change scope — the algorithm shape (EWMA + shrinkage +
rate cross-check + reconciliation) is the product's core bet and is not up for
revision at this stage.

## Outcome tracking

Recorded once Day 2 tuning completes: actual scorecard numbers to be pasted into
this file and cross-linked from `docs/product/07-success-metrics.md`.
