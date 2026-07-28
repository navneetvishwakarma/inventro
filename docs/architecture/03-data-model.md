---
doc: Data Model
project: PANTRY
status: approved
updated: 2026-07-28
---

# Data Model

> The entity set, the core architectural invariant (ledger, not counter), and
> how the prediction engine's state fits in.

## Context

This is the schema-level companion to ADR-0001 — read that ADR first for
*why* stock is derived rather than stored; this doc is the *what* of every
table and how they relate.

## Details

### Entities

| Entity | Purpose | Key fields |
|---|---|---|
| `households` | Tenant (single row in v1, ADR-0004) | id, name, currency, timezone, monthly_budget, `stock_epoch`, onboarded_at, is_demo |
| `categories` | 2-level taxonomy, system-seeded (16 top-level groups, [working spec](../00-working-spec.md) §6) | id, parent_id, name, slug, icon, default_base_unit, default_prior_days, is_system |
| `catalog_items` | Canonical item | id, household_id, canonical_name, brand, category_id, base_unit, default_pack_size, perishability_days, is_staple, is_archived |
| `item_aliases` | Every raw string ever seen -> canonical item | catalog_item_id, raw_text, normalized_text, source, confidence |
| `receipts` | Uploaded source document | id, household_id, storage_path(s), mime, merchant, purchased_at, `date_source`, total_amount, status, content_hash, external_order_id, parse_model, parse_path, parse_tokens, parse_cost |
| `receipt_lines` | Raw parsed rows, immutable | receipt_id, line_no, raw_text, qty_display, unit_display, qty_base, unit_price, line_total, is_non_inventory, matched_item_id, match_confidence, review_state |
| `stock_movements` | **The ledger** (ADR-0001) | household_id, catalog_item_id, type, qty_base, occurred_at, source_receipt_id, note |
| `item_stats` | Denormalized prediction state | catalog_item_id, purchase_count, ewma_interval_days, interval_mad, daily_rate_base, rate_correction, last_purchased_at, predicted_depletion_at, predicted_next_purchase_at, cadence_bucket, cadence_override, confidence, avg_unit_price_90d, updated_at |
| `item_stats_history` | Last 5 recomputes per item (debugging) | — |
| `plan_entries` | Generated running lists | household_id, catalog_item_id, cadence_bucket, suggested_qty_base, due_date, state, snoozed_until |
| `shopping_lists` / `shopping_list_items` | Materialized list for a run | — |
| `price_history` | Per item, per merchant | catalog_item_id, merchant, unit_price, observed_at |
| `ingest_jobs` | Async parse queue | receipt_id, state, attempts, error, model_used, `raw_response` |

### Core invariant

`stock_movements.type ∈ {purchase, consumption, adjustment, waste, initial}`.
Current stock = `SUM(qty_base)` over movements where
`occurred_at >= household.stock_epoch` (purchases/initial positive,
consumption/waste negative), exposed as a plain (non-materialized) Postgres
view `v_current_stock` (ADR-0001) — plain, not `MATERIALIZED VIEW`, because
A8 requires stock to reflect a consumption action immediately, with no refresh
step. Every table carries `household_id` (ADR-0004).

### Relationships that matter

- `receipt_lines.matched_item_id -> catalog_items.id` — set by canonicalization
  (REQ-09); null until matched or a new item is confirmed.
- `stock_movements.source_receipt_id -> receipts.id` — nullable, since
  shopping-list checkoffs (REQ-18) and manual consumption actions (REQ-14)
  create movements with no receipt behind them.
- `item_stats.catalog_item_id -> catalog_items.id`, one row per item,
  recomputed in place; history preserved separately in `item_stats_history`
  (last 5 only, by design — this is a debugging aid, not an audit log).
- `plan_entries` are generated, not authoritative — they're regenerated from
  `item_stats` + overrides on each planning cycle, so they can be safely
  truncated and rebuilt.

### Unit normalization (REQ-10)

Every `catalog_item` has `base_unit ∈ {g, ml, piece}`. Conversions happen at
write time: kg→g ×1000, l→ml ×1000, dozen→piece ×12, `pack of N`→piece ×N,
`2 × 500ml`→ml 1000. Ambiguous units default to piece/qty 1 and are flagged in
review (REQ-12). Both display values (`qty_display`, `unit_display`) and base
values (`qty_base`) are stored on `receipt_lines`, so the original document
text is always recoverable.

### Category taxonomy (REQ-11, seeded, 2 levels)

16 top-level groups (Groceries & Staples, Fresh, Dairy & Eggs, Bakery &
Breakfast, Beverages, Packaged & Instant, Snacks & Confectionery, Meat &
Seafood, Home Care, Personal Care, Baby & Kids, Health, Pet Supplies,
Utilities & Refills, Kitchen & Household Goods, Stationery & Misc), each with
seeded sub-categories and a `default_base_unit` + `default_prior_days` used as
the cold-start prior for the prediction engine (working spec §5, §6). The LLM
must select from this fixed enum — never invent a category.

## Open questions

- [ ] None blocking v1. If multi-tenancy lands, confirm no table besides
      `households` itself needs a schema change beyond enabling RLS — current
      expectation (ADR-0004) is that it doesn't.
- [ ] Reconciliation (REQ-15) runs "at each repurchase" (working spec §5/F9.3)
      by comparing projected vs. actual stock. Neither the PRD nor the working
      spec states whether reconciliation is skipped for a backdated commit
      (REQ-22, dated before `stock_epoch` or before a chronologically later
      purchase already on record) — a backdated repurchase risks correcting
      `rate_correction` off a projection built from an interval window that
      `v_current_stock` structurally excludes. Needs an explicit rule before
      REQ-15/REQ-22 are both implemented, not discovered at that intersection.
- [ ] `item_stats.daily_rate_base` is a named, stored field, but working spec
      §5 step 6 only ever computes `daily_rate` (already multiplied by
      `rate_correction`) — there's no formula for how `daily_rate_base` is
      derived or stored separately from the correction. §5 is a fixed
      contract per the working spec's own framing, so this needs resolving
      there, not guessed at in implementation.
