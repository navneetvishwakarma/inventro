import 'server-only';
import { createRequestClient } from '@/lib/supabase/server';
import { getCurrentHouseholdId } from '@/lib/household';
import { getInventoryItems } from '@/lib/inventory/data';
import { getPlanItems } from '@/lib/plan/data';
import { currentKolkataMonthRange } from '@/lib/date';
import { formatBaseQty } from '@/lib/inventory/format';

const TOP_SPEND_LOOKBACK_DAYS = 90;
const TOP_SPEND_LIMIT = 10;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export type SpendByCategory = {
  categoryId: string;
  categoryName: string;
  spend: number;
};

export type BudgetSummary = {
  monthlyBudget: number | null;
  totalSpend: number;
  byCategory: SpendByCategory[];
  legacyExcludedCount: number;
  monthStart: string;
  monthEnd: string;
};

// F13: spend by TOP-LEVEL category for the current Kolkata calendar month,
// plus household.monthly_budget (nullable -- households.monthly_budget has
// no write path anywhere in the app today (S-33/E-14 not built), so a null
// budget is the expected common case, not an error).
export async function getBudgetSummary(): Promise<BudgetSummary> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();
  const { start, end } = currentKolkataMonthRange();

  const [householdRes, spendRes] = await Promise.all([
    supabase.from('households').select('monthly_budget').eq('id', householdId).single(),
    supabase.rpc('get_spend_by_category', { p_household_id: householdId, p_start: start, p_end: end }),
  ]);
  if (householdRes.error) throw householdRes.error;
  if (spendRes.error) throw spendRes.error;

  const rows = (spendRes.data ?? []) as { out_category_id: string; out_category_name: string; out_spend: number; out_legacy_count: number }[];

  const byCategory = rows.map((r) => ({ categoryId: r.out_category_id, categoryName: r.out_category_name, spend: r.out_spend }));
  const totalSpend = byCategory.reduce((sum, c) => sum + c.spend, 0);
  const legacyExcludedCount = rows.length > 0 ? rows[0].out_legacy_count : 0;

  return {
    monthlyBudget: householdRes.data.monthly_budget as number | null,
    totalSpend,
    byCategory,
    legacyExcludedCount,
    monthStart: start,
    monthEnd: end,
  };
}

export type ForwardProjectionItem = {
  catalogItemId: string;
  canonicalName: string;
  monthlyProjected: number;
};

export type ForwardProjection = {
  totalMonthlyProjected: number;
  items: ForwardProjectionItem[]; // sorted descending, top contributors
  excludedNoPriceCount: number; // has a cadence but no verified price yet
};

// F13's headline feature: "next month's committed recurring spend, derived
// directly from live cadences and prices" (REQ-19's own acceptance
// wording). Reuses S-21's getPlanItems() (already reads item_stats'
// cadenceBucket/intervalEstDays and computes suggestedQtyBase with the
// exact no-rate-signal-safe fallback -- not re-derived here) combined with
// get_latest_prices' per-item latest verified price.
//
// monthlyProjected uses dailyRateBase directly when it's known (an actual
// measured consumption rate, unbiased), falling back to
// suggestedQtyBase/intervalEstDays only when there's no rate signal yet.
// Advisor-caught before shipping: a single suggestedQtyBase/intervalEstDays
// formula for BOTH cases inherits S-21's pack-rounding
// (suggestedQtyBase = defaultPackSize * ceil(cycleConsumption/defaultPackSize)),
// which is correct for "what to buy this cycle" but systematically
// OVERSTATES spend for any item whose real per-cycle consumption is below
// one pack -- unboundedly so (e.g. cycleConsumption 300 against a
// defaultPackSize of 1000 comes out ~3.3x too high). The seeder's fixture
// data couldn't catch this: it emits qtyBase = defaultPackSize for every
// event, so cycleConsumption == defaultPackSize by construction and both
// formulas agree on demo data -- confirmed by a separate pure arithmetic
// check (dailyRateBase=30, intervalEstDays=10, defaultPackSize=1000: the
// single-formula version gives 3x the dailyRateBase-direct answer).
export async function getForwardProjection(): Promise<ForwardProjection> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();

  const [planItems, pricesRes] = await Promise.all([getPlanItems(), supabase.rpc('get_latest_prices', { p_household_id: householdId })]);
  if (pricesRes.error) throw pricesRes.error;

  const priceByItem = new Map(((pricesRes.data ?? []) as { out_catalog_item_id: string; out_price_per_base_unit: number }[]).map((r) => [r.out_catalog_item_id, r.out_price_per_base_unit]));

  const items: ForwardProjectionItem[] = [];
  let excludedNoPriceCount = 0;

  for (const item of planItems) {
    // 'unpredictable' has no reliable cadence to project a recurring spend
    // from -- REQ-19 asks for COMMITTED recurring spend, not a guess.
    if (item.cadenceBucket === null || item.cadenceBucket === 'unpredictable' || item.intervalEstDays === null) continue;

    const price = priceByItem.get(item.id);
    if (price === undefined) {
      excludedNoPriceCount++;
      continue;
    }

    const dailyRateEquivalent = item.dailyRateBase ?? item.suggestedQtyBase / item.intervalEstDays;
    const monthlyProjected = dailyRateEquivalent * 30 * price;
    items.push({ catalogItemId: item.id, canonicalName: item.canonicalName, monthlyProjected });
  }

  items.sort((a, b) => b.monthlyProjected - a.monthlyProjected);
  const totalMonthlyProjected = items.reduce((sum, i) => sum + i.monthlyProjected, 0);

  return { totalMonthlyProjected, items, excludedNoPriceCount };
}

