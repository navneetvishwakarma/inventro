---
doc: adr
project: PANTRY
status: accepted
updated: 2026-07-28
story: "S-01"
---

# ADR-0005: Supabase + Vercel as the backend/hosting platform

## Status

Accepted.

## Context

The build has a 3-day timeline and needs Postgres (for `pg_trgm` trigram
matching, ADR-linked to REQ-09), private file storage with signed URLs for
receipt images, a cron trigger (nightly recompute + digest emails), and a
Next.js hosting target — all on a free/hobby-tier budget, since this is a
private single-household tool with no revenue to fund infrastructure.

## Decision

Supabase (free tier) for Postgres 15 + `pg_trgm`, a private `receipts` Storage
bucket with 60-second-TTL signed URLs, and Vercel Cron for the nightly
recompute and digest jobs. Next.js 15 App Router on Vercel (free/hobby) for
hosting, Server Actions, and Route Handlers. Resend (free tier) for
transactional email.

## Options Considered

### Option A: Supabase + Vercel (chosen)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — one managed Postgres instance covers relational data, trigram matching, and file storage in one platform |
| Cost | Free at this scale (single household, low write volume) |
| Scalability | Sufficient for v1; Supabase's RLS model is exactly what ADR-0004's deferred multi-tenancy needs later |
| Team familiarity | High — both are widely documented, Next.js-native tooling |

**Pros:** `pg_trgm` gives free-tier trigram similarity matching (REQ-09)
without a separate search service; Supabase Storage + signed URLs satisfies
the private-file requirement ([working spec](../../00-working-spec.md) §13) without custom auth
middleware; Vercel Cron covers the nightly 03:00 IST recompute and the digest
emails without a separate scheduler; the RLS-disabled-but-written pattern
(ADR-0004) is native to this platform, not bolted on.
**Cons:** free-tier limits (storage size, function duration) require the
client-side compression and 12-month file purge already specified in the
working spec §13 — an accepted constraint, not a surprise.

### Option B: Self-managed Postgres + S3-compatible storage + a separate cron service

**Pros:** no vendor lock-in, full control over scaling.
**Cons:** meaningfully more setup and operational burden for a 3-day build
with no ops team — provisioning, backups, and access control all become
manual work that Supabase provides out of the box, for no benefit at this
project's actual scale (one household).

### Option C: Firebase / other BaaS

**Pros:** comparable managed-backend convenience.
**Cons:** no first-class relational Postgres + `pg_trgm`, which the
canonicalization matcher (REQ-09) specifically depends on; would require a
separate search/similarity solution.

## Trade-off Analysis

At single-household scale, the operational-simplicity gain from a managed
platform dominates any control lost versus self-hosting. The one real
constraint this decision imposes — free-tier storage and function-duration
limits — is already designed around in the working spec (client-side image
compression to ≤1.5MB, 12-month raw-file purge, async ingest jobs instead of
long-running synchronous requests).

## Consequences

- All three of Postgres, Storage, and Cron live under one platform account,
  simplifying the "no anon key in the client bundle" security requirement
  (PRD REQ-26) to one set of environment variables to audit.
- If usage ever exceeds free-tier limits (unlikely at single-household scale,
  see working spec §13), the upgrade path is a paid Supabase/Vercel tier, not
  a platform migration.

## Alternatives considered

- **Self-managed Postgres + S3 (Option B)** — rejected, operational overhead
  not justified at this scale.
- **Firebase/other BaaS (Option C)** — rejected, no native `pg_trgm` support.
