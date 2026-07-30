// S-17: pure, deterministic synthetic-purchase-history plan (working spec
// Sec12). No DB access, no side effects -- generateItemDefs() is the ground
// truth S-18's validator re-derives independently; generatePurchaseEvents()
// is called once by the seeder (scripts/seed-history.ts) with the real
// "now", never re-run by the validator (which reads actual timestamps back
// from the DB instead), so the two scripts never need matching RNG state
// across separate process invocations.

import { _internal } from '@/lib/predictions/computeItemStats';
import type { CadenceBucket } from '@/lib/predictions/types';

const { CADENCE_BOUNDARIES_DAYS, CADENCE_ORDER } = _internal;

// Fixed seed -- the whole point is that re-running generateItemDefs() from
// a different process (the validator) reproduces byte-identical output.
const PLAN_SEED = 20260730;

export type Cohort =
  | 'clean_periodic'
  | 'high_variance'
  | 'outlier_injected'
  | 'drifting'
  | 'cold_start'
  | 'perishable_implausible_rate'
  | 'qty_inconsistent';

export type ItemDef = {
  index: number;
  canonicalName: string;
  cohort: Cohort;
  categorySlug: string;
  baseUnit: 'g' | 'ml' | 'piece';
  packSize: number;
  perishabilityDays: number | null;
  isStaple: boolean;
  categoryPriorDaysHint: number; // the seeded category's own default_prior_days, for cohort-design bookkeeping only
  // Ground truth used by S-18 to score predictions -- never read by the seeder.
  groundTruth: {
    // Fixed target bucket for most cohorts; drifting has none (its true
    // interval, and therefore its correct bucket, changes over the window).
    targetBucket: CadenceBucket | null;
    // Days-ago -> true interval function (days). Constant for everything
    // except 'drifting'.
    trueIntervalAt: (daysAgo: number) => number;
    jitterSigma: number;
    purchaseCount: number;
    // Index (0-based, oldest-first among generated intervals) that gets an
    // injected outlier multiplier, or null.
    outlierAtIntervalIndex: number | null;
    outlierMultiplier: number | null;
    // Fraction of events (beyond the first) that get qtyBase=null.
    qtyMissingFraction: number;
  };
};

