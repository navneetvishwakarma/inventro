---
doc: adr
project: Inventro
status: accepted
updated: 2026-07-28
story: "S-02"
---

# ADR-0001: Stock is a derived value over an append-only ledger, not a mutable counter

## Status

Accepted.

## Context

The product's core mechanism (implicit depletion + repurchase reconciliation,
PRD REQ-14/REQ-15) requires comparing *projected* stock against *actual* stock
at every repurchase, correcting a per-item consumption rate, and supporting
corrections, waste write-offs, and backdated historical receipts — all without
corrupting whatever the user currently sees as "what's on the shelf." A single
mutable `current_stock` integer on `catalog_items` cannot support any of this:
there's no way to distinguish a purchase from a correction after the fact, no
audit trail if a stat looks wrong, and no way to backdate a receipt without the
write silently corrupting today's number.

## Decision

Stock is never stored directly. `stock_movements` is an append-only ledger
(`type ∈ {purchase, consumption, adjustment, waste, initial}`), and current
stock is `SUM(qty_base)` over movements where `occurred_at >= household.stock_epoch`
(purchases/initial positive, consumption/waste negative), exposed as a plain
(non-materialized) Postgres view `v_current_stock` — plain, not
`MATERIALIZED VIEW`, so a consumption action or commit is reflected on the
very next read with no refresh step (A8: marking an item "used it up" must
show stock at 0 immediately). `stock_epoch` is the
household's "current inventory starts counting from here" marker, set once at
onboarding — receipts dated before it feed frequency statistics only, never
current stock.

## Options Considered

### Option A: Append-only ledger + derived view (chosen)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — one extra join/aggregation per read, `stock_epoch` semantics must be taught once |
| Cost | Negligible — a Postgres view, no extra infra |
| Scalability | High — trivial to add movement types later (e.g. transfer, return) |
| Team familiarity | Standard event-sourcing-lite pattern |

**Pros:** full audit trail; corrections and backdating are just more rows;
reconciliation (REQ-15) is a natural query over the ledger; multi-tenant
migration later needs no schema change to this table beyond enabling RLS.
**Cons:** every stock read is an aggregation, not a field lookup — acceptable
at single-household write volume, and deliberately not offset by materializing
the view, since a materialized view would need an explicit refresh trigger and
would reintroduce read staleness after a write; a bad `occurred_at` on a
movement silently skews stock until `stock_epoch` is understood (mitigated by
REQ-12's mandatory-date review step).

### Option B: Mutable `current_stock` field, updated in place

**Pros:** trivial reads (single field).
**Cons:** no audit trail — cannot tell whether a stock number is right without
re-deriving it from history anyway; backdating a historical receipt requires
manual, error-prone reverse-calculation of what the field "should" be; directly
caused the failure mode this ADR exists to prevent — summing every purchase
ever made (e.g. 340 kg of rice from lifetime history) with no way to draw a
line at "current."

## Trade-off Analysis

The mutable-counter approach is faster to read but structurally cannot support
backdating (REQ-22) or reconciliation (REQ-15) without a parallel ledger
anyway — at which point it's strictly worse than just making the ledger
authoritative. The `stock_epoch` cutoff is the one piece of complexity Option A
adds, and it is deliberately a single household-level timestamp, not a
per-item setting, to keep it simple to reason about.

## Consequences

- All stock reads go through `v_current_stock`, never a raw sum without the
  `stock_epoch` filter — this must be enforced in code review, since Postgres
  won't catch a hand-rolled query that forgets the filter.
- `item_stats_history` and reconciliation logic (ADR-linked story S-15) both
  read the same ledger, so there's one source of truth for "what happened."
- Revisit if movement volume ever makes the aggregation too slow for p95
  targets (§13) — not expected at single-household scale ([working spec](../../00-working-spec.md) §13).

## Alternatives considered

- **Mutable current_stock field** — rejected, see Option B above; this is the
  exact failure mode (backdated receipts corrupting current inventory) that
  motivated `stock_epoch` in the first place.
- **Per-item stock_epoch instead of household-level** — rejected as
  over-engineered for v1; a single household onboards once, at one point in
  time.
