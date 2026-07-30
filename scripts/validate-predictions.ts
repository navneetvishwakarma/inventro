// S-18: npm run validate:predictions
//
// Held-out accuracy scorecard for computeItemStats (working spec Sec12)
// against S-17's seeded ground truth. Reads real stock_movements back from
// the DB (never re-derives timestamps), calls computeItemStats directly
// in-memory (no persistence -- never touches item_stats/item_stats_history),
// and prints the Sec12-format per-cohort table plus an overall S3 (n>=4
// training purchases) PASS/FAIL line.

import { computeItemStats, _internal } from '@/lib/predictions/computeItemStats';
import type { CadenceBucket, PurchaseEvent } from '@/lib/predictions/types';
import { createAdminClient, DEMO_HOUSEHOLD_ID, loadEnvLocal } from './lib/supabaseAdmin';
import { generateItemDefs, type Cohort, type ItemDef } from './seed-history/plan';

const { daysBetween, thresholdBucket, rejectOutliers } = _internal;
const S3_THRESHOLD = 0.7;
const MIN_TRAINING_EVENTS = 4; // "after 4 purchases" (working spec Sec3/Sec12) -- the model has SEEN 4

type ScoredItem = {
  item: ItemDef;
  totalEvents: number;
  trainingEvents: number;
  withinPct25: boolean | null;
  bucketCorrect: boolean | null;
  absErrDays: number | null;
  confidence: number | null;
  dailyRateBase: number | null;
  predictedDepletionAt: string | null;
  outlierRejectedCorrectly: boolean | null;
};

function toPurchaseEvents(rows: { occurred_at: string; qty_base: number | null }[]): PurchaseEvent[] {
  return rows.map((r) => ({ occurredAt: r.occurred_at, qtyBase: r.qty_base }));
}

