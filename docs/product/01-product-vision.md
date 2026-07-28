---
doc: Product Vision
project: Inventro
status: approved
updated: 2026-07-28
---

# Product Vision

> Move a household from reactive, ad-hoc grocery ordering to a predicted,
> recurring cadence — without asking the household to change how it shops.

## Context

Right now the household notices something ran out, then scrambles. There is no
standing view of what's about to run out, how fast it's actually being consumed,
or what "normal" recurring spend looks like versus a one-off purchase. Every
existing tool in this space (shopping-list apps, budgeting apps, the q-commerce
apps themselves) either requires manual list-keeping or only sees its own
merchant's slice of purchases — none of them see the whole household across
every store, infer consumption, or predict a reorder date.

## Details

Inventro ingests whatever the household already produces when it shops — a photo
of a paper receipt, a screenshot of a q-commerce order, an order-confirmation
PDF or email — and turns it into structured inventory in under 15 seconds. From
there, a prediction engine learns *what* the household consumes, *how fast*,
and *when it will run out*, entirely from purchase history plus a closed
feedback loop at each repurchase (REQ-15) — never from the user manually
logging "I used X." That prediction is surfaced as cadence-bucketed running
lists (daily → yearly) and a rolling budget/forward-spend view, so shopping
becomes "review this week's 14-item list, ~₹2,340" instead of "what did we run
out of again."

**Explicit non-goal:** this is not an ordering system. It never talks to a
retailer or places a real order — the output is a list a person acts on.

v1 is a private, single-household tool (no auth, no invites). Multi-tenancy is
a deliberate later phase once the prediction engine and capture pipeline are
proven against real use (see `docs/product/10-gtm-strategy.md`).

## Open questions

- [x] Deployment model for v1 — resolved: single-household, passcode-gated, `household_id` carried on every table from day one so multi-tenancy is a flag flip, not a rewrite.
