---
doc: Plan & Cadence Journey
project: PANTRY
status: approved
updated: 2026-07-28
---

# Journey 5 — Trusting the Plan (cadence & overrides)

**Persona:** The Restocker.
**Trigger:** Wants to know "what do we actually need" — could be a scheduled
weekly check-in, or a nudge from the daily digest.
**Screens:** Plan (cadence tabs, the product's centerpiece), Today.

## Steps

1. **Opens Today first** (default landing screen) — sees everything due within
   3 days across all cadence buckets in one place. Feeling: this should answer
   "do we need anything right now" in the first five seconds, with no
   navigation required.
2. **Moves to Plan for the fuller picture** — tabs per cadence bucket (daily,
   every 2–3 days, weekly, fortnightly, monthly, quarterly, half-yearly,
   yearly, unpredictable). Feeling: this is where "This week's list: 14 items,
   ~₹2,340" should land as genuinely useful, not just a number.
3. **Scans suggested quantities** — pack-size-aware, so "buy 2" means 2
   actual packs, not an awkward fractional amount.
4. **Snoozes an item** they know they don't need yet (already have enough
   despite the model's guess), or **skips once**, or **always excludes** an
   item that's not really part of the household's rhythm.
5. **Manually moves an item to a different cadence bucket** if the model has
   it wrong — e.g. a "monthly" item that's really "quarterly" for this
   household. Feeling: this must feel like a correction the app respects
   permanently, not a suggestion it'll silently override tomorrow.
6. **Later, considers "revert to auto"** on that same item once they trust the
   model has caught up. Feeling: control without long-term babysitting.

## Friction points the design must resolve

- A manual override must visibly persist across the nightly recompute — if a
  household member overrides a bucket and it silently reverts, trust in every
  other prediction collapses too.
- Bucket changes for auto (non-overridden) items must not flicker between
  adjacent buckets receipt-to-receipt — the hysteresis rule ([working spec](../00-working-spec.md) §5)
  exists precisely so the UI never shows an item jumping from "weekly" to
  "every 2–3 days" and back on small noise. The Plan screen should feel
  stable week over week, not twitchy.
- Confidence should read as High/Medium/Learning in the UI, never as a raw
  number — a "Learning" badge on a 2-purchase item should feel like an honest
  "still figuring this out," not a bug.

## Success signal

A manual cadence override survives a nightly recompute, and "revert to auto"
correctly restores the computed value (PRD acceptance A9); ≥60% of recurring
spend lands in a real cadence bucket rather than "unpredictable" (PRD S4).

## Edge cases

- A cold-start item with only 1–2 purchases shows up prior-dominated (mostly
  driven by the category default, not real history) — Plan should surface
  this as "Learning" confidence rather than presenting a falsely confident
  suggested quantity.
- An item with a rejected outlier interval (a vacation gap, a one-off bulk
  buy) should not visibly change bucket at all — the Plan screen shouldn't
  show any sign that something unusual even happened.
