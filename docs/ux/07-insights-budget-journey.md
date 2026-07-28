---
doc: Insights & Budget Journey
project: Inventro
status: approved
updated: 2026-07-28
---

# Journey 7 — Checking the budget

**Persona:** The Glancer (primarily), also the Restocker before a big
purchase decision.
**Trigger:** A budget conversation is happening, or simple curiosity about
where the month's spend is going.
**Screens:** Insights.

## Steps

1. **Opens Insights**, sees spend vs. household budget, broken down by
   category. Feeling: this should read as "here's reality," not require any
   interpretation — the numbers should already be in the categories a person
   would naturally think in (groceries, home care, personal care, etc.).
2. **Checks the forward projection** — next month's committed recurring
   spend, derived directly from live cadences and prices. Feeling: this is
   the moment Inventro delivers something no other tool does — "here's roughly
   what next month costs before it happens," not just a look backward.
3. **Scans top-10 spend items** and any price-change alerts (>15% vs.
   trailing average). Feeling: useful for spotting a merchant price hike
   before it becomes a pattern nobody noticed.
4. **Glances at the waste report.** Feeling: mildly uncomfortable if waste is
   high, but useful — this is meant to prompt behavior change, not shame; copy
   should stay neutral and factual.

## Friction points the design must resolve

- The forward projection must be clearly labeled as a *projection from
  cadence + price data*, not a guarantee — it should read as confident but not
  overclaim precision it doesn't have.
- Price-change alerts need enough context (which merchant, what the trailing
  average was) to be actionable, not just a bare percentage.

## Success signal

Forward projection numbers move visibly and correctly when a cadence or price
changes elsewhere in the app (Plan overrides, new receipts) — this is the
signal that Insights isn't a static report but a live view over the same
underlying state everything else uses.

## Edge cases

- A household with too little history for a meaningful trailing-90-day price
  average — should show a lower-confidence or "not enough data yet" state
  rather than a misleading number built on 1–2 data points.
- A category with zero recent spend (e.g. quarterly items not yet due this
  month) — should show as genuinely zero, not disappear from the breakdown
  entirely, so the household still sees the full category structure.
