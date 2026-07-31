import { describe, it, expect } from 'vitest';
import {
  reconcileRateCorrection,
  DOWN_MULTIPLIER,
  UP_MULTIPLIER,
  CLAMP_MIN,
  CLAMP_MAX,
  REMAINING_STOCK_HEALTHY_FRACTION,
  DEPLETED_INTERVAL_FRACTION,
} from './reconcile';

type Canned = { data: unknown; error: null } | { data: null; error: { message: string } };

// reconcile.ts issues exactly four queries, in this literal order, inside a
// single Promise.all — [item_stats, catalog_items, consumption-signal
// stock_movements, previous-purchase stock_movements]. This fake supplies
// one canned response per `.from()` call in that order and lets every
// chain method (select/eq/not/or/order/limit) pass through, terminating at
// whichever of maybeSingle()/single() the real code calls.
function makeMockSupabase(responses: Canned[]) {
  let i = 0;
  const chain = (res: Canned) => {
    const builder: Record<string, unknown> = {};
    const passthrough = () => builder;
    for (const m of ['select', 'eq', 'not', 'or', 'order', 'limit']) builder[m] = passthrough;
    builder.maybeSingle = () => Promise.resolve(res);
    builder.single = () => Promise.resolve(res);
    return builder;
  };
  return {
    from: () => chain(responses[i++]),
  } as unknown as Parameters<typeof reconcileRateCorrection>[0];
}

const CATALOG_ITEM_ID = 'item-1';

