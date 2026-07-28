---
doc: prd
project: Inventro
status: approved        # draft | approved  — must be `approved` before backlog seeding
updated: 2026-07-28
---

# Inventro — Product Requirements

> Approved. Every requirement below is vertically sliced and carries a stable
> `REQ-xx` id referenced by `prd_ref` in `docs/engineering/backlog.json`. Full
> algorithm, schema, and acceptance-test detail behind each requirement lives
> in [`docs/00-working-spec.md`](../00-working-spec.md) — that doc predates
> this PRD and remains the source of truth for §5 (prediction algorithm), §3
> (domain model), §7 (LLM contract), and §11 (the full A1–A26 acceptance test
> list, referenced by id throughout the table below).

## Problem & goal

Households order groceries and household supplies reactively — noticing an
item ran out, then scrambling — with no standing view of consumption rate,
reorder timing, or recurring-vs-one-off spend. The goal is a system that turns
a photographed receipt, app screenshot, or order PDF into structured inventory
in under 15 seconds, infers consumption without requiring manual logging, and
converts that into cadence-bucketed running lists (daily → yearly) plus a
rolling budget view, so shopping shifts from reactive to planned.

## Non-goals

Placing real orders with retailers · barcode scanning · expiry-date-per-unit
tracking · recipe/meal planning · multi-tenancy and real auth (invites, roles,
RLS enabled) · web push · offline sync · seasonality/festival modeling ·
shared real-time list editing · native app · email auto-forwarding inbox ·
household-member spend attribution · bulk/batch historical import (mbox,
CSV — historical orders go through the normal one-at-a-time capture flow
instead, REQ-22).

## Requirements

