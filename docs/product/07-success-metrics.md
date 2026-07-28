---
doc: Success Metrics
project: Inventro
status: approved
updated: 2026-07-28
---

# Success Metrics

> How we know the v1 bet paid off. Ties directly to PRD acceptance criteria.

## Context

Five measurable criteria, each tied to a specific mechanism in the product, so
"is this working" is never a judgment call.

## Details

| ID | Metric | Target | Measured by | Ties to |
|---|---|---|---|---|
| S1 | Line-item extraction accuracy (name, qty, unit, price) on a supported document | ≥85% | Manual audit sample of committed receipts | REQ-08, REQ-24 |
| S2 | Repeat purchases map to the correct canonical item, no duplicate catalog entries | ≥90% | Audit of `item_aliases` vs. `catalog_items` after repeat buys | REQ-09 |
| S3 | Predicted next-purchase date within ±25% of actual interval after 4 purchases | ≥70% of items | `pnpm validate:predictions` scorecard against the synthetic seeder (real history is too thin at launch to measure this directly) | REQ-16, REQ-23, `00b-validation.md` |
| S4 | Recurring spend assigned to a cadence bucket rather than "unpredictable" | ≥60% | `item_stats.cadence_bucket` distribution query | REQ-17 |
| S5 | Capture-to-committed-inventory time for a clean receipt | <15s | Manual timing on representative documents | REQ-02, REQ-08, REQ-12 |

**Non-functional companions** (from the [working spec](../00-working-spec.md) §13, not independent
success metrics but gating conditions): p95 page load <2.5s on 4G; parse round
trip <30s p95; ≤100 receipts/day hard stop with alert at 50 (cost/loop-bug
guard).

## Open questions

- [x] **Resolved:** S3 is currently measured only against synthetic data (see
      `00b-validation.md`). Add a real-data S3 check once ~2 months of actual
      household history exists. If real S3 comes in meaningfully below 70%,
      the response is the same as the pre-launch synthetic gate: retune α,
      the shrinkage constant, the MAD threshold, and the hysteresis margin
      against the real data first. The algorithm shape (EWMA + shrinkage +
      rate cross-check + reconciliation) is not up for revision from this
      signal alone — escalate to a scope conversation only if retuning
      against several weeks of real data still doesn't close the gap.
