---
doc: Product Thesis
project: PANTRY
status: approved
updated: 2026-07-28
---

# Product Thesis

> The single bet the product is built around, and why it's provable.

## Context

Every "smart shopping list" idea lives or dies on one question: can the system
know what a household has and needs *without* the household doing extra data
entry? If the answer requires disciplined logging, adoption dies in week two.
This document states the bet PANTRY is making and how it gets tested.

## Details

**The bet:** implicit depletion + repurchase reconciliation is sufficient to
keep per-item consumption-rate predictions accurate over time, with zero
explicit "I used this" logging required from the user.

Mechanically: stock is decremented *virtually* between purchases using a
learned `daily_rate_base` (implicit depletion, REQ-14), purely for display and
prediction — never written as a ledger movement. Every time the item is
rebought, the system compares what it *projected* the stock should be against
reality and corrects the rate (`rate_correction`, clamped to [0.5, 2.0]) —
over-projected consumption pulls the rate down, under-projected pulls it up
(REQ-15). This closed loop is what lets the model self-correct indefinitely
without user discipline, and it's the single most load-bearing mechanism in
the product — everything else (cadence buckets, the Plan screen, budget
projection) is a presentation layer on top of it.

**Why this is provable before real usage exists:** the underlying algorithm
(`computeItemStats`, PRD REQ-16) is a pure function over an event list, so it
can be validated against synthetic ground-truth purchase histories
(REQ-23 / `docs/product/00b-validation.md`) rather than waiting for months of
real data. If the bet is wrong, it shows up as a failing cohort in the
validation scorecard, not as a silent bad prediction shipped to a user.

**Secondary bet:** capture friction is the actual adoption blocker, not the
prediction quality. A model that's 90% accurate but takes two minutes per
receipt to log will lose to a model that's 70% accurate and takes 15 seconds.
This is why capture polish (multi-image grouping, clipboard paste, multi-file
queue) is explicitly called out as a Day 3 gate in the delivery plan, on par
with the prediction engine itself.

## Open questions

- [ ] At what point (real purchase count) does the repurchase-reconciliation loop's correction outweigh the category-prior shrinkage in practice? Not testable until real usage accumulates — tracked as a post-launch metric, not a launch blocker.