export type TopSpendItem = {
  catalogItemId: string;
  canonicalName: string;
  brand: string | null;
  spend: number;
};

// Top-10 by total spend over the trailing 90 days, aggregated in SQL.
export async function getTopSpendItems(limit: number = TOP_SPEND_LIMIT): Promise<TopSpendItem[]> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();

  const { data, error } = await supabase.rpc('get_top_spend_items', { p_household_id: householdId, p_since: daysAgoIso(TOP_SPEND_LOOKBACK_DAYS), p_limit: limit });
  if (error) throw error;

  return ((data ?? []) as { out_catalog_item_id: string; out_canonical_name: string; out_brand: string | null; out_spend: number }[]).map((r) => ({
    catalogItemId: r.out_catalog_item_id,
    canonicalName: r.out_canonical_name,
    brand: r.out_brand,
    spend: r.out_spend,
  }));
}

export type PriceAlert = {
  catalogItemId: string;
  canonicalName: string;
  merchant: string | null;
  trailingAvg: number;
  latestPrice: number;
  pctChange: number; // e.g. 0.28 = +28%
};

// >15% price-change alerts, gated at >=3 prior observations (UX doc: "too
// little history... should show a lower-confidence or not-enough-data-yet
// state rather than a misleading number built on 1-2 data points") --
// entirely computed server-side (window functions), see the migration.
export async function getPriceAlerts(): Promise<PriceAlert[]> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();

  const { data, error } = await supabase.rpc('get_price_alerts', { p_household_id: householdId });
  if (error) throw error;

  return ((data ?? []) as { out_catalog_item_id: string; out_canonical_name: string; out_merchant: string | null; out_trailing_avg: number; out_latest_price: number; out_pct_change: number }[]).map((r) => ({
    catalogItemId: r.out_catalog_item_id,
    canonicalName: r.out_canonical_name,
    merchant: r.out_merchant,
    trailingAvg: r.out_trailing_avg,
    latestPrice: r.out_latest_price,
    pctChange: r.out_pct_change,
  }));
}

export type WasteReportItem = {
  catalogItemId: string;
  canonicalName: string;
  qtyBaseDisplay: string; // formatted via lib/inventory/format.ts's formatBaseQty
  valuedAmount: number | null; // null = "value unknown", not 0
};

export type WasteReport = {
  items: WasteReportItem[]; // sorted by quantity descending
  totalValued: number; // sum across items with a known price only
  unvaluedCount: number;
  monthStart: string;
  monthEnd: string;
};

// Current-month waste, valued at each item's latest known per-base-unit
// price when one exists. qty_base is stored NEGATIVE for waste (core
// invariant, ADR-0001) -- the RPC already applies abs(), never doubled or
// shown negative here.
export async function getWasteReport(): Promise<WasteReport> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();
  const { start, end } = currentKolkataMonthRange();

  const [wasteRes, inventoryItems] = await Promise.all([supabase.rpc('get_waste_report', { p_household_id: householdId, p_start: start, p_end: end }), getInventoryItems()]);
  if (wasteRes.error) throw wasteRes.error;

  const itemById = new Map(inventoryItems.map((i) => [i.id, i]));

  const rows = (wasteRes.data ?? []) as { out_catalog_item_id: string; out_canonical_name: string; out_qty_base: number; out_valued_amount: number | null; out_has_price: boolean }[];

  const items: WasteReportItem[] = rows.map((r) => {
    const invItem = itemById.get(r.out_catalog_item_id);
    return {
      catalogItemId: r.out_catalog_item_id,
      canonicalName: r.out_canonical_name,
      qtyBaseDisplay: invItem ? formatBaseQty(r.out_qty_base, invItem.baseUnit, invItem.defaultPackSize) : `${r.out_qty_base}`,
      valuedAmount: r.out_has_price ? r.out_valued_amount : null,
    };
  });

  const totalValued = items.reduce((sum, i) => sum + (i.valuedAmount ?? 0), 0);
  const unvaluedCount = items.filter((i) => i.valuedAmount === null).length;

  return { items, totalValued, unvaluedCount, monthStart: start, monthEnd: end };
}
