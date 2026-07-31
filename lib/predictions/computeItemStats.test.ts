import { describe, it, expect } from 'vitest';
import { computeItemStats, _internal } from './computeItemStats';
import type { ComputeItemStatsConfig, PreviousBucketState, PurchaseEvent } from './types';

const NO_PREVIOUS: PreviousBucketState = { cadenceBucket: null, intervalEstDays: null };

function config(overrides: Partial<ComputeItemStatsConfig> = {}): ComputeItemStatsConfig {
  return {
    now: '2026-02-01T00:00:00.000Z',
    categoryPriorDays: 7,
    perishabilityDays: null,
    currentStockBase: null,
    rateCorrection: 1,
    ...overrides,
  };
}

// docs/MANUAL-TESTS.md E-5 / S-14c fixture 1: day 0/7/14/21 -> weekly,
// confidence ~0.50, next purchase ~day 28.
describe('computeItemStats — S-14c fixture 1 (day 0/7/14/21)', () => {
  const events: PurchaseEvent[] = [
    { occurredAt: '2026-01-01T00:00:00.000Z', qtyBase: null },
    { occurredAt: '2026-01-08T00:00:00.000Z', qtyBase: null },
    { occurredAt: '2026-01-15T00:00:00.000Z', qtyBase: null },
    { occurredAt: '2026-01-22T00:00:00.000Z', qtyBase: null },
  ];

  it('buckets weekly with confidence ~0.50 and next-purchase ~day 28', () => {
    const stats = computeItemStats(events, config(), NO_PREVIOUS);
    expect(stats.purchaseCount).toBe(4);
    expect(stats.intervalEstDays).toBe(7);
    expect(stats.cadenceBucket).toBe('weekly');
    expect(stats.confidence).toBeCloseTo(0.5, 5);
    expect(stats.predictedNextPurchaseAt).toBe('2026-01-29T00:00:00.000Z'); // day 21 + 7
  });
});

// S-14c fixture 2: day 0/7/60/67 rejects the 60-day outlier, stays weekly.
describe('computeItemStats — S-14c fixture 2 (day 0/7/60/67)', () => {
  const events: PurchaseEvent[] = [
    { occurredAt: '2026-01-01T00:00:00.000Z', qtyBase: null },
    { occurredAt: '2026-01-08T00:00:00.000Z', qtyBase: null },
    { occurredAt: '2026-03-08T00:00:00.000Z', qtyBase: null }, // +60d from day 7
    { occurredAt: '2026-03-15T00:00:00.000Z', qtyBase: null }, // +67d from day 0
  ];

  it('rejects the 60-day outlier interval and stays weekly', () => {
    const stats = computeItemStats(events, config(), NO_PREVIOUS);
    expect(stats.purchaseCount).toBe(4);
    // Outlier rejected -> only the two 7-day intervals survive, not skewed
    // toward the 53-day gap.
    expect(stats.intervalEstDays).toBe(7);
    expect(stats.cadenceBucket).toBe('weekly');
  });
});

// S-14c fixture 3: a 2-purchase item is prior-dominated, confidence ~0.25,
// bucket=unpredictable — independent of the actual gap or prior, since
// n=1 always yields confidence = 1/(1+3) = 0.25 exactly.
describe('computeItemStats — S-14c fixture 3 (2-purchase item)', () => {
  const events: PurchaseEvent[] = [
    { occurredAt: '2026-01-01T00:00:00.000Z', qtyBase: null },
    { occurredAt: '2026-01-31T00:00:00.000Z', qtyBase: null },
  ];

  it('is prior-dominated with confidence ~0.25 and bucket=unpredictable', () => {
    const stats = computeItemStats(events, config({ categoryPriorDays: 30 }), NO_PREVIOUS);
    expect(stats.purchaseCount).toBe(2);
    expect(stats.confidence).toBeCloseTo(0.25, 5);
    expect(stats.cadenceBucket).toBe('unpredictable');
  });
});

// S-14a: a same-Kolkata-day duplicate purchase collapses into one event
// before interval math runs, not a spurious ~0-day interval. These two
// instants are on different UTC calendar dates (Jan 1 vs Jan 2) but the
// same Asia/Kolkata calendar date (Jan 2, UTC+5:30) — the exact case
// toKolkataDateString exists to get right.
describe('computeItemStats — S-14a (same-Kolkata-day merge)', () => {
  const sameKolkataDayEvents: PurchaseEvent[] = [
    { occurredAt: '2026-01-01T23:00:00.000Z', qtyBase: 500 }, // 2026-01-02 04:30 IST
    { occurredAt: '2026-01-02T01:00:00.000Z', qtyBase: 300 }, // 2026-01-02 06:30 IST
    { occurredAt: '2026-01-09T00:00:00.000Z', qtyBase: 200 },
    { occurredAt: '2026-01-16T00:00:00.000Z', qtyBase: 200 },
  ];

  it('merges the same-Kolkata-day pair into one event, summing qtyBase', () => {
    const merged = _internal.gatherEvents(sameKolkataDayEvents, config().now);
    expect(merged).toHaveLength(3);
    expect(merged[0].qtyBase).toBe(800); // 500 + 300 merged
  });

  it('produces no spurious near-zero interval from the merged pair', () => {
    const stats = computeItemStats(sameKolkataDayEvents, config(), NO_PREVIOUS);
    expect(stats.purchaseCount).toBe(3);
    // Post-merge intervals are ~7 days apart, not a ~0.08-day (2h) gap.
    expect(stats.intervalEstDays).toBeGreaterThan(1);
  });
});