| ID | Requirement | Priority | Acceptance |
|------|-------------|----------|------------|
| REQ-01 | Onboarding wizard: household name/currency/budget, 3–8 "how you shop" presets seeding `is_staple` + cold-start priors, optional 60s stock tick-off | P0 | New household reaches a non-broken Today screen with zero data (A13); tick-off creates `initial` stock movements and sets `stock_epoch = now()` |
| REQ-02 | Multi-format capture: camera/file-picker/drag-drop for PDF, JPG, PNG, WEBP, HEIC, HTML/MHTML | P0 | Upload a photographed grocery bill → ≥85% lines correctly extracted (A1) |
| REQ-03 | Multi-image-as-one-order grouping (2–3 screenshots as one multimodal call) | P0 | Three screenshots grouped as "one order" produce a single receipt with no triple-counted items (A24) |
| REQ-04 | Clipboard paste (Cmd/Ctrl+V) opens Add with image staged | P1 | Clipboard paste opens Add with the pasted image staged (A25) |
| REQ-05 | Multi-file queue: N files → N receipts, sequential review with counter | P0 | Selecting N files produces N separate receipts reviewed in sequence; this is also the historical-catch-up path (REQ-22) |
| REQ-06 | Paste-text capture (order-confirmation email body) routed to a cheaper text-only LLM call | P1 | Pasted text is parsed via the text-only path, not multimodal |
| REQ-07 | Manual entry: searchable typeahead over catalog, recency-ranked, last-quantity prefilled | P0 | Repeat purchase of a known item takes two taps |
| REQ-08 | Async parse pipeline (upload → storage → ingest job → LLM extraction → line matching → review queue → commit), never auto-commits, dedup via SHA-256 `content_hash` | P0 | Same file uploaded twice is blocked as duplicate (A2); malformed LLM response escalates rather than crashing or silently dropping data (A11) |
| REQ-09 | Canonicalization: exact alias hit → trigram similarity (`pg_trgm`) → LLM-proposed new item; every human confirmation writes a new `item_alias`; merge tool consolidates items | P0 | Same product bought via receipt then manual entry under different raw text resolves to one catalog item, two aliases (A4); merging two items consolidates movements/aliases and recomputes stats (A12) |
| REQ-10 | Unit normalization to base units (g/ml/piece) at write time, ambiguous units default to piece/qty 1 and flag for review | P0 | Mixed units (kg, l, dozen, pack-of-N) commit to correct base-unit quantities |
| REQ-11 | Categorization against the fixed seeded taxonomy only (never invented), non-inventory rows (fees/tax/discounts) excluded | P0 | 20-line PDF order confirmation parses with delivery fee and GST excluded as non-inventory (A3) |
| REQ-12 | Review queue: split view (document + editable lines), purchase date as a mandatory first-class editable field, past-order banner when dated before `stock_epoch` | P0 | A document with no extractable date blocks commit; setting a date manually releases it (A21); a backdated receipt updates frequency stats but not current stock (A18) |
| REQ-13 | Inventory screen: grouped by category, stock state pinned, filters (category/cadence/stock-state/staples), search across name + aliases, item detail with plain-language prediction explanation | P0 | Item card shows current stock, predicted days remaining, cadence badge |
| REQ-14 | Consumption actions (used it up / used some / wasted) plus implicit virtual depletion for display/prediction (never a written ledger movement) | P0 | "Used it up" zeroes stock and surfaces the item in Today (A8) |
| REQ-15 | Repurchase reconciliation: compare projected vs. actual stock at each repurchase and adjust `rate_correction` (clamped [0.5, 2.0]) | P0 | At repurchase, projected stock >40% of pack size multiplies `rate_correction` by 0.85 (over-projected consumption); projected stock ≤0 for >20% of the interval multiplies it by 1.15 (under-projected); cumulative correction clamped to [0.5, 2.0] (working spec §5/F9.3). Core-bet mechanism — validated via the synthetic seeder cohorts (REQ-23) pre-launch, since real history is too thin at launch to measure this directly |
| REQ-16 | Prediction engine `computeItemStats` (pure function): EWMA over intervals, outlier rejection, shrinkage-to-category-prior, rate-based cross-check, perishability clamp, confidence score, cadence bucketing with hysteresis | P0 | Item bought at day 0/7/14/21 buckets `weekly`, confidence High, next purchase ≈ day 28 (A5); one outlier interval (vacation/bulk-buy) doesn't move the bucket (A6); 2-purchase item is prior-dominated, confidence `Learning` (A7) |
| REQ-17 | Cadence planner / Plan screen: buckets from daily→unpredictable, suggested qty = pack-size-aware, snooze/skip/exclude/override with "revert to auto," Today view (due within 3 days) | P0 | Manual cadence override survives nightly recompute; "revert to auto" restores the computed value (A9) |
| REQ-18 | Shopping list: generate from any bucket or "due in next N days," optional purchase-log-on-checkoff with price prompt, plain-text export | P1 | Checking off an item without a receipt still feeds the model when a price is logged |
| REQ-19 | Budget & insights: spend vs. budget by category, forward projection of next month's committed recurring spend, top-10 spend items, price-change alerts (>15%), waste report | P1 | Forward projection is derived from live cadences and prices, not a static estimate |
| REQ-20 | Notifications: daily 07:00 IST digest (items due ≤3 days), weekly Sunday 18:00 IST list-ready email, in-app badges | P2 | Digest only fires when something is actually due |
| REQ-21 | Settings: household config, category management, catalog manager (merge/archive/recategorize), cost meter (LLM spend/receipt/model tier), CSV/JSON export, demo-data wipe | P1 | Cost meter reflects per-receipt token/cost accounting (ties to REQ-25) |
| REQ-22 | Backdating: historical orders added through the same capture flow (REQ-05), one at a time — no separate batch-import subsystem | P0 | Backdated receipt correctly updates frequency stats only, not current stock (A18, via `stock_epoch`) |
| REQ-23 | Synthetic history seeder + validation harness (`pnpm seed:history` / `pnpm validate:predictions`), 7 cohorts, `is_demo`-flagged household only | P0 | Per-cohort scorecard prints; overall S3 (n≥4) clears ≥70% before shipping the prediction engine |
| REQ-24 | LLM extraction contract: Gemini Flash primary, native-PDF-text fast path, escalation to Pro on schema/total-mismatch failure, manual-entry fallback with raw response retained | P0 | Malformed JSON escalates to Pro, then to manual entry, never a crash or silent data loss (A11); native-text PDF takes the text-only path, photographed screenshot takes multimodal, verifiable via `parse_path` (A22) |
| REQ-25 | Cost controls: hard stop at 100 receipts/day (alert at 50), per-receipt token/cost accounting | P1 | Loop-bug guard actually halts ingestion at the threshold |
| REQ-26 | Single-household tenancy scaffolding: `household_id` on every table sourced from `DEFAULT_HOUSEHOLD_ID`, all DB access server-side, RLS policies written-but-disabled, shared-passcode gate (`middleware.ts` + signed HTTP-only cookie) | P0 | Anon Supabase key absent from client bundle; unauthenticated request without the gate cookie returns 401 (A26) — **flagged: no real authentication, explicitly scoped to grocery data only until the multi-tenant phase (see `docs/product/10-gtm-strategy.md`)** |
| REQ-27 | PWA installability (manifest, icons); Android Web Share Target only, no offline data sync | P2 | App is installable; offline shell caches but data does not sync offline |

**PII / compliance flag:** REQ-26 is the one requirement touching access
control, and it explicitly does *not* implement real authentication — this is
accepted as an intentional v1 risk ([working spec](../00-working-spec.md) §2, §14), scoped to grocery
data only, with the schema already shaped so enabling real auth + RLS later is
additive, not a rewrite. Receipt images may incidentally contain address or
payment-instrument fragments; storage is private with 60s-TTL signed URLs, and
raw files are purged after 12 months (parsed data is retained) — see
`docs/architecture/07-infrastructure.md`. Full residual-risk picture
(passcode brute-force, cookie-key rotation, leak blast radius) consolidated
in `docs/architecture/06-security.md`.

**Acceptance test numbering:** the table above cites acceptance tests by id
(A1–A26); the full list is working spec §11. Ids A10, A14–A17, A19–A20, and
A23 are intentionally reserved numbering from the spec's original
consolidation pass, not undefined tests — do not treat their absence from
this table as a gap to fill.

## Success metrics

See `docs/product/07-success-metrics.md` (S1–S5). Every metric there maps back
to at least one REQ-xx above.

## Open questions

- [ ] None blocking backlog seeding. Astryx-vs-shadcn is an implementation-time decision documented as ADR-0002, not a product requirement.
