---
doc: Tech Stack
project: Inventro
status: approved
updated: 2026-07-28
---

# Tech Stack

> What runs where, and why each piece was chosen — see the linked ADRs for the
> full trade-off analysis behind the non-obvious choices.

## Context

A build-ready reference for anyone (human or agent) picking up implementation,
so the stack doesn't need to be re-derived from `package.json` or guessed at.

## Details

| Layer | Choice | Why (ADR) |
|---|---|---|
| Framework | Next.js 16, App Router, TypeScript | Server Actions for mutations, Route Handlers for webhooks/cron, one deploy target |
| Hosting | Vercel (free/hobby tier) | Native Next.js hosting + Cron trigger (ADR-0005) |
| UI kit | shadcn/ui + Tailwind CSS | Astryx spike failed (deprecated Next.js/StyleX plugin, `@/` alias incompatible) — shadcn/ui is final, not fallback (ADR-0002) |
| Client data cache | TanStack Query | Standard client cache over Server Actions/Route Handlers |
| Validation | Zod, at every boundary | LLM response schema, form inputs, API payloads all validated the same way |
| Database | Supabase Postgres 15 + `pg_trgm` | Trigram similarity for canonicalization (REQ-09); managed, free tier (ADR-0005) |
| File storage | Supabase Storage, private bucket `receipts`, signed URLs (60s TTL) | Receipt images/PDFs never served unauthenticated |
| Scheduled jobs | Vercel Cron | Nightly 03:00 IST recompute, daily/weekly digest emails |
| LLM (primary) | Gemini Flash, paid tier | Native PDF+image input, structured JSON, no-training-on-input terms (ADR-0003) |
| LLM (escalation) | Gemini Pro | Retry path on schema/total/confidence failure (ADR-0003) |
| Email | Resend, free tier | Transactional digest/list-ready emails |
| Access control | Shared-passcode middleware gate | Not real auth — explicitly scoped, deferred to multi-tenant phase (ADR-0004) |
| PWA | Web manifest + icons | Installable shell; Android Web Share Target only (iOS unsupported) |

## Details — locale & environment defaults

INR currency, `Asia/Kolkata` timezone, metric units, English — set at the
household level ([working spec](../00-working-spec.md) §2) and used for all date/cron/currency
formatting throughout.

## Details — why not X

- **No separate search service** — `pg_trgm` covers canonicalization matching
  at this data volume; a dedicated search index would be over-engineering.
- **No separate job queue (SQS/BullMQ/etc.)** — `ingest_jobs` as a Postgres
  table polled by a serverless worker is sufficient at single-household
  receipt volume (bounded by the 100/day guard); revisit only if that changes.
- **No ORM layer beyond Supabase's client** — schema is stable and reviewed
  via migration files; an ORM would add abstraction without solving a real
  problem at this scale.

## Open questions

- [x] **Resolved:** Astryx's spike failed at S-04 (ADR-0002) — this doc's
      "UI kit" row now reflects shadcn/ui as final.
