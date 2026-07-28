---
doc: UX Journey Map Overview
project: PANTRY
status: approved
updated: 2026-07-28
---

# PANTRY — UX Journey Maps

> User journeys only, no wireframes and no design system — that's a deliberate
> scope decision for this pass. Screens referenced below (§9 of the working
> spec) are: Onboarding, Today, Inventory, Add, Review, Plan, Shopping list,
> Insights, Settings.

## How to read these

Each journey follows: **Persona** (which of the two v1 personas, see
`docs/product/03-user-personas.md`) → **Trigger** (what starts this) →
**Steps** (user action / system response / what they're feeling) →
**Friction points the design must resolve** → **Success signal** (how we'd
know this journey worked) → **Edge cases** (tied back to the acceptance tests
in `docs/product/06-prd.md`).

## Journey index

| # | Journey | Primary persona | Key screens | PRD ties |
|---|---|---|---|---|
| 1 | First-run onboarding | Restocker | Onboarding | REQ-01 |
| 2 | Capturing a purchase | Restocker | Add | REQ-02–06, REQ-24 |
| 3 | Reviewing & committing a receipt | Restocker | Review | REQ-09–12 |
| 4 | Living with the ledger (consumption & reconciliation) | Restocker + Glancer | Inventory, Today | REQ-13–15 |
| 5 | Trusting the Plan (cadence & overrides) | Restocker | Plan, Today | REQ-16, REQ-17 |
| 6 | Shopping off the list | Restocker | Shopping list | REQ-18 |
| 7 | Checking the budget | Glancer | Insights | REQ-19 |
| 8 | Fixing the catalog | Restocker | Settings (catalog manager) | REQ-07, REQ-09 |
| 9 | Backfilling history | Restocker | Add (multi-file queue) | REQ-05, REQ-22 |

## Cross-cutting design principle

Every journey below is written against the product's core bet
(`docs/product/02-product-thesis.md`): the Restocker should never feel like
they're "doing data entry for an app." Capture should feel like a receipt
disappearing into a drawer, not a form to fill out — friction there is the
single biggest risk to adoption (see Day 3 gate in `docs/engineering/01-tech-plan.md`).