// mulberry32 -- small, fast, deterministic PRNG. Good enough for synthetic
// jitter; cryptographic quality is not the point.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  // Box-Muller.
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Bucket -> representative target interval (midpoint of the bucket's range),
// used for the clean_periodic/high_variance/outlier_injected/qty_inconsistent
// cohorts. Reuses the shipped algorithm's own boundaries (single source of
// truth for what each bucket means) rather than a second hand-copied table.
const BUCKET_MIDPOINT_DAYS: Record<Exclude<CadenceBucket, 'unpredictable'>, number> = (() => {
  const lower = [0, ...CADENCE_BOUNDARIES_DAYS.slice(0, -1)];
  const result = {} as Record<Exclude<CadenceBucket, 'unpredictable'>, number>;
  CADENCE_ORDER.forEach((bucket, i) => {
    const lo = lower[i];
    const hi = CADENCE_BOUNDARIES_DAYS[i];
    result[bucket as Exclude<CadenceBucket, 'unpredictable'>] = (lo + hi) / 2;
  });
  return result;
})();

// Bucket -> closest-prior seeded leaf category (from supabase/seed.sql's
// ~60 S-02 categories), so shrinkage isn't fighting an arbitrarily
// mismatched prior at low n. Picked by inspecting seed.sql's default_prior_days
// column for the nearest match to each bucket's midpoint.
const BUCKET_CATEGORY_SLUGS: Record<Exclude<CadenceBucket, 'unpredictable'>, string[]> = {
  daily: ['milk'],
  every_2_3_days: ['curd-yogurt'],
  weekly: ['paneer-cheese', 'diapers', 'water-can'],
  fortnightly: ['water-bottled', 'noodles-pasta', 'frozen-meat-seafood'],
  monthly: ['pulses-lentils', 'cooking-oil-ghee', 'dishwashing', 'hair-care'],
  quarterly: ['first-aid'],
  half_yearly: ['storage', 'utensils'],
  yearly: ['small-appliances'],
};

const BUCKET_UNIT: Record<Exclude<CadenceBucket, 'unpredictable'>, 'g' | 'ml' | 'piece'> = {
  daily: 'ml',
  every_2_3_days: 'g',
  weekly: 'g',
  fortnightly: 'ml',
  monthly: 'g',
  quarterly: 'piece',
  half_yearly: 'piece',
  yearly: 'piece',
};

function packSizeFor(unit: 'g' | 'ml' | 'piece', rng: () => number): number {
  if (unit === 'piece') return Math.round(1 + rng() * 5);
  const sizes = [250, 500, 750, 1000, 1500, 2000];
  return sizes[Math.floor(rng() * sizes.length)];
}

let globalIndex = 0;
function nextName(cohort: Cohort, label: string): string {
  globalIndex++;
  return `SYN ${String(globalIndex).padStart(3, '0')} ${cohort} ${label}`;
}

function buildCleanLike(
  cohort: Cohort,
  bucket: Exclude<CadenceBucket, 'unpredictable'>,
  slot: number,
  jitterSigma: number,
  purchaseCount: number,
  rng: () => number,
  opts: { outlierAtIntervalIndex?: number; outlierMultiplier?: number; qtyMissingFraction?: number } = {},
): ItemDef {
  const slugs = BUCKET_CATEGORY_SLUGS[bucket];
  const categorySlug = slugs[slot % slugs.length];
  const unit = BUCKET_UNIT[bucket];
  const targetInterval = BUCKET_MIDPOINT_DAYS[bucket];
  const packSize = packSizeFor(unit, rng);

  return {
    index: globalIndex,
    canonicalName: nextName(cohort, bucket),
    cohort,
    categorySlug,
    baseUnit: unit,
    packSize,
    perishabilityDays: null,
    isStaple: rng() > 0.5,
    categoryPriorDaysHint: targetInterval,
    groundTruth: {
      targetBucket: bucket,
      trueIntervalAt: () => targetInterval,
      jitterSigma,
      purchaseCount,
      outlierAtIntervalIndex: opts.outlierAtIntervalIndex ?? null,
      outlierMultiplier: opts.outlierMultiplier ?? null,
      qtyMissingFraction: opts.qtyMissingFraction ?? 0,
    },
  };
}

export function generateItemDefs(): ItemDef[] {
  globalIndex = 0;
  const rng = mulberry32(PLAN_SEED);
  const items: ItemDef[] = [];

  // --- clean_periodic: 25 items across all 8 non-unpredictable buckets,
  // weighted toward buckets that can reach n>=4 training purchases inside
  // computeItemStats' own 24-month lookback (see .claude/epic-6/ledger.md).
  const cleanCounts: Array<[Exclude<CadenceBucket, 'unpredictable'>, number]> = [
    ['daily', 3],
    ['every_2_3_days', 3],
    ['weekly', 4],
    ['fortnightly', 4],
    ['monthly', 4],
    ['quarterly', 4],
    ['half_yearly', 2],
    ['yearly', 1],
  ];
  for (const [bucket, count] of cleanCounts) {
    for (let slot = 0; slot < count; slot++) {
      const targetInterval = BUCKET_MIDPOINT_DAYS[bucket];
      // Enough purchases to fill the 24-month window (capped at
      // computeItemStats' own 40-event cap), or 5 minimum so slow cadences
      // still get a shot at the S3 n>=4-training gate where mathematically
      // possible.
      const purchaseCount = Math.max(5, Math.min(40, Math.ceil((24 * 30.44) / targetInterval) + 1));
      items.push(buildCleanLike('clean_periodic', bucket, slot, 0.15, purchaseCount, rng));
    }
  }

  // --- high_variance: 10 items, sigma=0.40, weekly/fortnightly/monthly only.
  const hvBuckets: Array<Exclude<CadenceBucket, 'unpredictable'>> = ['weekly', 'fortnightly', 'monthly'];
  const hvCounts = [4, 3, 3];
  hvBuckets.forEach((bucket, i) => {
    for (let slot = 0; slot < hvCounts[i]; slot++) {
      items.push(buildCleanLike('high_variance', bucket, slot, 0.4, 10, rng));
    }
  });

  // --- outlier_injected: 8 items, weekly/fortnightly, one big/small interval
  // injected mid-sequence, plenty of purchases so post-rejection n stays >=4.
  const oiBuckets: Array<Exclude<CadenceBucket, 'unpredictable'>> = ['weekly', 'fortnightly'];
  for (let i = 0; i < 8; i++) {
    const bucket = oiBuckets[i % 2];
    const purchaseCount = 9;
    const outlierAtIntervalIndex = Math.floor((purchaseCount - 1) / 2);
    const outlierMultiplier = i % 2 === 0 ? 3.2 : 0.3; // vacation gap vs. early bulk-driven repurchase
    items.push(buildCleanLike('outlier_injected', bucket, i, 0.15, purchaseCount, rng, { outlierAtIntervalIndex, outlierMultiplier }));
  }

  // --- drifting: 8 items, true interval drifts 7d -> 14d oldest-to-newest.
  // Category prior near the drift midpoint (~10-12d), per advisor review,
  // rather than anchored to either endpoint.
  const driftSlugs = ['eggs', 'juices', 'ready-to-eat', 'chocolates-sweets', 'mutton', 'baby-food'];
  for (let i = 0; i < 8; i++) {
    globalIndex++;
    const purchaseCount = 20;
    const totalSpanDays = 20 * 10.5; // ~ purchaseCount * mean(7,14)
    items.push({
      index: globalIndex,
      canonicalName: nextNameNoIncrement('drifting', `item${i + 1}`),
      cohort: 'drifting',
      categorySlug: driftSlugs[i % driftSlugs.length],
      baseUnit: 'g',
      packSize: packSizeFor('g', rng),
      perishabilityDays: null,
      isStaple: rng() > 0.5,
      categoryPriorDaysHint: 11,
      groundTruth: {
        targetBucket: null,
        trueIntervalAt: (daysAgo: number) => {
          const frac = Math.min(1, Math.max(0, daysAgo / totalSpanDays)); // 1 = oldest, 0 = most recent
          return 14 - frac * 7; // 14d far in the past -> 7d most recent (moves 7d->14d over time, per Sec12)
        },
        jitterSigma: 0.15,
        purchaseCount,
        outlierAtIntervalIndex: null,
        outlierMultiplier: null,
        qtyMissingFraction: 0,
      },
    });
  }

  // --- cold_start: 10 items, exactly 1/2/3 total purchases, informational only.
  const coldCounts = [3, 3, 4]; // -> 1, 2, 3 purchases respectively
  const coldPurchaseCounts = [1, 2, 3];
  coldCounts.forEach((count, i) => {
    for (let slot = 0; slot < count; slot++) {
      globalIndex++;
      items.push({
        index: globalIndex,
        canonicalName: nextNameNoIncrement('cold_start', `n${coldPurchaseCounts[i]}-${slot}`),
        cohort: 'cold_start',
        categorySlug: 'supplements',
        baseUnit: 'piece',
        packSize: packSizeFor('piece', rng),
        perishabilityDays: null,
        isStaple: false,
        categoryPriorDaysHint: 30,
        groundTruth: {
          targetBucket: null,
          trueIntervalAt: () => 14,
          jitterSigma: 0.15,
          purchaseCount: coldPurchaseCounts[i],
          outlierAtIntervalIndex: null,
          outlierMultiplier: null,
          qtyMissingFraction: 0,
        },
      });
    }
  });

  // --- perishable_implausible_rate: 5 items, true interval ~30d, large pack,
  // short perishability_days -- the rate cross-check's depletion date would
  // run well past perishability_days without the clamp.
  for (let i = 0; i < 5; i++) {
    globalIndex++;
    items.push({
      index: globalIndex,
      canonicalName: nextNameNoIncrement('perishable_implausible_rate', `item${i + 1}`),
      cohort: 'perishable_implausible_rate',
      categorySlug: 'cooking-oil-ghee',
      baseUnit: 'g',
      packSize: 2000, // large pack so stock/rate implies a long depletion window
      perishabilityDays: 7,
      isStaple: false,
      categoryPriorDaysHint: 30,
      groundTruth: {
        targetBucket: 'monthly',
        trueIntervalAt: () => 30,
        jitterSigma: 0.15,
        purchaseCount: 8,
        outlierAtIntervalIndex: null,
        outlierMultiplier: null,
        qtyMissingFraction: 0,
      },
    });
  }

  // --- qty_inconsistent: 4 items, weekly/fortnightly target, ~50% of events
  // missing qty so q < 0.70 and the rate branch is suppressed.
  const qiBuckets: Array<Exclude<CadenceBucket, 'unpredictable'>> = ['weekly', 'fortnightly'];
  for (let i = 0; i < 4; i++) {
    const bucket = qiBuckets[i % 2];
    items.push(buildCleanLike('qty_inconsistent', bucket, i, 0.15, 8, rng, { qtyMissingFraction: 0.5 }));
  }

  return items;
}

// Helper for cohorts that build their ItemDef by hand (globalIndex already
// incremented by the caller before calling this).
function nextNameNoIncrement(cohort: Cohort, label: string): string {
  return `SYN ${String(globalIndex).padStart(3, '0')} ${cohort} ${label}`;
}

export type PurchaseEventPlan = { occurredAt: string; qtyBase: number | null };

// Walks backward from anchorNowIso generating purchaseCount events (most
// recent last), applying lognormal jitter around the (possibly
// time-varying) true interval, one injected outlier, and qty-missing
// dropout, per the item's ground truth. Seeded per-item (PLAN_SEED + index)
// so re-seeding reproduces the same relative structure even though absolute
// timestamps shift with whenever the seeder actually runs.
export function generatePurchaseEvents(item: ItemDef, anchorNowIso: string): PurchaseEventPlan[] {
  const rng = mulberry32(PLAN_SEED + item.index * 7919);
  const { purchaseCount, jitterSigma, outlierAtIntervalIndex, outlierMultiplier, qtyMissingFraction, trueIntervalAt } = item.groundTruth;

  const anchorMs = new Date(anchorNowIso).getTime();
  const dayMs = 86_400_000;

  // Build intervals oldest-first by walking backward from "now": interval i
  // (0-based, i=0 is the most recent gap) uses trueIntervalAt(daysAgo) at
  // the midpoint of that gap for the drifting cohort's time-varying target.
  const gaps: number[] = [];
  let cursorDaysAgo = 0;
  for (let i = 0; i < purchaseCount - 1; i++) {
    const target = trueIntervalAt(cursorDaysAgo);
    const z = gaussian(rng);
    let gap = target * Math.exp(jitterSigma * z);
    gap = Math.max(0.6, gap); // never collide with the 0.5-day drop threshold
    gaps.push(gap);
    cursorDaysAgo += gap;
  }

  if (outlierAtIntervalIndex !== null && outlierMultiplier !== null && gaps[outlierAtIntervalIndex] !== undefined) {
    gaps[outlierAtIntervalIndex] = Math.max(0.6, gaps[outlierAtIntervalIndex] * outlierMultiplier);
  }

  // gaps[] is ordered most-recent-gap-first (built walking backward from
  // now); reverse to oldest-first, then walk forward from the earliest
  // timestamp to produce ascending occurredAt values.
  const oldestFirstGaps = [...gaps].reverse();
  const totalDays = oldestFirstGaps.reduce((a, b) => a + b, 0);
  const events: PurchaseEventPlan[] = [];
  let cursorMs = anchorMs - totalDays * dayMs;
  events.push({ occurredAt: new Date(cursorMs).toISOString(), qtyBase: item.packSize });
  for (const gap of oldestFirstGaps) {
    cursorMs += gap * dayMs;
    events.push({ occurredAt: new Date(cursorMs).toISOString(), qtyBase: item.packSize });
  }

  // Apply qty-missing dropout as an exact count, evenly spaced across the
  // events after the first (which always keeps its pack-size qty, for
  // readability when inspecting seeded data) -- deliberately NOT an
  // independent per-event Bernoulli draw: at small purchase counts (8
  // events here) the sample variance on a coin flip can land q on the
  // wrong side of RATE_CROSS_CHECK_MIN_Q entirely by chance, which would
  // silently invalidate the cohort's whole purpose. An exact count
  // guarantees q lands where the cohort design intends every run.
  if (qtyMissingFraction > 0 && events.length > 1) {
    const candidates = events.length - 1; // excludes index 0
    const numToNull = Math.round(qtyMissingFraction * events.length);
    const step = candidates / numToNull;
    for (let k = 0; k < numToNull; k++) {
      const idx = 1 + Math.min(candidates - 1, Math.round(k * step));
      events[idx].qtyBase = null;
    }
  }

  return events;
}
