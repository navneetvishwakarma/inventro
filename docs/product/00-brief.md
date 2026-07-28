---
doc: Product Brief
project: PANTRY
status: approved
updated: 2026-07-28
---

# PANTRY — Product Brief

> One-page framing. Full detail lives in `docs/product/06-prd.md`.

## Problem

Households buying groceries and household supplies order reactively and ad hoc —
they notice something ran out, then scramble. There's no standing view of what's
about to run out, how fast things are actually consumed, or what a "normal" month
of recurring spend looks like. The result is stockouts, forgotten staples, and no
real budget visibility into recurring vs. one-off spend.

## Target user

One household (the builder's own), tracking groceries, household supplies, and
personal-care items bought across offline stores and q-commerce apps (receipts,
screenshots, order-confirmation emails/PDFs).

**Not for:** multiple households, teams, or shared/collaborative lists (deferred);
anyone wanting the app to *place* orders (explicit non-goal, see below).

## Core bet

If the system can turn a photographed receipt or app screenshot into structured
inventory in under 15 seconds, and infer consumption **without requiring the user
to log anything**, then it can predict — per item — when the household will run
out and convert that into a standing, cadence-bucketed shopping list the household
actually trusts and acts on.

The single hypothesis that must hold: **implicit depletion + repurchase
reconciliation** (project consumption from a rate, then correct that rate every
time the item is rebought) is sufficient to keep predictions accurate over time,
even with zero explicit "I used this" logging from the user.

## Scope boundary

**It is:** capture (photo/PDF/paste/manual) → parsed & canonicalized inventory →
a per-item prediction engine → cadence-bucketed running lists → a rolling budget
view.

**Explicit non-goals:** placing real orders with retailers, barcode scanning,
expiry-date-per-unit tracking, recipe/meal planning, multi-tenancy & real auth,
shared real-time list editing, native app, offline sync, bulk historical import
(CSV/mbox) — history is backfilled one receipt at a time through the same capture
flow.

## Riskiest assumption

That the prediction engine (EWMA over purchase intervals + shrinkage-to-prior +
rate-based cross-check + repurchase reconciliation, §5 of the [working spec](../00-working-spec.md)) can
hit **±25% interval accuracy after 4 purchases for ≥70% of items** — while real
purchase history at launch is close to zero, so there's nothing to validate
against yet.

**Decision: validate now, but via a synthetic seeder rather than a live spike.**
Real usage data won't exist until weeks into use, so the algorithm can't wait for
it. `docs/product/00b-validation.md` and the seeder in §12 of the working spec
(`pnpm seed:history` / `pnpm validate:predictions`) generate 12 months of
ground-truth-labeled purchase history across clean, high-variance, outlier,
drifting, cold-start, perishable, and quantity-inconsistent cohorts, and score
the engine against a per-cohort accuracy target before it ever sees a real
receipt. This is treated as a build-time gate (Day 2 of the delivery plan), not
a pre-build spike — the fastest decisive test available is running the engine
against synthetic ground truth, not delaying the build to collect real data.

## Status

Approved — proceeding to full PRD (`docs/product/06-prd.md`).
