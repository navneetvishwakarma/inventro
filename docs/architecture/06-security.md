---
doc: Security
project: PANTRY
status: approved
updated: 2026-07-28
---

# Security

> Consolidates the access-control and data-handling picture that's otherwise
> scattered across the PRD, ADR-0004, and the infrastructure doc, and states
> the residual risk explicitly rather than leaving it implied.

## Context

v1 has no real authentication — a deliberate, scoped trade-off (ADR-0004,
PRD REQ-26), not an oversight. That trade-off is accurate and already well
reasoned across three docs, but no single place states what's actually
exposed if it goes wrong. This doc pulls the existing reasoning together and
adds the three gaps that reasoning didn't cover: passcode brute-force, cookie
signing-key rotation, and leak blast radius.

## Details

### Assets

Grocery and household-supply purchase data: what was bought, when, at what
price, and inferred consumption patterns. Receipt images/PDFs may
incidentally contain address or payment-instrument fragments (a delivery
address on a q-commerce screenshot, a masked card number on a receipt) —
this is unavoidable given the capture format, not something the product asks
for. No payment credentials, no financial account access, no data outside
the household's own grocery habits.

### Access control (existing, consolidated from ADR-0004 / PRD REQ-26)

- A single shared passcode, checked in `middleware.ts` against an env var,
  sets a signed HTTP-only cookie. This is explicitly **not** real
  authentication — it exists because Vercel URLs are public by default, not
  because it's meant to withstand a determined attacker.
- All Supabase access is server-side only; no anon key ships to the client
  bundle (verified by acceptance test A26).
- `household_id` scaffolding (ADR-0004) and RLS-written-but-disabled are
  multi-tenant readiness, not a v1 access-control mechanism — v1 has exactly
  one tenant, so RLS being disabled has no current-day effect.

### Data handling (existing, consolidated from `07-infrastructure.md`)

- Storage is a private bucket, accessed exclusively via 60-second-TTL signed
  URLs — no public bucket access, ever.
- Receipt files older than 12 months are purged; `ingest_jobs.raw_response`
  (raw LLM output retained on manual-entry fallback, REQ-24) follows the same
  12-month purge. Parsed data (`receipt_lines`, ledger entries) is retained
  indefinitely.
- All secrets (Supabase service-role key, Gemini API key, Resend API key)
  are server-side only.

### Residual risk, stated explicitly (new)

**Passcode brute-force.** `middleware.ts` has no rate limit or lockout on
repeated failed passcode attempts today. At single-household scale this is a
low-probability attack (no public awareness of the URL), but it's an
unmitigated gap, not an accepted one — **recommended**, not yet a formal
requirement: a lightweight per-IP attempt counter with exponential backoff
on the gate route. Left as an open item below rather than silently added to
the PRD.

**Cookie signing-key rotation.** No rotation policy exists for whatever
secret signs the gate cookie. Rotating it is a one-step operation — change
the env var, which invalidates every existing session and forces
re-entry of the passcode — acceptable for a single household with no
concurrent-session continuity requirement. No automation needed; this is a
manual, as-needed action if the passcode is ever suspected compromised.

**Blast radius if the passcode leaks.** Scoped deliberately: an attacker
gains read/write access to grocery purchase history, inferred consumption
patterns, and whatever incidental address/payment fragments appear in
receipt images (see Assets above) — nothing else. No financial account
access, no credentials, no data outside this system. Stating this plainly is
most of the mitigation for a system at this scale: the cost of a leak is
"someone sees your grocery habits," not an identity-theft or financial-loss
event. This acceptance is explicitly conditional on REQ-26's own scoping
promise holding — nothing beyond grocery data should ever be stored in this
system while the passcode gate is the only access control.

## Open questions

- [ ] Passcode brute-force rate limiting is recommended above but not yet a
      formal requirement — decide whether to add it as a REQ before build, or
      accept the current gap for v1 given the low-probability attack surface.
- [ ] Revisit this entire doc when the multi-tenant phase lands (real auth,
      invites, RLS enabled) — the access-control section above is written
      specifically for the single-shared-passcode model and will be
      substantially rewritten, not just amended.
