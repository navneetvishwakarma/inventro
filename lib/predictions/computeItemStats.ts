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

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

function earlierIso(a: string, b: string): string {
  return a <= b ? a : b;
}

// Step 6: quantity-based daily consumption rate, gated on data quality (q).
// dailyRateBase is deliberately the raw, uncorrected signal -- rateCorrection
// (S-15's output) is only applied when deriving the transient dailyRate used
// for depletion-date math, never baked into the persisted value (working
// spec Sec5 step 6 note).
function computeRateCrossCheck(
  events: PurchaseEvent[],
  now: string,
  rateCorrection: number,
  currentStockBase: number | null,
): { dailyRateBase: number | null; depletionDate: string | null; q: number } {
  const q = events.length === 0 ? 0 : events.filter((e) => e.qtyBase !== null).length / events.length;
  if (events.length === 0 || q < RATE_CROSS_CHECK_MIN_Q) return { dailyRateBase: null, depletionDate: null, q };

  const windowStart = addDays(now, -RATE_WINDOW_DAYS);
  const windowEvents = events.filter((e) => e.occurredAt >= windowStart);
  if (windowEvents.length < 2) return { dailyRateBase: null, depletionDate: null, q };

  const daysElapsed = daysBetween(windowEvents[0].occurredAt, now);
  if (daysElapsed <= 0) return { dailyRateBase: null, depletionDate: null, q };

  const sumQty = windowEvents.reduce((acc, e) => acc + (e.qtyBase ?? 0), 0);
  const dailyRateBase = sumQty / daysElapsed;

  const dailyRate = dailyRateBase * rateCorrection;
  const lastPurchasedAt = events[events.length - 1].occurredAt;
  const depletionDate =
    dailyRate > 0 && currentStockBase !== null ? addDays(lastPurchasedAt, currentStockBase / dailyRate) : null;

  return { dailyRateBase, depletionDate, q };
}

// Step 7: perishable items expire on schedule regardless of consumption rate
// -- clamp (never extend) the depletion date.
function applyPerishabilityClamp(
  depletionDate: string | null,
  lastPurchasedAt: string,
  perishabilityDays: number | null,
): string | null {
  if (perishabilityDays === null) return depletionDate;
  const perishDate = addDays(lastPurchasedAt, perishabilityDays);
  return depletionDate === null ? perishDate : earlierIso(depletionDate, perishDate);
}

function blendNextPurchase(
  depletionDate: string | null,
  q: number,
  lastPurchasedAt: string,
  intervalEstDays: number,
): string {
  const intervalBased = addDays(lastPurchasedAt, intervalEstDays);
  if (depletionDate === null) return intervalBased;
  const blendedMs = q * new Date(depletionDate).getTime() + (1 - q) * new Date(intervalBased).getTime();
  return new Date(blendedMs).toISOString();
}

// Step 8: confidence. n is the same post-rejection usable-interval count as
// step 5's shrinkage weight (not purchase_count) -- this reading is what
// makes A7 (1 usable interval -> confidence ~0.25, "Learning") hold; the
// working spec's own "confidence High" claim for A5 (3 usable intervals)
// does not hold under this same, literal n/(n+3) formula (0.5, "Medium") --
// an internal contradiction in the doc's worked examples the epic resolved
// in favor of the formula (algorithm detail) over the prose label. See
// .claude/epic-5/ledger.md.
function computeConfidence(n: number, med: number | null, mad: number | null): number {
  if (n === 0) return 0;
  // med === 0 (every usable interval identical) means perfect consistency,
  // cv = 0 -- not a division-by-zero case to special-case away from 0.
  const cv = med === 0 ? 0 : ((mad as number) * MAD_NORMAL_CONSISTENCY) / (med as number);
  const raw = (n / (n + CONFIDENCE_N_CONSTANT)) * (1 - Math.min(cv, 1));
  return Math.min(1, Math.max(0, raw));
}

