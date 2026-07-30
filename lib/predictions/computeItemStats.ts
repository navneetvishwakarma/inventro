// Pure prediction function (working spec Sec5, S-14a/b/c) -- no DB access,
// no 'server-only' import. This is the whole point of the design: directly
// unit-testable via `npx tsx` against fixture event sequences.

import { toKolkataDateString } from '@/lib/date';
import type { CadenceBucket, ComputeItemStatsConfig, ItemStats, PreviousBucketState, PurchaseEvent } from './types';

const EWMA_ALPHA = 0.35;
const OUTLIER_MAD_MULTIPLIER = 3.5;
// Lowered from the working spec's literal n>=5 (step 3): that gate disables
// outlier rejection at exactly the data volume the rule's own stated purpose
// (one vacation / bulk-buy) targets, and breaks A6 (day 0/7/60/67, 3
// intervals). See .claude/epic-5/ledger.md.
const OUTLIER_REJECTION_MIN_N = 3;
const RATE_CROSS_CHECK_MIN_Q = 0.7;
const RATE_WINDOW_DAYS = 120;
const CONFIDENCE_N_CONSTANT = 3;
// Consistency constant for MAD as a normal-distribution-equivalent std-dev
// estimate ("MAD_normalized", working spec Sec5 step 8).
const MAD_NORMAL_CONSISTENCY = 1.4826;
const CADENCE_BOUNDARIES_DAYS = [1.5, 4, 10, 20, 45, 135, 270, 500] as const;
const CADENCE_ORDER: readonly CadenceBucket[] = [
  'daily',
  'every_2_3_days',
  'weekly',
  'fortnightly',
  'monthly',
  'quarterly',
  'half_yearly',
  'yearly',
] as const;
const HYSTERESIS_MARGIN = 0.15;
const CONFIDENCE_UNPREDICTABLE_THRESHOLD = 0.35;

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

// Step 1: sort ascending, filter to the last 24 months, merge same-Kolkata-day
// events (summing qtyBase), then cap to the most recent 40 merged events.
function gatherEvents(events: PurchaseEvent[], now: string): PurchaseEvent[] {
  const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 24);
  const cutoffIso = cutoff.toISOString();
  const windowed = sorted.filter((e) => e.occurredAt >= cutoffIso);

  const merged: PurchaseEvent[] = [];
  for (const event of windowed) {
    const last = merged[merged.length - 1];
    if (last && toKolkataDateString(last.occurredAt) === toKolkataDateString(event.occurredAt)) {
      last.qtyBase = last.qtyBase === null && event.qtyBase === null ? null : (last.qtyBase ?? 0) + (event.qtyBase ?? 0);
      continue;
    }
    merged.push({ ...event });
  }

  return merged.length > 40 ? merged.slice(merged.length - 40) : merged;
}

// Step 2: consecutive-day intervals, dropping sub-0.5-day gaps.
function computeIntervals(events: PurchaseEvent[]): number[] {
  const intervals: number[] = [];
  for (let i = 1; i < events.length; i++) {
    const gap = daysBetween(events[i - 1].occurredAt, events[i].occurredAt);
    if (gap >= 0.5) intervals.push(gap);
  }
  return intervals;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function medianAbsoluteDeviation(values: number[], centre: number): number {
  return median(values.map((v) => Math.abs(v - centre)));
}

// Step 3: reject intervals more than 3.5xMAD from the median, only once
// there's enough data (n >= OUTLIER_REJECTION_MIN_N) for MAD to be meaningful.
function rejectOutliers(intervals: number[]): number[] {
  if (intervals.length < OUTLIER_REJECTION_MIN_N) return intervals;
  const med = median(intervals);
  const mad = medianAbsoluteDeviation(intervals, med);
  return intervals.filter((x) => Math.abs(x - med) <= OUTLIER_MAD_MULTIPLIER * mad);
}

// Step 4: most-recent-weighted EWMA, seeded on the first usable interval.
function computeEwma(intervals: number[]): number | null {
  if (intervals.length === 0) return null;
  let ewma = intervals[0];
  for (const x of intervals.slice(1)) ewma = EWMA_ALPHA * x + (1 - EWMA_ALPHA) * ewma;
  return ewma;
}

// Step 5: shrink the EWMA toward the category prior; w -> 0 as n -> 0 so a
// brand-new item is entirely prior-driven.
function shrinkToPrior(ewma: number | null, n: number, categoryPriorDays: number): number {
  const w = n / (n + 2);
  if (ewma === null) return categoryPriorDays;
  return w * ewma + (1 - w) * categoryPriorDays;
}

export function computeItemStats(
  rawEvents: PurchaseEvent[],
  config: ComputeItemStatsConfig,
  _previous: PreviousBucketState,
): ItemStats {
  const events = gatherEvents(rawEvents, config.now);
  const rawIntervals = computeIntervals(events);
  const usableIntervals = rejectOutliers(rawIntervals);

  const n = usableIntervals.length;
  const ewma = computeEwma(usableIntervals);
  const med = n > 0 ? median(usableIntervals) : null;
  const mad = n > 0 ? medianAbsoluteDeviation(usableIntervals, med as number) : null;
  const intervalEst = shrinkToPrior(ewma, n, config.categoryPriorDays);

  return {
    purchaseCount: events.length,
    ewmaIntervalDays: ewma,
    intervalMad: mad,
    intervalEstDays: intervalEst,
    dailyRateBase: null,
    lastPurchasedAt: events.length > 0 ? events[events.length - 1].occurredAt : null,
    predictedDepletionAt: null,
    predictedNextPurchaseAt: null,
    cadenceBucket: null,
    confidence: null,
  };
}

// Exported for S-14b/S-14c to extend and for fixture verification scripts.
export const _internal = {
  daysBetween,
  gatherEvents,
  computeIntervals,
  median,
  medianAbsoluteDeviation,
  rejectOutliers,
  computeEwma,
  shrinkToPrior,
  EWMA_ALPHA,
  OUTLIER_MAD_MULTIPLIER,
  OUTLIER_REJECTION_MIN_N,
  RATE_CROSS_CHECK_MIN_Q,
  RATE_WINDOW_DAYS,
  CONFIDENCE_N_CONSTANT,
  MAD_NORMAL_CONSISTENCY,
  CADENCE_BOUNDARIES_DAYS,
  CADENCE_ORDER,
  HYSTERESIS_MARGIN,
  CONFIDENCE_UNPREDICTABLE_THRESHOLD,
};
