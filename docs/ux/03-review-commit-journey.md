---
doc: Review & Commit Journey
project: Inventro
status: approved
updated: 2026-07-28
---

# Journey 3 — Reviewing & committing a receipt

**Persona:** The Restocker.
**Trigger:** A parsed receipt is ready for review (from Journey 2).
**Screens:** Review (split view: document preview + editable line table).

## Steps

1. **Opens the review queue**, sees the original document alongside the
   parsed lines. Feeling: needs to immediately trust that what's on the right
   matches what's on the left — this is the moment confidence in the whole
   product is won or lost.
2. **Bulk-accepts high-confidence lines in one tap.** Feeling: relief that
   most lines don't need individual attention — only the uncertain ones should
   demand a decision.
3. **Resolves low-confidence lines** — picks from top-3 suggested catalog
   matches, or confirms a proposed "new item." Feeling: this should feel like
   confirming a guess, not starting from a blank field.
4. **Confirms the purchase date** — prominent, editable, defaulted to today.
   If the date came from anywhere other than the document itself, it's shown
   as unconfirmed until one explicit tap. Feeling: mild pause here is
   intentional — this field silently controls whether the receipt affects
   current stock or just history.
5. **If the date is before onboarding (`stock_epoch`)**, sees "past order —
   updates history, not current stock" with an override checkbox for the rare
   case the item actually is still on hand. Feeling: reassurance, not
   confusion, about why this receipt won't change what Inventory shows.
6. **If a cancelled/refunded order is detected**, sees a warning banner (not a
   hard block) — feeling: informed, still in control of the decision.
7. **Taps Commit.** System: writes the ledger movements, price history, and
   aliases, and triggers a stats recompute — feeling: done, no further
   waiting.

## Friction points the design must resolve

- Bulk-accept must not feel like it's hiding risk — the lines it skips over
  should visibly be the high-confidence ones, not an opaque "trust us."
- The purchase-date field needs enough visual weight that it's never
  accidentally left at today's default for a backdated receipt — a wrong date
  here silently corrupts either current stock or the frequency stats.
- An empty/unextractable date must hard-block commit — no silent guessing,
  ever (this is a correctness requirement, not just a UX nicety).

## Success signal

A real, previously-unseen receipt goes from upload to committed inventory with
≥85% of lines correct without manual fixing (PRD S1); a receipt with no
extractable date blocks commit until set manually (A21).

## Edge cases

- Same file uploaded twice → blocked as a duplicate before it ever reaches
  this screen (content hash check happens at ingest, not review).
- A different file matching an existing receipt's merchant/date/total →
  soft warning here, not a block, since it might legitimately be a split
  transaction.
- Malformed LLM output that never resolved even after Pro escalation → lands
  here as a manual-entry fallback, with the raw model response available via
  a "flag this parse as bad" affordance.