// Step 9: bucket by interval_est, or force 'unpredictable' below the
// confidence floor -- this is the raw candidate, before step 10's hysteresis.
function thresholdBucket(intervalEstDays: number): CadenceBucket {
  for (let i = 0; i < CADENCE_BOUNDARIES_DAYS.length; i++) {
    if (intervalEstDays <= CADENCE_BOUNDARIES_DAYS[i]) return CADENCE_ORDER[i];
  }
  return 'unpredictable';
}

function candidateBucket(intervalEstDays: number, confidence: number): CadenceBucket {
  return confidence < CONFIDENCE_UNPREDICTABLE_THRESHOLD ? 'unpredictable' : thresholdBucket(intervalEstDays);
}

// Step 10: hysteresis -- only accept a bucket change if interval_est has
// crossed the boundary adjacent to the PREVIOUS bucket by more than 15%.
// Deliberate scope cut: transitions into/out of 'unpredictable' are not
// hysteresised -- it has two independent triggers (interval>500 OR
// confidence<0.35) with no single numeric boundary a >15%-crossing test
// can apply to (see sub-S-14c.json).
function applyHysteresis(candidate: CadenceBucket, intervalEstDays: number, previous: PreviousBucketState): CadenceBucket {
  if (previous.cadenceBucket === null || previous.intervalEstDays === null) return candidate;
  if (candidate === previous.cadenceBucket) return previous.cadenceBucket;
  if (candidate === 'unpredictable' || previous.cadenceBucket === 'unpredictable') return candidate;

  const prevIdx = CADENCE_ORDER.indexOf(previous.cadenceBucket);
  const candIdx = CADENCE_ORDER.indexOf(candidate);
  if (prevIdx === -1 || candIdx === -1) return candidate;

  const movingUp = candIdx > prevIdx;
  const boundary = movingUp ? CADENCE_BOUNDARIES_DAYS[prevIdx] : CADENCE_BOUNDARIES_DAYS[candIdx];
  const crossed = movingUp ? intervalEstDays > boundary * (1 + HYSTERESIS_MARGIN) : intervalEstDays < boundary * (1 - HYSTERESIS_MARGIN);
  return crossed ? candidate : previous.cadenceBucket;
}

export function computeItemStats(rawEvents: PurchaseEvent[], config: ComputeItemStatsConfig, previous: PreviousBucketState): ItemStats {
  const events = gatherEvents(rawEvents, config.now);
  const rawIntervals = computeIntervals(events);
  const usableIntervals = rejectOutliers(rawIntervals);

  const n = usableIntervals.length;
  const ewma = computeEwma(usableIntervals);
  const med = n > 0 ? median(usableIntervals) : null;
  const mad = n > 0 ? medianAbsoluteDeviation(usableIntervals, med as number) : null;
  const intervalEst = shrinkToPrior(ewma, n, config.categoryPriorDays);
  const confidence = computeConfidence(n, med, mad);

  const lastPurchasedAt = events.length > 0 ? events[events.length - 1].occurredAt : null;

  let dailyRateBase: number | null = null;
  let predictedDepletionAt: string | null = null;
  let predictedNextPurchaseAt: string | null = null;
  let cadenceBucket: CadenceBucket | null = null;

  if (lastPurchasedAt !== null) {
    const rate = computeRateCrossCheck(events, config.now, config.rateCorrection, config.currentStockBase);
    dailyRateBase = rate.dailyRateBase;
    predictedDepletionAt = applyPerishabilityClamp(rate.depletionDate, lastPurchasedAt, config.perishabilityDays);
    predictedNextPurchaseAt = blendNextPurchase(rate.depletionDate, rate.q, lastPurchasedAt, intervalEst);
    cadenceBucket = applyHysteresis(candidateBucket(intervalEst, confidence), intervalEst, previous);
  }

  return {
    purchaseCount: events.length,
    ewmaIntervalDays: ewma,
    intervalMad: mad,
    intervalEstDays: intervalEst,
    dailyRateBase,
    lastPurchasedAt,
    predictedDepletionAt,
    predictedNextPurchaseAt,
    cadenceBucket,
    confidence: lastPurchasedAt !== null ? confidence : null,
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
  computeConfidence,
  thresholdBucket,
  candidateBucket,
  applyHysteresis,
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
