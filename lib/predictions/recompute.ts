import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestClient, createServiceClient } from '@/lib/supabase/server';
import { computeItemStats } from './computeItemStats';
import type { CadenceBucket, ItemStats, PreviousBucketState, PurchaseEvent } from './types';

type ItemInputs = {
  events: PurchaseEvent[];
  categoryPriorDays: number;
  perishabilityDays: number | null;
  currentStockBase: number | null;
  rateCorrection: number;
  previous: PreviousBucketState;
};

async function fetchInputs(supabase: SupabaseClient, catalogItemId: string): Promise<ItemInputs> {
  const [itemRes, stockRes, statsRes, movementsRes] = await Promise.all([
    supabase.from('catalog_items').select('category_id, perishability_days').eq('id', catalogItemId).single(),
    supabase.from('v_current_stock').select('qty_base').eq('catalog_item_id', catalogItemId).maybeSingle(),
    supabase.from('item_stats').select('rate_correction, cadence_bucket, interval_est_days').eq('catalog_item_id', catalogItemId).maybeSingle(),
    supabase
      .from('stock_movements')
      .select('occurred_at, qty_base')
      .eq('catalog_item_id', catalogItemId)
      .eq('type', 'purchase')
      .order('occurred_at', { ascending: true }),
  ]);
  if (itemRes.error) throw itemRes.error;
  if (stockRes.error) throw stockRes.error;
  if (statsRes.error) throw statsRes.error;
  if (movementsRes.error) throw movementsRes.error;
  if (!itemRes.data) throw new Error(`catalog_item ${catalogItemId} not found`);

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('default_prior_days')
    .eq('id', itemRes.data.category_id)
    .single();
  if (categoryError) throw categoryError;

  const events: PurchaseEvent[] = (movementsRes.data ?? []).map((m) => ({ occurredAt: m.occurred_at, qtyBase: m.qty_base }));

  return {
    events,
    categoryPriorDays: category.default_prior_days,
    perishabilityDays: itemRes.data.perishability_days,
    currentStockBase: stockRes.data?.qty_base ?? null,
    rateCorrection: statsRes.data?.rate_correction ?? 1,
    previous: {
      cadenceBucket: (statsRes.data?.cadence_bucket ?? null) as CadenceBucket | null,
      intervalEstDays: statsRes.data?.interval_est_days ?? null,
    },
  };
}

// Never includes purchase_count (owned by commit_receipt(), S-13) or
// cadence_override (owned by the Plan screen's manual override, a later
// epic) -- both would silently clobber a value this function has no
// business writing.
function toRow(catalogItemId: string, householdId: string, stats: ItemStats, rateCorrection: number) {
  return {
    catalog_item_id: catalogItemId,
    household_id: householdId,
    ewma_interval_days: stats.ewmaIntervalDays,
    interval_mad: stats.intervalMad,
    interval_est_days: stats.intervalEstDays,
    daily_rate_base: stats.dailyRateBase,
    rate_correction: rateCorrection,
    last_purchased_at: stats.lastPurchasedAt,
    predicted_depletion_at: stats.predictedDepletionAt,
    predicted_next_purchase_at: stats.predictedNextPurchaseAt,
    cadence_bucket: stats.cadenceBucket,
    confidence: stats.confidence,
    updated_at: new Date().toISOString(),
  };
}

export async function persistItemStats(
  supabase: SupabaseClient,
  catalogItemId: string,
  householdId: string,
  stats: ItemStats,
  rateCorrection: number,
): Promise<void> {
  const row = toRow(catalogItemId, householdId, stats, rateCorrection);

  const { error: upsertError } = await supabase.from('item_stats').upsert(row, { onConflict: 'catalog_item_id' });
  if (upsertError) throw upsertError;

  const { error: historyError } = await supabase.from('item_stats_history').insert({
    household_id: householdId,
    catalog_item_id: catalogItemId,
    stats: row,
  });
  if (historyError) throw historyError;

  const { error: trimError } = await supabase.rpc('trim_item_stats_history', { p_household_id: householdId });
  if (trimError) throw trimError;
}

// Single-item recompute -- the on-commit path (S-16) calls this per affected
// item. rateCorrectionOverride, when given, is S-15's freshly-reconciled
// value; omitted, the item's existing rate_correction carries forward
// unchanged (the nightly path never reconciles, per S-15's scope).
//
// S-63/ADR-0006: always called from a request-triggered path (commit,
// consume, manual entry, catalog merge, shopping-list checkoff -- never
// from cron), so this uses the request-scoped client. Contrast with
// recomputeAllItemsForHousehold below, which is cron-only and stays on
// service-role.
export async function recomputeOneItem(catalogItemId: string, householdId: string, rateCorrectionOverride?: number): Promise<void> {
  const supabase = await createRequestClient();
  const inputs = await fetchInputs(supabase, catalogItemId);
  if (inputs.events.length === 0) return; // nothing to compute; no null-stats row is more useful than none

  const rateCorrection = rateCorrectionOverride ?? inputs.rateCorrection;
  const stats = computeItemStats(
    inputs.events,
    {
      now: new Date().toISOString(),
      categoryPriorDays: inputs.categoryPriorDays,
      perishabilityDays: inputs.perishabilityDays,
      currentStockBase: inputs.currentStockBase,
      rateCorrection,
    },
    inputs.previous,
  );

  await persistItemStats(supabase, catalogItemId, householdId, stats, rateCorrection);
}