describe('reconcileRateCorrection', () => {
  it('DOWN: remaining projected stock > 40% of pack size -> multiplies by 0.85', async () => {
    // dailyRateOld = 10/day, predicted depletion 40 days after this purchase
    // -> remainingProjected = 40 * 10 = 400, packSize = 500 -> 400 > 0.4*500=200.
    const supabase = makeMockSupabase([
      { data: { rate_correction: 1, predicted_depletion_at: '2026-02-10T00:00:00.000Z', daily_rate_base: 10 }, error: null },
      { data: { default_pack_size: 500 }, error: null },
      { data: { id: 'movement-1' }, error: null }, // a consumption signal exists
      { data: { occurred_at: '2025-12-01T00:00:00.000Z' }, error: null }, // strictly before this purchase
    ]);
    const result = await reconcileRateCorrection(supabase, CATALOG_ITEM_ID, { occurredAt: '2026-01-01T00:00:00.000Z', receiptId: 'r-1' });
    expect(result).toBeCloseTo(1 * DOWN_MULTIPLIER, 10);
  });

  it('UP: elapsed-since-depletion > 20% of interval -> multiplies by 1.15', async () => {
    // Depletion predicted well before this purchase, and the gap since
    // depletion is large relative to the purchase interval.
    const supabase = makeMockSupabase([
      { data: { rate_correction: 1, predicted_depletion_at: '2025-12-01T00:00:00.000Z', daily_rate_base: 1 }, error: null },
      { data: { default_pack_size: 10 }, error: null },
      { data: { id: 'movement-1' }, error: null },
      { data: { occurred_at: '2025-11-01T00:00:00.000Z' }, error: null },
    ]);
    // remainingProjected = daysBetween(thisPurchase, depletion) * dailyRateOld
    // = negative * 1 -> well under 0.4*10, so DOWN branch doesn't fire;
    // elapsedSinceDepletion = daysBetween(depletion, thisPurchase) = 31 days,
    // intervalLength = daysBetween(prevPurchase, thisPurchase) = 61 days,
    // 31 > 0.2*61=12.2 -> UP fires.
    const result = await reconcileRateCorrection(supabase, CATALOG_ITEM_ID, { occurredAt: '2026-01-01T00:00:00.000Z', receiptId: 'r-1' });
    expect(result).toBeCloseTo(1 * UP_MULTIPLIER, 10);
  });

  it('no-op: neither threshold fires', async () => {
    // Depletion lands almost exactly on this purchase date, remaining
    // stock projection is ~0 (well under 40% of pack) and elapsed-since-
    // depletion is ~0 (well under 20% of a long interval).
    const supabase = makeMockSupabase([
      { data: { rate_correction: 1.2, predicted_depletion_at: '2026-01-01T00:00:00.000Z', daily_rate_base: 1 }, error: null },
      { data: { default_pack_size: 100 }, error: null },
      { data: { id: 'movement-1' }, error: null },
      { data: { occurred_at: '2025-10-01T00:00:00.000Z' }, error: null },
    ]);
    const result = await reconcileRateCorrection(supabase, CATALOG_ITEM_ID, { occurredAt: '2026-01-01T00:00:00.000Z', receiptId: 'r-1' });
    expect(result).toBe(1.2);
  });

  it('no-op: no previous purchase on record', async () => {
    const supabase = makeMockSupabase([
      { data: { rate_correction: 1, predicted_depletion_at: '2026-01-01T00:00:00.000Z', daily_rate_base: 1 }, error: null },
      { data: { default_pack_size: 100 }, error: null },
      { data: { id: 'movement-1' }, error: null },
      { data: null, error: null }, // no previous purchase
    ]);
    const result = await reconcileRateCorrection(supabase, CATALOG_ITEM_ID, { occurredAt: '2026-01-01T00:00:00.000Z', receiptId: 'r-1' });
    expect(result).toBe(1);
  });

  it('no-op: this commit is backdated before an existing later purchase', async () => {
    const supabase = makeMockSupabase([
      { data: { rate_correction: 1, predicted_depletion_at: '2026-01-01T00:00:00.000Z', daily_rate_base: 1 }, error: null },
      { data: { default_pack_size: 100 }, error: null },
      { data: { id: 'movement-1' }, error: null },
      { data: { occurred_at: '2026-06-01T00:00:00.000Z' }, error: null }, // later than this purchase
    ]);
    const result = await reconcileRateCorrection(supabase, CATALOG_ITEM_ID, { occurredAt: '2026-01-01T00:00:00.000Z', receiptId: 'r-1' });
    expect(result).toBe(1);
  });

  it('no-op: no consumption/adjustment/waste movement has ever been recorded', async () => {
    const supabase = makeMockSupabase([
      { data: { rate_correction: 1, predicted_depletion_at: '2026-02-10T00:00:00.000Z', daily_rate_base: 10 }, error: null },
      { data: { default_pack_size: 500 }, error: null },
      { data: null, error: null }, // no consumption signal
      { data: { occurred_at: '2026-01-01T00:00:00.000Z' }, error: null },
    ]);
    const result = await reconcileRateCorrection(supabase, CATALOG_ITEM_ID, { occurredAt: '2026-01-01T00:00:00.000Z', receiptId: 'r-1' });
    expect(result).toBe(1);
  });

  it('clamps the cumulative correction to CLAMP_MAX when a firing UP multiplier would push it past 2.0', async () => {
    // Same UP-triggering shape as the UP test above, but starting from
    // rate_correction=1.9: 1.9 * 1.15 = 2.185, must clamp to 2.0.
    const supabase = makeMockSupabase([
      { data: { rate_correction: 1.9, predicted_depletion_at: '2025-12-01T00:00:00.000Z', daily_rate_base: 1 }, error: null },
      { data: { default_pack_size: 10 }, error: null },
      { data: { id: 'movement-1' }, error: null },
      { data: { occurred_at: '2025-11-01T00:00:00.000Z' }, error: null },
    ]);
    const result = await reconcileRateCorrection(supabase, CATALOG_ITEM_ID, { occurredAt: '2026-01-01T00:00:00.000Z', receiptId: 'r-1' });
    expect(result).toBe(CLAMP_MAX);
  });

  it('clamps the cumulative correction to CLAMP_MIN when a firing DOWN multiplier would push it below 0.5', async () => {
    // Same DOWN-triggering shape as the DOWN test above, but starting from
    // rate_correction=0.55: 0.55 * 0.85 = 0.4675, must clamp to 0.5.
    const supabase = makeMockSupabase([
      { data: { rate_correction: 0.55, predicted_depletion_at: '2026-02-10T00:00:00.000Z', daily_rate_base: 10 }, error: null },
      { data: { default_pack_size: 500 }, error: null },
      { data: { id: 'movement-1' }, error: null },
      { data: { occurred_at: '2025-12-01T00:00:00.000Z' }, error: null },
    ]);
    const result = await reconcileRateCorrection(supabase, CATALOG_ITEM_ID, { occurredAt: '2026-01-01T00:00:00.000Z', receiptId: 'r-1' });
    expect(result).toBe(CLAMP_MIN);
  });

  it('the exported thresholds and multipliers match the documented working-spec F9.3 values', () => {
    expect(REMAINING_STOCK_HEALTHY_FRACTION).toBe(0.4);
    expect(DEPLETED_INTERVAL_FRACTION).toBe(0.2);
    expect(DOWN_MULTIPLIER).toBe(0.85);
    expect(UP_MULTIPLIER).toBe(1.15);
    expect(CLAMP_MIN).toBe(0.5);
    expect(CLAMP_MAX).toBe(2.0);
  });
});
