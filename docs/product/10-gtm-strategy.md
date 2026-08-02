---
doc: Go-to-Market Strategy
project: Inventro
status: approved
updated: 2026-08-01
---

# Go-to-Market Strategy

> There is no go-to-market for v1 — this document exists to make that explicit
> and to record what changes when/if that stops being true.

## Context

Inventro v1 is a private, single-household tool: no signup flow, no invites, no
marketing surface, gated by a shared passcode rather than real authentication.
"GTM" as a section exists in the standard doc set, so this records the decision
rather than leaving it silently unaddressed.

## Details

**v1 distribution:** none. The household is already the user; there is no
acquisition funnel. Deployment is a single Vercel URL behind a passcode
([working spec](../00-working-spec.md) §2).

**What would have to be true before any GTM exists:**
1. Multi-tenancy and real auth (invites, roles, RLS enabled) — currently
   deferred (working spec §15) but deliberately made cheap to add later:
   every table already carries `household_id`, RLS policies are written but
   disabled, all DB access is server-side.
2. The prediction engine holding up against real (not just synthetic) usage
   across more than one household's shopping patterns.
3. A decision on whether this ever becomes a distributed product at all, vs.
   staying a personal tool indefinitely — not yet decided, and not a v1
   blocker either way.

**Until then:** no pricing, no positioning, no channel work is in scope. This
section should stay a stub until the multi-tenant phase is actually greenlit —
do not backfill speculative GTM content against a decision that hasn't been
made.

## Open questions

- [ ] Revisit this entire document, not just update it, if/when a real GTM
      motion is greenlit — the deployment model (§2 of the working spec)
      and this GTM stub are the two things that change together.

## v2 addendum (2026-08-01)

Precondition 1 above (multi-tenancy + real auth) is being built this
cycle — but as a **testing capability**, not a GTM decision. The trigger
was "create multiple households to test," i.e. validating that tenant
isolation actually works (ADR-0006), not a decision to distribute this
product to other households. Precondition 3 (whether this becomes a
distributed product at all) remains explicitly undecided and is not
this cycle's call to make — that's a go/kill/pivot decision, reserved
separately. This document stays a stub; multi-tenancy landing in the
codebase does not, by itself, change anything written above.
