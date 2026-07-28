---
doc: Catalog Management Journey
project: Inventro
status: approved
updated: 2026-07-28
---

# Journey 8 — Fixing the catalog

**Persona:** The Restocker.
**Trigger:** Notices something's off — the same product showing up twice in
Inventory under slightly different names, or an item filed under the wrong
category.
**Screens:** Settings → catalog manager.

## Steps

1. **Notices a duplicate** (e.g. "Amul Toned Milk 1L" from a receipt and
   "AMUL MILK TONED 1 LTR" from manual entry showing as two separate items).
   Feeling: mild annoyance — this is exactly the kind of thing that erodes
   trust if it happens often.
2. **Opens the catalog manager**, finds both entries, picks a survivor and
   merges. System: reassigns all aliases and stock movements to the survivor,
   archives the duplicate, recomputes stats. Feeling: relief that this is a
   one-time fix, not a recurring cleanup chore — every future purchase under
   either raw text should now resolve correctly without repeating this.
3. **Recategorizes an item** that landed in "uncategorized" or the wrong
   category. Feeling: this should feel sticky — once fixed, it shouldn't need
   fixing again for this item.
4. **Archives an item** no longer bought (e.g. discontinued product, or a
   one-off gift purchase that shouldn't pollute recurring predictions).

## Friction points the design must resolve

- Merge needs a clear, low-risk preview ("this will combine 2 purchases and 3
  aliases into one item") before committing — this is a destructive-feeling
  action even though it's fully reversible in principle via the ledger.
- This screen is explicitly a fallback for when the automatic canonicalization
  (alias matching, trigram similarity, LLM new-item proposal) got it wrong —
  it should feel like an occasional correction, not a routine maintenance
  task the household is expected to perform regularly.

## Success signal

Merging two catalog items consolidates movements and aliases correctly, with
stats recomputing afterward (PRD acceptance A12) — and critically, the next
purchase of either raw-text variant resolves automatically to the merged item
with no repeat manual work.

## Edge cases

- Merging two items that both have significant purchase history — recomputed
  stats after merge should reflect the *combined* interval history, not just
  the survivor's prior history, so the prediction doesn't regress after a
  merge.
- Attempting to merge an item into itself, or merging in a way that would
  create a cycle — blocked with a clear message, not a silent no-op.
