---
doc: API Design
project: PANTRY
status: approved
updated: 2026-07-28
---

# API Design

> There is no public REST/GraphQL API in v1 — this documents the Server
> Action / Route Handler boundary and the one external-facing contract that
> matters: the LLM extraction schema.

## Context

Next.js Server Actions cover mutations and server components cover reads, so
"API design" here means: what are the server-side entry points, what do they
accept/return, and where does untrusted input (an LLM response, an uploaded
file) get validated before it touches the database.

## Details

### Server Actions (mutations)

| Action | Input | Effect | Notes |
|---|---|---|---|
| `createReceiptUpload` | file(s), capture mode (single/multi-image-group/paste) | Uploads to Storage, creates `receipts` + `ingest_jobs` row(s) | Multi-image grouping (REQ-03) bundles 2–3 pages into one job, not one job per image |
| `commitReceipt` | receipt id, edited/confirmed `receipt_lines`, purchase date | Writes `stock_movements` (type=purchase), `price_history`, upserts `item_aliases`; triggers stats recompute for affected items | Blocked if purchase date is unset (REQ-12); blocked on unresolved low-confidence lines |
| `logConsumption` | catalog_item_id, action (used_up / used_some / wasted), amount | Writes a `stock_movements` row (type=consumption or waste) | Never touches `daily_rate_base` directly — that's recomputed, not set (REQ-14) |
| `mergeCatalogItems` | survivor id, duplicate id(s) | Reassigns `item_aliases` and `stock_movements` to survivor, archives duplicate, triggers recompute | REQ-09; must be transactional — no partial reassignment |
| `overrideCadence` | catalog_item_id, bucket or "revert to auto" | Sets/clears `item_stats.cadence_override` | Recompute must respect the override (A9) rather than clobber it |
| `checkOffShoppingListItem` | list_item id, optional price | Optionally writes a purchase movement + price_history row | REQ-18 — the no-receipt path back into the ledger |
| `updateHouseholdSettings` | currency, budget, timezone, etc. | Updates `households` row | Single row in v1 (ADR-0004) |

### Route Handlers (webhooks / cron / async workers)

| Route | Trigger | Effect |
|---|---|---|
| `POST /api/ingest/process` | Enqueued by `createReceiptUpload`, invoked by the ingest worker | Runs the extraction pipeline (native-text fast path → Flash → Pro escalation → manual fallback) for one `ingest_jobs` row; writes `receipt_lines`, never writes `stock_movements` directly. On manual-entry fallback, the raw model response is retained in `ingest_jobs.raw_response` (REQ-24) for the "flag this parse as bad" affordance |
| `POST /api/cron/recompute-stats` | Vercel Cron, nightly 03:00 IST | Recomputes `item_stats` for every item in the household |
| `POST /api/cron/digest-daily` | Vercel Cron, daily 07:00 IST | Sends the "due within 3 days" email via Resend if anything is due |
| `POST /api/cron/digest-weekly` | Vercel Cron, Sunday 18:00 IST | Sends the "next week's list ready" email |
| `GET /api/export` | User-triggered from Settings | Streams CSV/JSON data export |

### The one real external contract: LLM extraction response

Every extraction call — Flash, Pro escalation, text-only paste path — returns
against the same Zod-validated schema (full field list in the [working spec](../00-working-spec.md)
§7), the boundary between "untrusted model output" and "trusted internal
data":

```ts
{
  merchant: string | null,
  purchased_at: string | null,       // ISO 8601
  currency: string,                   // default "INR"
  order_total: number | null,
  document_type: "receipt"|"invoice"|"order_confirmation"|"unknown",
  lines: Array<{
    raw_text: string, item_name: string, brand: string | null,
    quantity: number | null, unit: string | null, pack_size: string | null,
    unit_price: number | null, line_total: number | null,
    category_slug: string,            // must be from the seeded enum
    is_non_inventory: boolean, confidence: number
  }>
}
```

Validation failure (schema mismatch, `Σ line_total` deviating >5% from stated
total, or mean line confidence <0.5) is what triggers the Pro escalation
(ADR-0003) — this check lives in `/api/ingest/process`, not in the LLM prompt,
so it's testable independent of model behavior.

### `computeItemStats` — internal, not an API, but a contract

`computeItemStats(events, currentStock, config) → ItemStats` is a pure
TypeScript function, no DB access (working spec §5). It is called from both
`commitReceipt` (affected items) and `/api/cron/recompute-stats` (all items),
and is unit-tested directly against fixture event sequences rather than
through either caller — this is what makes it independently verifiable
(REQ-16, validation harness REQ-23).

## Open questions

- [ ] None blocking v1 — there is no external partner integration in scope, so
      no public API surface is needed. Revisit if a future phase adds
      retailer integration (explicitly deferred, working spec §15).
