---
doc: Competitive Analysis
project: PANTRY
status: approved
updated: 2026-07-28
---

# Competitive Analysis

> Build-vs-buy check across the closest adjacent tools, for a private v1.

## Context

Companion to `docs/product/04-market-research.md` — that document covers
categories, this one scores the specific mechanisms PANTRY depends on against
what the closest alternatives actually do.

## Details

| Capability | Shopping-list apps | Budgeting apps | Q-commerce reorder | Receipt/expense scanners | Barcode pantry trackers | **PANTRY** |
|---|---|---|---|---|---|---|
| Cross-merchant capture (photo/PDF/screenshot) | — | Bank feed only | Own merchant only | Yes | Manual scan only | Yes (F2–F4) |
| Canonical item identity across raw text variants | — | — | Partial | — | Yes (barcode) | Yes (item_aliases, F4) |
| Per-item unit-normalized stock ledger | — | — | — | — | Yes | Yes (append-only ledger, §3) |
| Consumption-rate prediction | — | — | Weak nudge-to-buy | — | — | Yes (§5 engine) |
| Requires manual "used it" logging to stay accurate | n/a | n/a | n/a | n/a | **Yes** | **No** (REQ-14/15) |
| Cadence-bucketed running list w/ cost total | — | — | — | — | — | Yes (Plan screen, REQ-17) |
| Forward budget projection from cadence | — | Trailing only | — | — | — | Yes (REQ-19) |

**The load-bearing gap:** every existing tool that gets close (barcode pantry
trackers) still requires the user to manually mark items as consumed to keep
stock accurate. That manual-logging requirement is exactly what kills adoption
after the novelty wears off. PANTRY's repurchase-reconciliation loop (REQ-15)
is the one mechanism no competitor has, and it's the reason build-vs-buy
resolves to build.

**Where competitors are legitimately better today, and why that's accepted:**
q-commerce apps have real one-tap reordering (PANTRY explicitly does not place
orders, see non-goals); barcode scanners have per-unit expiry tracking
(deferred, see [working spec](../00-working-spec.md) §15); budgeting apps have richer multi-account
financial views (out of scope — PANTRY only tracks grocery/household spend).

## Open questions

- [ ] Nothing blocking for v1. Revisit if/when multi-tenant makes this a product other households could adopt rather than a personal tool.
