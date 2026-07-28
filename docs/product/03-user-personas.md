---
doc: User Personas
project: PANTRY
status: approved
updated: 2026-07-28
---

# User Personas

> Who this is built for in v1 — one household, but two usage modes within it.

## Context

v1 has exactly one tenant (the household), but the product still needs to
serve two distinct moments of use well: the person who does the shopping and
capture, and anyone in the household who just wants a quick answer to "do we
need anything."

## Details

### Persona 1 — The Restocker (primary)

The household member who actually places orders and does the shopping — on
q-commerce apps, at the local store, or both. They are the one holding a phone
with a receipt or an order screen right after a purchase.

- **Goals:** capture a purchase in seconds, not minutes; trust that the running
  list is accurate enough to shop straight off; see a believable running total
  before checkout so spend doesn't creep.
- **Pain today:** re-deriving "did we already restock detergent" from memory;
  screenshots of orders piling up in the camera roll with no structure;
  forgetting quarterly/half-yearly items entirely because they're too
  infrequent to remember.
- **Primary screens:** Add (capture), Review, Plan, Shopping list.
- **Success looks like:** opens Plan on a Sunday, sees "14 items due, ~₹2,340,"
  and shops off that list with no further thinking.

### Persona 2 — The Glancer (secondary)

Any other household member who wants a fast read on status without doing any
capture work themselves — "are we out of milk," "did someone already order
gas," "what's the budget looking like this month."

- **Goals:** a Today view that's accurate without them lifting a finger; the
  confidence that whatever the Restocker entered is reflected immediately.
- **Pain today:** no visibility into what's already been ordered vs. still
  needed; budget conversations happen from memory, not data.
- **Primary screens:** Today, Inventory, Insights.
- **Success looks like:** a 5-second glance at Today answers "do we need
  anything" without opening any other app.

### Explicitly not a persona in v1

A second *household* (a different family, a roommate group with separate
budgets). Multi-tenancy, invites, and per-member spend attribution are deferred
(see `docs/product/10-gtm-strategy.md` and the [working spec](../00-working-spec.md) §15).

## Open questions

- [ ] Once multi-tenant, does "Glancer vs. Restocker" become a permission model (view vs. capture) or stay purely a usage-pattern distinction with no access control? Deferred to the multi-tenant phase.