function scoreItem(item: ItemDef, categoryPriorDays: number, events: PurchaseEvent[]): ScoredItem {
  const totalEvents = events.length;

  if (totalEvents === 0) {
    return {
      item,
      totalEvents,
      trainingEvents: 0,
      withinPct25: null,
      bucketCorrect: null,
      absErrDays: null,
      confidence: null,
      dailyRateBase: null,
      predictedDepletionAt: null,
      outlierRejectedCorrectly: null,
    };
  }

  if (totalEvents === 1) {
    // No held-out test possible -- run on the single event for a
    // confidence-only reading (cold_start's purpose).
    const stats = computeItemStats(
      events,
      { now: events[0].occurredAt, categoryPriorDays, perishabilityDays: item.perishabilityDays, currentStockBase: events[0].qtyBase, rateCorrection: 1 },
      { cadenceBucket: null, intervalEstDays: null },
    );
    return {
      item,
      totalEvents,
      trainingEvents: 0,
      withinPct25: null,
      bucketCorrect: null,
      absErrDays: null,
      confidence: stats.confidence,
      dailyRateBase: stats.dailyRateBase,
      predictedDepletionAt: stats.predictedDepletionAt,
      outlierRejectedCorrectly: null,
    };
  }

  const trainEvents = events.slice(0, -1);
  const heldOut = events[events.length - 1];
  const lastTraining = trainEvents[trainEvents.length - 1];

  // Advisor-mandated: currentStockBase is the last TRAINING purchase's own
  // qtyBase ("just restocked one pack"), never an arbitrary fraction of
  // pack size -- 0.5*packSize was shown to collapse next_purchase onto a
  // systematically ~50%-low depletion estimate for any item with q>=0.70
  // (dailyRate ~= pack/T => depletion ~= last + 0.5*T instead of last + T).
  const stats = computeItemStats(
    trainEvents,
    {
      now: lastTraining.occurredAt,
      categoryPriorDays,
      perishabilityDays: item.perishabilityDays,
      currentStockBase: lastTraining.qtyBase,
      rateCorrection: 1,
    },
    { cadenceBucket: null, intervalEstDays: null },
  );

  const actualIntervalDays = daysBetween(lastTraining.occurredAt, heldOut.occurredAt);
  const predictedIntervalDays = stats.predictedNextPurchaseAt !== null ? daysBetween(lastTraining.occurredAt, stats.predictedNextPurchaseAt) : null;
  const absErrDays = predictedIntervalDays !== null ? Math.abs(predictedIntervalDays - actualIntervalDays) : null;
  const withinPct25 = absErrDays !== null && actualIntervalDays > 0 ? absErrDays / actualIntervalDays <= 0.25 : null;

  const expectedInterval = item.groundTruth.trueIntervalAt(0);
  const expectedBucket: CadenceBucket = item.groundTruth.targetBucket ?? thresholdBucket(expectedInterval);
  const bucketCorrect = stats.cadenceBucket !== null ? stats.cadenceBucket === expectedBucket : null;

  let outlierRejectedCorrectly: boolean | null = null;
  if (item.groundTruth.outlierAtIntervalIndex !== null) {
    const rawIntervals: number[] = [];
    for (let i = 1; i < trainEvents.length; i++) rawIntervals.push(daysBetween(trainEvents[i - 1].occurredAt, trainEvents[i].occurredAt));
    const usable = rejectOutliers(rawIntervals);
    outlierRejectedCorrectly = usable.length < rawIntervals.length;
  }

  return {
    item,
    totalEvents,
    trainingEvents: trainEvents.length,
    withinPct25,
    bucketCorrect,
    absErrDays,
    confidence: stats.confidence,
    dailyRateBase: stats.dailyRateBase,
    predictedDepletionAt: stats.predictedDepletionAt,
    outlierRejectedCorrectly,
  };
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${Math.round((100 * n) / d)}%`;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = createAdminClient();

  const items = generateItemDefs();

  const { data: catalogItems, error: itemsErr } = await supabase.from('catalog_items').select('id, canonical_name').eq('household_id', DEMO_HOUSEHOLD_ID);
  if (itemsErr) throw itemsErr;
  const idByName = new Map((catalogItems ?? []).map((r) => [r.canonical_name as string, r.id as string]));

  const missing = items.filter((i) => !idByName.has(i.canonicalName));
  if (missing.length > 0) {
    console.error(`${missing.length}/${items.length} seeded items not found for the demo household -- run "npm run seed:history" first.`);
    process.exit(1);
  }

  const { data: categories, error: catErr } = await supabase.from('categories').select('slug, default_prior_days');
  if (catErr) throw catErr;
  const priorBySlug = new Map((categories ?? []).map((c) => [c.slug as string, c.default_prior_days as number]));

  // Deliberately per-item, not one bulk household-wide query: a single
  // `.select()` over all ~1100+ demo-household stock_movements silently
  // truncates at Supabase/PostgREST's default row cap (1000), and because
  // every seeded item shares nearly the same "now" anchor timestamp, the
  // truncated tail disproportionately drops exactly the most recent
  // (held-out) event for many items -- found by comparing this script's
  // own per-item counts against the seeder's known plan counts before
  // trusting any scorecard number (the harness-bug-first step of the
  // tuning protocol in sub-S-18.json). Per item, well under any page cap
  // (<=40 rows, computeItemStats' own event cap), same query shape as
  // lib/predictions/recompute.ts's fetchInputs().
  const movementsByItemId = new Map<string, { occurred_at: string; qty_base: number | null }[]>();
  const CONCURRENCY = 10;
  const entries = [...idByName.entries()];
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(([, catalogItemId]) =>
        supabase.from('stock_movements').select('occurred_at, qty_base').eq('catalog_item_id', catalogItemId).eq('type', 'purchase').order('occurred_at', { ascending: true }),
      ),
    );
    batch.forEach(([, catalogItemId], idx) => {
      const res = results[idx];
      if (res.error) throw res.error;
      movementsByItemId.set(catalogItemId, (res.data ?? []) as { occurred_at: string; qty_base: number | null }[]);
    });
  }

  const scored: ScoredItem[] = items.map((item) => {
    const catalogItemId = idByName.get(item.canonicalName)!;
    const categoryPriorDays = priorBySlug.get(item.categorySlug) ?? item.categoryPriorDaysHint;
    const events = toPurchaseEvents(movementsByItemId.get(catalogItemId) ?? []);
    return scoreItem(item, categoryPriorDays, events);
  });

  // --- Sanity check (advisor item 1): a q>=0.70 clean_periodic item's
  // predictedNextPurchaseAt should land close to last+trueInterval, not
  // last+0.5*trueInterval. Printed once, before the aggregate table, so a
  // regression here is visible before trusting any percentage below it.
  const sanityItem = scored.find((s) => s.item.cohort === 'clean_periodic' && s.item.groundTruth.targetBucket === 'weekly' && s.trainingEvents >= MIN_TRAINING_EVENTS);
  if (sanityItem && sanityItem.absErrDays !== null) {
    const trueInterval = sanityItem.item.groundTruth.trueIntervalAt(0);
    console.log(
      `Sanity check (${sanityItem.item.canonicalName}): true interval=${trueInterval.toFixed(1)}d, abs error=${sanityItem.absErrDays.toFixed(2)}d -- ${
        sanityItem.absErrDays < trueInterval * 0.4 ? 'OK (not the 0.5x-collapse failure mode)' : 'SUSPICIOUS -- check currentStockBase wiring'
      }\n`,
    );
  }

  // --- Per-cohort table (working spec Sec12 format) -- S3-eligible items only.
  const cohorts: Cohort[] = ['clean_periodic', 'high_variance', 'outlier_injected', 'drifting', 'cold_start', 'perishable_implausible_rate', 'qty_inconsistent'];

  console.log('Cohort                          n   within±25%   bucket correct   mean abs err');
  let overallWithin = 0;
  let overallScored = 0;

  for (const cohort of cohorts) {
    const eligible = scored.filter((s) => s.item.cohort === cohort && s.trainingEvents >= MIN_TRAINING_EVENTS);
    const withinCount = eligible.filter((s) => s.withinPct25 === true).length;
    const bucketCount = eligible.filter((s) => s.bucketCorrect === true).length;
    const errs = eligible.map((s) => s.absErrDays).filter((e): e is number => e !== null);
    const meanErr = errs.length > 0 ? errs.reduce((a, b) => a + b, 0) / errs.length : null;

    overallWithin += withinCount;
    overallScored += eligible.length;

    console.log(
      `${cohort.padEnd(32)} ${String(eligible.length).padStart(2)}   ${pct(withinCount, eligible.length).padStart(8)}     ${pct(bucketCount, eligible.length).padStart(8)}       ${
        meanErr !== null ? meanErr.toFixed(1) + 'd' : 'n/a'
      }`,
    );
  }

  const s3Pct = overallScored > 0 ? overallWithin / overallScored : 0;
  const pass = s3Pct >= S3_THRESHOLD;
  console.log(`\nS3 (overall, n>=4): ${pct(overallWithin, overallScored)} [target ${Math.round(S3_THRESHOLD * 100)}%] ${pass ? 'PASS' : 'FAIL'} (${overallScored} items scored)\n`);

  // --- Cohort-specific qualitative checks (working spec Sec12 table's
  // stated purpose per cohort), printed as supplementary pass rates.
  const highVariance = scored.filter((s) => s.item.cohort === 'high_variance' && s.confidence !== null);
  const hvNotHigh = highVariance.filter((s) => (s.confidence as number) < 0.7).length;
  console.log(`high_variance: confidence < High (not overconfident) for ${pct(hvNotHigh, highVariance.length)} of items`);

  const outlierItems = scored.filter((s) => s.item.cohort === 'outlier_injected' && s.outlierRejectedCorrectly !== null);
  const outlierHeld = outlierItems.filter((s) => s.outlierRejectedCorrectly === true).length;
  console.log(`outlier_injected: injected outlier actually rejected for ${pct(outlierHeld, outlierItems.length)} of items`);
  const outlierBucketHeld = scored.filter((s) => s.item.cohort === 'outlier_injected' && s.bucketCorrect === true).length;
  const outlierBucketEligible = scored.filter((s) => s.item.cohort === 'outlier_injected' && s.bucketCorrect !== null).length;
  console.log(`outlier_injected: bucket held despite outlier for ${pct(outlierBucketHeld, outlierBucketEligible)} of items`);

  const coldStart = scored.filter((s) => s.item.cohort === 'cold_start' && s.confidence !== null);
  const coldLearning = coldStart.filter((s) => (s.confidence as number) < 0.35).length;
  console.log(`cold_start: confidence=Learning for ${pct(coldLearning, coldStart.length)} of items (informational, no S3 held-out test at n<4)`);

  // Perishability clamp check: predictedDepletionAt <=
  // lastPurchasedAt(training) + perishabilityDays, checked directly against
  // the training events (advisor: checked on predictedDepletionAt only --
  // the shipped blendNextPurchase mixes q against the UNCLAMPED
  // rate.depletionDate, so predictedNextPurchaseAt is not expected to
  // respect the clamp).
  let perishClampHeld = 0;
  let perishClampEligible = 0;
  for (const item of items.filter((i) => i.cohort === 'perishable_implausible_rate')) {
    const catalogItemId = idByName.get(item.canonicalName)!;
    const events = toPurchaseEvents(movementsByItemId.get(catalogItemId) ?? []);
    if (events.length < 2) continue;
    const trainEvents = events.slice(0, -1);
    const lastTraining = trainEvents[trainEvents.length - 1];
    const categoryPriorDays = priorBySlug.get(item.categorySlug) ?? item.categoryPriorDaysHint;
    const stats = computeItemStats(
      trainEvents,
      { now: lastTraining.occurredAt, categoryPriorDays, perishabilityDays: item.perishabilityDays, currentStockBase: lastTraining.qtyBase, rateCorrection: 1 },
      { cadenceBucket: null, intervalEstDays: null },
    );
    perishClampEligible++;
    if (stats.predictedDepletionAt !== null && item.perishabilityDays !== null) {
      const capDays = daysBetween(lastTraining.occurredAt, stats.predictedDepletionAt);
      if (capDays <= item.perishabilityDays + 0.01) perishClampHeld++;
    }
  }
  console.log(`perishable_implausible_rate: clamp holds (predictedDepletionAt <= last+perishabilityDays) for ${pct(perishClampHeld, perishClampEligible)} of items`);

  const qtyInconsistent = scored.filter((s) => s.item.cohort === 'qty_inconsistent' && s.trainingEvents > 0);
  const qtySuppressed = qtyInconsistent.filter((s) => s.dailyRateBase === null).length;
  console.log(`qty_inconsistent: rate branch suppressed (dailyRateBase=null) for ${pct(qtySuppressed, qtyInconsistent.length)} of items`);

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
