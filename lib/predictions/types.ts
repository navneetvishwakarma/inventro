// Shared shape for the prediction engine (working spec Sec5). Declared once
// here so S-14a/b/c extend behavior, not this type, across the epic.

export type PurchaseEvent = {
  occurredAt: string; // ISO instant
  qtyBase: number | null;
};

export type CadenceBucket =
  | 'daily'
  | 'every_2_3_days'
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'yearly'
  | 'unpredictable';

export type ComputeItemStatsConfig = {
  now: string; // ISO instant this recompute is evaluated at
  categoryPriorDays: number;
  perishabilityDays: number | null;
  currentStockBase: number | null;
  // item_stats.rate_correction from the previous cycle. S-15's
  // reconcileRateCorrection is the only thing that ever changes this value;
  // computeItemStats only consumes it. Defaults to 1 for a never-recomputed
  // item.
  rateCorrection: number;
};

export type PreviousBucketState = {
  cadenceBucket: CadenceBucket | null;
  intervalEstDays: number | null;
};

export type ItemStats = {
  // Usable merged-purchase-event count behind this computation (post
  // 24-month window / 40-event cap / same-day merge). NOT the same column
  // as item_stats.purchase_count, which commit_receipt() (S-13) owns and
  // increments per committed receipt line -- recompute.ts must never write
  // this value into that column.
  purchaseCount: number;
  ewmaIntervalDays: number | null;
  intervalMad: number | null;
  intervalEstDays: number | null;
  dailyRateBase: number | null;
  lastPurchasedAt: string | null;
  predictedDepletionAt: string | null;
  predictedNextPurchaseAt: string | null;
  cadenceBucket: CadenceBucket | null;
  confidence: number | null;
};
