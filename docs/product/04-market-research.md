---
doc: Market Research
project: Inventro
status: approved
updated: 2026-07-28
---

# Market Research

> Why no existing category of tool already solves this, scoped honestly for a
> single-household v1 (this is not a market-sizing exercise).

## Context

This is a personal tool, not a venture — "market research" here means: is there
already a tool that does this well enough that building is wasted effort? The
short answer is no, because every adjacent category is missing at least one of
the three things this product depends on: cross-merchant visibility,
consumption-rate inference, and zero-logging-required prediction.

## Details

**Shopping-list / note apps** (Google Keep, Apple Reminders, plain checklists).
Zero intelligence — the user manually adds and removes every item, manually
remembers cadence, and gets no prediction or budget view. This is the tool
being replaced.

**Personal finance / budgeting apps** (YNAB-style, bank-statement categorizers).
See spend by category after the fact, sometimes with merchant-level
auto-tagging, but have no concept of *items*, *units*, or *consumption rate* —
they cannot tell you when you'll run out of rice, only that you spent money at
a grocery merchant.

**Q-commerce apps' own "reorder" features** (each app's past-orders / reorder
shortcut). These exist, but per-merchant: they don't aggregate the offline
store run plus three different q-commerce apps plus the odd bulk purchase into
one picture, and they have every incentive to nudge toward *more* ordering, not
an honest "you don't need this yet."

**Receipt-scanning / expense-tracking apps.** Solve OCR-to-line-items, which is
adjacent to this product's capture pipeline (§F2–F4), but stop at "here's what
you spent" — no unit normalization, no per-item stock ledger, no prediction.

**Inventory/pantry-tracking apps** (barcode-scan pantry trackers). Closest
category in spirit, but typically require manual barcode scanning and manual
"mark as used" logging — exactly the discipline this product's core bet
(REQ-15, implicit depletion + reconciliation) is designed to avoid requiring.

## Conclusion

No category combines (1) capture from arbitrary receipts/screenshots/PDFs
across merchants, (2) a canonical per-item stock ledger, and (3) prediction
that improves without manual consumption logging. That gap is the product.

## Open questions

- [ ] Re-check this landscape before any multi-tenant/public phase — competitive positioning changes materially once this stops being a private tool (see `docs/product/05-competitive-analysis.md`).
