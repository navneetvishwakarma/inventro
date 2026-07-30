import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

type SupabaseClient = ReturnType<typeof createServiceClient>;

// Working spec Sec5/F9.3 -- implemented as the literal condition->multiplier
// mapping the spec states, not re-derived from first principles (the
// parenthetical "the model over-estimated consumption" is quoted verbatim
// below, not independently justified).
const REMAINING_STOCK_HEALTHY_FRACTION = 0.4;
const DEPLETED_INTERVAL_FRACTION = 0.2;
const DOWN_MULTIPLIER = 0.85;
const UP_MULTIPLIER = 1.15;
const CLAMP_MIN = 0.5;
const CLAMP_MAX = 2.0;

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

// On-commit only (S-16 is the only caller). Compares the PREVIOUS
// recompute's own projection (item_stats.predicted_depletion_at /
// daily_rate_base, both untouched by commit_receipt()'s minimal upsert)
// against when this repurchase actually happened -- never a fresh ledger
// sum, which would grow monotonically and walk rate_correction to the floor
// every cycle (caught by advisor review before implementation).
export async function reconcileRateCorrection(
  supabase: SupabaseClient,
  catalogItemId: string,
  thisPurchase: { occurredAt: string; receiptId: string },
): Promise<number> {
  const [statsRes, itemRes, prevPurchaseRes] = await Promise.all([
    supabase.from('item_stats').select('rate_correction, predicted_depletion_at, daily_rate_base').eq('catalog_item_id', catalogItemId).maybeSingle(),
    supabase.from('catalog_items').select('default_pack_size').eq('id', catalogItemId).single(),
    // Eligibility is always determined from stock_movements directly, never
    // item_stats.last_purchased_at -- commit_receipt() (S-13) has already
    // advanced that column to THIS purchase by the time this runs, so it
    // cannot answer "was this the latest purchase before now."
    //
    // source_receipt_id is nullable (shopping-list checkoffs / manual
    // consumption movements carry no receipt, docs/architecture/03-data-model.md).
    // A plain .neq() on a nullable column drops NULL rows entirely under
    // Postgres's three-valued logic (NULL != x is NULL, not true) -- found
    // via this story's own live-Supabase verification, not by reading the
    // filter and assuming it worked. .or() makes the null-safe "IS DISTINCT
    // FROM" comparison explicit: keep rows whose source_receipt_id is either
    // not this receipt, or simply absent.
    supabase
      .from('stock_movements')
      .select('occurred_at')
      .eq('catalog_item_id', catalogItemId)
      .eq('type', 'purchase')
      .or(`source_receipt_id.neq.${thisPurchase.receiptId},source_receipt_id.is.null`)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (statsRes.error) throw statsRes.error;
  if (itemRes.error) throw itemRes.error;
  if (prevPurchaseRes.error) throw prevPurchaseRes.error;

  const currentRateCorrection = statsRes.data?.rate_correction ?? 1;
  const previousPurchaseAt = prevPurchaseRes.data?.occurred_at ?? null;

  // No prior purchase (first-ever) or a later purchase already exists on
  // record (this commit is backdated) -- nothing to reconcile against.
  if (previousPurchaseAt === null || previousPurchaseAt >= thisPurchase.occurredAt) {
    return currentRateCorrection;
  }

  const predictedDepletionAt = statsRes.data?.predicted_depletion_at ?? null;
  const dailyRateBaseOld = statsRes.data?.daily_rate_base ?? null;
  const packSize = itemRes.data?.default_pack_size ?? null;
  if (predictedDepletionAt === null || dailyRateBaseOld === null || packSize === null) {
    return currentRateCorrection;
  }

  const dailyRateOld = dailyRateBaseOld * currentRateCorrection;
  if (dailyRateOld <= 0) return currentRateCorrection;

  const remainingProjected = daysBetween(thisPurchase.occurredAt, predictedDepletionAt) * dailyRateOld;
  const intervalLength = daysBetween(previousPurchaseAt, thisPurchase.occurredAt);
  const elapsedSinceDepletion = daysBetween(predictedDepletionAt, thisPurchase.occurredAt);

  let multiplier: number | null = null;
  if (remainingProjected > REMAINING_STOCK_HEALTHY_FRACTION * packSize) {
    multiplier = DOWN_MULTIPLIER; // "the model over-estimated consumption" (working spec F9.3)
  } else if (elapsedSinceDepletion > DEPLETED_INTERVAL_FRACTION * intervalLength) {
    multiplier = UP_MULTIPLIER;
  }
  if (multiplier === null) return currentRateCorrection;

  return Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, currentRateCorrection * multiplier));
}