// Nightly path (S-16, called from the Vercel Cron route). Batches every read
// into one query each rather than looping recomputeOneItem's per-item round
// trips -- at "a few hundred items" scale, N individual fetches risks the
// serverless function timeout. Never reconciles (no single "this purchase"
// anchor exists in a whole-household sweep; S-15 is on-commit only).
//
// S-63/ADR-0006: cron has no user session, and legitimately sweeps every
// household -- stays on the service-role client, one of the two documented
// exceptions (ADR-0006), not migrated like recomputeOneItem above.
export async function recomputeAllItemsForHousehold(householdId: string): Promise<{ recomputed: number; skipped: number }> {
  const supabase = createServiceClient();

  const [itemsRes, categoriesRes, movementsRes, stockRes, statsRes] = await Promise.all([
    supabase.from('catalog_items').select('id, category_id, perishability_days').eq('household_id', householdId).eq('is_archived', false),
    supabase.from('categories').select('id, default_prior_days'),
    supabase
      .from('stock_movements')
      .select('catalog_item_id, occurred_at, qty_base')
      .eq('household_id', householdId)
      .eq('type', 'purchase')
      .order('occurred_at', { ascending: true }),
    supabase.from('v_current_stock').select('catalog_item_id, qty_base').eq('household_id', householdId),
    supabase.from('item_stats').select('catalog_item_id, rate_correction, cadence_bucket, interval_est_days').eq('household_id', householdId),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  if (movementsRes.error) throw movementsRes.error;
  if (stockRes.error) throw stockRes.error;
  if (statsRes.error) throw statsRes.error;

  const categoryPriorById = new Map((categoriesRes.data ?? []).map((c) => [c.id, c.default_prior_days as number]));
  const stockByItem = new Map((stockRes.data ?? []).map((s) => [s.catalog_item_id as string, s.qty_base as number]));
  const statsByItem = new Map((statsRes.data ?? []).map((s) => [s.catalog_item_id as string, s]));

  const eventsByItem = new Map<string, PurchaseEvent[]>();
  for (const m of movementsRes.data ?? []) {
    const arr = eventsByItem.get(m.catalog_item_id as string) ?? [];
    arr.push({ occurredAt: m.occurred_at as string, qtyBase: m.qty_base as number | null });
    eventsByItem.set(m.catalog_item_id as string, arr);
  }

  const now = new Date().toISOString();
  const statsRows: ReturnType<typeof toRow>[] = [];
  const historyRows: { household_id: string; catalog_item_id: string; stats: ReturnType<typeof toRow> }[] = [];
  let skipped = 0;

  for (const item of itemsRes.data ?? []) {
    const events = eventsByItem.get(item.id as string) ?? [];
    if (events.length === 0) {
      skipped++;
      continue;
    }
    const existingStats = statsByItem.get(item.id as string);
    const previous: PreviousBucketState = {
      cadenceBucket: (existingStats?.cadence_bucket ?? null) as CadenceBucket | null,
      intervalEstDays: existingStats?.interval_est_days ?? null,
    };
    const rateCorrection = existingStats?.rate_correction ?? 1;

    const stats = computeItemStats(
      events,
      {
        now,
        categoryPriorDays: categoryPriorById.get(item.category_id as string) ?? 30,
        perishabilityDays: item.perishability_days as number | null,
        currentStockBase: stockByItem.get(item.id as string) ?? null,
        rateCorrection,
      },
      previous,
    );

    const row = toRow(item.id as string, householdId, stats, rateCorrection);
    statsRows.push(row);
    historyRows.push({ household_id: householdId, catalog_item_id: item.id as string, stats: row });
  }

  if (statsRows.length > 0) {
    const { error: upsertError } = await supabase.from('item_stats').upsert(statsRows, { onConflict: 'catalog_item_id' });
    if (upsertError) throw upsertError;

    const { error: historyError } = await supabase.from('item_stats_history').insert(historyRows);
    if (historyError) throw historyError;

    const { error: trimError } = await supabase.rpc('trim_item_stats_history', { p_household_id: householdId });
    if (trimError) throw trimError;
  }

  return { recomputed: statsRows.length, skipped };
}
