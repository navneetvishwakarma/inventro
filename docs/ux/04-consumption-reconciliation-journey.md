---
doc: Consumption & Reconciliation Journey
project: PANTRY
status: approved
updated: 2026-07-28
---

# Journey 4 — Living with the ledger (consumption & reconciliation)

**Persona:** The Restocker (occasional explicit actions) and the Glancer
(passive observer, most of the time).
**Trigger:** Time passing between purchases — this journey is mostly *not*
an active user action, which is the entire point of the core bet.
**Screens:** Inventory (item cards, item detail), Today.

## Steps — the passive path (the default, and the important one)

1. **Does nothing.** Feeling: no obligation, no app-checking ritual. System:
   stock is virtually decremented for display/prediction using the learned
   `daily_rate_base` — never written as a real ledger movement, purely a
   projection.
2. **Glances at Inventory or Today whenever curious.** Sees "1.5 kg ≈ 3 packs,
   ~2 days left" on an item card. Feeling: this number needs to feel roughly
   trustworthy even though no one told the app anything since the last
   purchase — that trust is the whole product.
3. **Eventually rebuys the item** (Journey 2/3). System: at commit time,
   compares what it *projected* stock should have been against what was
   actually rebought, and silently corrects `rate_correction` up or down.
   Feeling: invisible to the user — this is the mechanism working, not
   something they should ever need to think about.

## Steps — the active path (optional, available when wanted)

1. **Taps "Used it up"** on an item they know just ran out early (e.g., spilled
   the last of it). System: zeroes stock immediately, item surfaces in Today.
2. **Taps "Used some"** with a quick 25/50/75%-or-numeric input for a partial
   update. Feeling: useful for correcting the model's guess without full
   ledger discipline — a *supplement* to the passive mechanism, never a
   requirement for it to work.
3. **Marks something "Wasted/expired."** System: writes a waste movement,
   distinct from consumption, so waste shows up separately in Insights.

## Friction points the design must resolve

- The item detail's "plain-language prediction explanation" ("You buy this
  every ~9 days; last bought 7 days ago; ~2 days left") is the single most
  important piece of copy in the product — it's what makes an invisible
  statistical model feel legible and trustworthy instead of arbitrary.
- Explicit consumption actions must never feel *expected* — if using the app
  starts to feel like it requires logging, the core bet has failed in
  practice even if the algorithm is technically fine.

## Success signal

Marking "Used it up" zeroes stock and surfaces the item in Today immediately
(PRD acceptance A8); a household that never once logs consumption manually
still gets usably accurate predictions after a few repurchase cycles, purely
from the reconciliation loop.

## Edge cases

- An item is rebought *before* the model projected it would run out (stock
  was over-estimated as still-remaining) → `rate_correction` scales down.
- An item runs out well before the model projected (under-estimated
  consumption) → `rate_correction` scales up, clamped to a sane range so one
  unusual event (a party, a guest staying over) doesn't wildly overcorrect the
  long-run rate.
- Perishable items (dairy, fresh produce) have their predicted depletion
  clamped to `perishability_days` regardless of what the raw rate math says —
  the explanation copy should reflect this ("perishable, so we cap the
  estimate") rather than showing a nonsensical multi-week prediction.
