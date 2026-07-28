---
doc: System Overview
project: Inventro
status: approved
updated: 2026-07-28
---

# System Overview

> How a receipt becomes a prediction — the end-to-end flow and its major
> components.

## Context

This is the map to read before touching any component doc below. It exists so
"where does X happen" is answerable in one place, rather than re-derived from
the code on every visit.

## Details

### Component diagram (textual)

```
[Capture: camera/file/paste/manual]
        |
        v
[Client-side preprocess: HEIC->JPEG, downscale 2000px, JPEG q85]
        |
        v
[Upload -> Supabase Storage (private, signed URL)]
        |
        v
[ingest_jobs row created] --async--> [Serverless worker]
        |                                   |
        |                                   v
        |                       [Fast path? pdf-parse native text]
        |                                   |
        |                          text? --yes--> [Gemini Flash, text-only]
        |                                   |no
        |                                   v
        |                       [Rasterize -> Gemini Flash, multimodal]
        |                                   |
        |                          fails schema/total/confidence?
        |                                   |yes
        |                                   v
        |                       [Escalate: Gemini Pro retry, w/ failure context]
        |                                   |
        |                          still fails?
        |                                   |yes
        |                                   v
        |                       [Manual entry fallback, raw response retained]
        |                                   |
        v                                   v
[receipt_lines written, immutable] <--------+
        |
        v
[Canonicalization: alias -> pg_trgm -> LLM new-item]
        |
        v
[Review queue: human confirms lines, date, category]
        |
        v
[COMMIT] --writes--> [stock_movements ledger, price_history, item_aliases]
        |
        v
[Stats recompute triggered (affected items)] --also--> [nightly 03:00 IST cron: all items]
        |
        v
[computeItemStats: item_stats + item_stats_history]
        |
        v
[Plan screen: cadence buckets] --generates--> [Shopping list]
        |
        v
[Insights: budget vs. spend, forward projection]
```

### Major components

- **Capture layer** (Next.js client) — camera/file/drag-drop/paste/manual entry,
  client-side image preprocessing before upload.
- **Ingest pipeline** (serverless, async) — `ingest_jobs` queue, LLM extraction
  with the escalation ladder, canonicalization, unit normalization,
  categorization.
- **Review & commit** — the only path that writes to the ledger; nothing
  auto-commits.
- **Ledger** (`stock_movements`, append-only, see ADR-0001) — the single source
  of truth for what's on hand, derived via `v_current_stock`.
- **Prediction engine** (`computeItemStats`, pure function, see §5 of the
  [working spec](../00-working-spec.md) and ADR-0001) — runs synchronously on commit for affected items,
  and nightly for all items.
- **Planning & presentation** — Plan screen (cadence buckets), Shopping list,
  Inventory, Today, Insights — all read-only consumers of `item_stats` and the
  ledger view; none of them write predictions directly.
- **Notifications** — daily/weekly cron-triggered emails via Resend, reading
  the same `plan_entries`/`item_stats` state.

### Design invariants that hold across every component

1. Nothing reaches the ledger without passing through the review queue
   (working spec §4, F7) — no silent auto-commit, ever.
2. Stock is always derived (ADR-0001), never mutated directly.
3. Every table carries `household_id` (ADR-0004) even though v1 has one
   household.
4. All Supabase access is server-side; no anon key ships to the client
   (PRD REQ-26, verified by A26).

## Open questions

- [ ] None blocking v1. Revisit the ingest-worker boundary (currently a single
      serverless function) if receipt volume ever approaches the 100/day guard
      regularly enough to need queuing/backpressure beyond what Vercel's
      function concurrency gives for free.
