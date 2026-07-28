---
doc: Infrastructure
project: Inventro
status: approved
updated: 2026-07-28
---

# Infrastructure

> Deployment topology, secrets handling, and the free-tier constraints that
> shape a few product decisions elsewhere in these docs.

## Context

A single-household tool has to run on free/hobby-tier infrastructure
indefinitely — there's no budget model that justifies paid infra for one
household's grocery data. This doc records what that constrains and how those
constraints are already designed around.

## Details

### Topology

```
Vercel (free/hobby)
  - Next.js 15 app (App Router)
  - Vercel Cron -> nightly recompute (03:00 IST), daily digest (07:00 IST),
    weekly digest (Sunday 18:00 IST)

Supabase (free tier)
  - Postgres 15 + pg_trgm
  - Storage bucket "receipts" (private, signed URLs, 60s TTL)

Gemini API (paid tier for Flash + Pro)
Resend (free tier, transactional email)
```

### Secrets & access boundary

- All secrets are server-side only: Supabase service-role key, Gemini API key,
  Resend API key. None are shipped to the client bundle (PRD REQ-26, verified
  by acceptance test A26 — grep the build output for the anon key).
- The passcode gate (`middleware.ts`) checks a shared passcode against an env
  var and sets a signed HTTP-only cookie — this is explicitly not real
  authentication, scoped to grocery data only (ADR-0004).
- Storage access is exclusively via 60-second-TTL signed URLs — no public
  bucket access, ever.

### Free-tier envelope (and what's designed around it)

| Constraint | Mitigation |
|---|---|
| Storage size limits | Client-side compression before upload: HEIC→JPEG, downscale to 2000px long edge, JPEG q85, target ≤1.5MB |
| Long-term storage growth | Receipt files older than 12 months are purged; parsed data (`receipt_lines`, ledger entries) is retained indefinitely — only the original file goes |
| `ingest_jobs.raw_response` (raw LLM output, retained on manual-entry fallback per REQ-24) accumulating on repeated bad parses | **Resolved:** same 12-month purge as receipt files, reusing the existing purge job/cadence — not kept indefinitely alongside `receipt_lines`, since this is debug exhaust from failures, not parsed user data |
| Serverless function duration | Parse pipeline is async (`ingest_jobs` queue + worker), not a long-running synchronous request — upload returns immediately, parsing happens out of band |
| LLM cost | Loop-bug guard: hard stop at 100 receipts/day, alert at 50; native-PDF-text fast path avoids a multimodal call whenever the source is a real text PDF |

### Observability

Structured logging on the ingest pipeline, keyed on `receipt_id`, so a failed
or slow parse is traceable end to end (upload → job → model call →
escalation → commit) without needing a dedicated APM tool at this scale.

### Performance targets (non-functional)

p95 page load <2.5s on 4G; parse round trip <30s p95 (async, with a visible
progress state so the 30s doesn't read as a hang); WCAG AA — inherited from
whichever UI kit wins ADR-0002, not undone by custom markup.

## Open questions

- [ ] If receipt volume ever regularly approaches the 100/day guard, revisit
      whether Supabase free tier and Vercel function limits still hold —
      not expected at single-household scale, but worth a check before any
      multi-tenant phase multiplies volume.
