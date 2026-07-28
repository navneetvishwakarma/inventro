---
doc: Shopping List Journey
project: PANTRY
status: approved
updated: 2026-07-28
---

# Journey 6 — Shopping off the list

**Persona:** The Restocker.
**Trigger:** About to actually go shopping or place a q-commerce order, wants
a concrete list rather than the full Plan view.
**Screens:** Shopping list (generated from Plan).

## Steps

1. **Generates a list** from a specific cadence bucket, or "everything due in
   the next N days." Feeling: this should feel like a natural export of what
   they were just looking at in Plan, not a separate thing to configure.
2. **Shares or exports it** as plain text/clipboard — e.g. pastes it straight
   into a family chat or a q-commerce app's search-and-add flow. Feeling: the
   list needs to be genuinely useful outside the app, since PANTRY explicitly
   never places the order itself.
3. **Shops**, either offline or via an app.
4. **Checks items off** as they're bought. If checking one off without having
   gone through the normal receipt-capture flow, optionally gets a quick price
   prompt. Feeling: this should feel optional and fast — a way to keep the
   model fed even on a no-receipt trip, not a chore.

## Friction points the design must resolve

- The price prompt on checkoff must be skippable without friction — forcing
  it would reintroduce exactly the manual-logging burden the core bet is
  designed to avoid.
- Export needs to produce something legible dropped into a plain chat message
  — no app-specific formatting that breaks when pasted elsewhere.

## Success signal

A checked-off item without a receipt still writes a purchase movement (and
therefore still feeds the reconciliation loop) whenever a price is entered —
this is what makes shopping trips without receipts still useful to the model.

## Edge cases

- A list generated from "everything due in N days" that turns out to be empty
  — should read as good news ("nothing due"), not a broken/blank screen.
- An item checked off that isn't on the generated list at all (an impulse
  buy) — should still be addable inline, routing to the same manual-entry
  path as elsewhere in the app.
