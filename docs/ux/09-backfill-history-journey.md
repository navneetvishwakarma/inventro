---
doc: Backfill History Journey
project: PANTRY
status: approved
updated: 2026-07-28
---

# Journey 9 — Backfilling history

**Persona:** The Restocker.
**Trigger:** Wants the prediction engine to be smarter *sooner* than waiting
for 4 fresh purchases to accumulate — decides to feed in old receipts/order
screenshots sitting in the camera roll or email.
**Screens:** Add (multi-file queue) — deliberately the same flow as everyday
capture, not a separate "import" feature.

## Steps

1. **Selects a batch of old files at once** — months of q-commerce order
   screenshots, old paper receipt photos, whatever exists. Feeling: this
   should feel like clearing a backlog, satisfying rather than tedious.
2. **Works through the sequential review queue**, one receipt at a time, with
   a running counter ("3 of 12"). Feeling: predictable progress — knowing
   there are 12 and being on 3 makes this feel finite, not an open-ended
   chore.
3. **Sees the past-order banner on everything dated before onboarding** —
   "past order — updates history, not current stock." Feeling: this is the
   single most important piece of trust-building copy in this journey. Without
   it, a household backfilling six months of rice purchases would reasonably
   fear their Inventory screen is about to show an absurd, obviously-wrong
   quantity.
4. **Finishes the batch**, returns to Plan/Inventory and sees predictions
   noticeably sharper — cadence buckets populated with real confidence
   instead of "Learning," because the interval history now has real data
   behind it. Feeling: the payoff moment — backfilling should visibly make the
   rest of the app better, or there's no reason to bother doing it.

## Friction points the design must resolve

- Nothing about this flow should look like a different "mode" — same Add
  entry point, same review screen, same commit action. A separate
  batch-import UI would be more code and a worse experience (the [working spec](../00-working-spec.md)
  deliberately rejects a separate bulk-import subsystem, see PRD non-goals).
- The override checkbox ("this item is actually still on hand") needs to be
  visible but not the default — it exists for genuine edge cases (a
  six-month-old bulk purchase of something non-perishable that really is
  still half-full), not as an easy way to accidentally inflate current stock.

## Success signal

A backdated receipt updates frequency stats (interval history, category
learning) but never current stock (PRD acceptance A18) — and after a batch of
historical receipts, cadence confidence on those items visibly improves from
"Learning" toward "Medium/High" without any current-stock numbers going
haywire.

## Edge cases

- Backfilling receipts for an item that's *also* been purchased since
  onboarding — the historical purchases should extend the interval history
  used for prediction, while current stock still only reflects post-`stock_epoch`
  movements, exactly as with any other item.
- A very large batch (dozens of files) — the sequential-review pattern should
  hold up without becoming fatiguing; bulk-accept-high-confidence-lines
  (Journey 3) matters even more here than in single-receipt review.
