import 'server-only';
import { resolveHouseholdContext, type HouseholdContext } from '@/lib/household';
import { computeVirtualStockBase } from './virtualStock';
import type { BaseUnit } from '@/lib/receipts/canonicalize';
import type { CadenceBucket } from '@/lib/predictions/types';

const PRICE_WINDOW_DAYS = 90;
const SPARKLINE_MAX_POINTS = 8;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

export type PricePoint = { observedAt: string; unitPrice: number };

export type InventoryItem = {
  id: string;
  canonicalName: string;
  brand: string | null;
  categoryId: string;
  categoryName: string;
  baseUnit: BaseUnit;
  defaultPackSize: number | null;
  isStaple: boolean;
  perishabilityDays: number | null;
  aliases: string[];
  // Whether v_current_stock returned a row at all for this item (i.e. >=1
  // post-stock_epoch movement of ANY type exists) -- distinct from
  // rawStockBase, which defaults to 0 for "no row" and "row sums to 0"
  // alike. getItemsNeedingAttention needs this distinction: an item whose
  // only history is an onboarding 'initial' tick-off has no item_stats row
  // (recomputeOneItem never ran for it, no purchase events) but DOES get a
  // v_current_stock row the moment a consumption action writes a movement
  // against it -- that is the majority real-world case this app launches
  // into, not an edge case (advisor review before S-20 implementation
  // caught this exact gap in an earlier lastPurchasedAt-only draft).
  hasStockRow: boolean;
  rawStockBase: number;
  virtualStockBase: number;
  dailyRateBase: number | null;
  rateCorrection: number;
  lastPurchasedAt: string | null;
  predictedNextPurchaseAt: string | null;
  predictedDepletionAt: string | null;
  // Effective bucket: cadence_override ?? cadence_bucket (E-8/S-21). The
  // one value the whole app displays/filters on, so /plan and /inventory
  // never disagree about which bucket an item is in once overridden.
  cadenceBucket: CadenceBucket | null;
  // The raw computed bucket, unaffected by override -- recompute.ts's own
  // output. Needed to tell "Revert to auto" apart from "no override set".
  computedCadenceBucket: CadenceBucket | null;
  cadenceOverride: CadenceBucket | null;
  confidence: number | null;
  intervalEstDays: number | null;
  avgUnitPrice90d: number | null;
  priceSeries: PricePoint[];
  daysRemaining: number | null;
};

// S-19: batched fetch (one query per table, matches recomputeAllItemsForHousehold's
// precedent) -- never per-item N+1. At "a few hundred items" household scale this
// is one page load's worth of round trips, not one per item.
export async function getInventoryItems(context?: HouseholdContext): Promise<InventoryItem[]> {
  const { supabase, householdId } = await resolveHouseholdContext(context);

  const [itemsRes, stockRes, statsRes, aliasesRes, pricesRes] = await Promise.all([
    supabase
      .from('catalog_items')
      .select('id, canonical_name, brand, category_id, base_unit, default_pack_size, is_staple, perishability_days, categories(name)')
      .eq('household_id', householdId)
      .eq('is_archived', false),
    supabase.from('v_current_stock').select('catalog_item_id, qty_base').eq('household_id', householdId),
    supabase
      .from('item_stats')
      .select('catalog_item_id, daily_rate_base, rate_correction, last_purchased_at, predicted_depletion_at, predicted_next_purchase_at, cadence_bucket, cadence_override, confidence, interval_est_days')
      .eq('household_id', householdId),
    supabase.from('item_aliases').select('catalog_item_id, raw_text').eq('household_id', householdId),
    // 90-day window keeps this well clear of PostgREST's default 1000-row cap
    // (the exact bug S-18 hit fetching all-time stock_movements in bulk) --
    // also happens to match the "avg price (90d)" field this feeds.
    supabase.from('price_history').select('catalog_item_id, unit_price, observed_at').eq('household_id', householdId).gte('observed_at', daysAgoIso(PRICE_WINDOW_DAYS)).order('observed_at', { ascending: false }),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (stockRes.error) throw stockRes.error;
  if (statsRes.error) throw statsRes.error;
  if (aliasesRes.error) throw aliasesRes.error;
  if (pricesRes.error) throw pricesRes.error;

  const stockByItem = new Map((stockRes.data ?? []).map((s) => [s.catalog_item_id as string, s.qty_base as number]));
  const statsByItem = new Map((statsRes.data ?? []).map((s) => [s.catalog_item_id as string, s]));

  const aliasesByItem = new Map<string, string[]>();
  for (const a of aliasesRes.data ?? []) {
    const arr = aliasesByItem.get(a.catalog_item_id as string) ?? [];
    arr.push(a.raw_text as string);
    aliasesByItem.set(a.catalog_item_id as string, arr);
  }

  const pricesByItem = new Map<string, PricePoint[]>();
  for (const p of pricesRes.data ?? []) {
    // pricesRes is already ordered desc by observed_at; capping to the first
    // SPARKLINE_MAX_POINTS seen per item keeps the most recent points.
    const arr = pricesByItem.get(p.catalog_item_id as string) ?? [];
    if (arr.length < SPARKLINE_MAX_POINTS) arr.push({ observedAt: p.observed_at as string, unitPrice: p.unit_price as number });
    pricesByItem.set(p.catalog_item_id as string, arr);
  }

  const now = new Date().toISOString();

  return (itemsRes.data ?? []).map((item) => {
    const stats = statsByItem.get(item.id as string);
    const hasStockRow = stockByItem.has(item.id as string);
    const rawStockBase = stockByItem.get(item.id as string) ?? 0;
    const dailyRateBase = (stats?.daily_rate_base ?? null) as number | null;
    const rateCorrection = (stats?.rate_correction ?? 1) as number;
    const predictedDepletionAt = (stats?.predicted_depletion_at ?? null) as string | null;
    const lastPurchasedAt = (stats?.last_purchased_at ?? null) as string | null;
    const predictedNextPurchaseAt = (stats?.predicted_next_purchase_at ?? null) as string | null;

    const virtualStockBase = computeVirtualStockBase({
      rawStockBase,
      dailyRateBase,
      rateCorrection,
      predictedDepletionAt,
      lastPurchasedAt,
      now,
    });

    const priceSeries = (pricesByItem.get(item.id as string) ?? []).slice().reverse(); // chronological for sparkline rendering
    const avgUnitPrice90d = priceSeries.length > 0 ? priceSeries.reduce((sum, p) => sum + p.unitPrice, 0) / priceSeries.length : null;

    const categoryRow = item.categories as unknown as { name: string } | { name: string }[] | null;
    const categoryName = Array.isArray(categoryRow) ? (categoryRow[0]?.name ?? 'Uncategorized') : (categoryRow?.name ?? 'Uncategorized');

    return {
      id: item.id as string,
      canonicalName: item.canonical_name as string,
      brand: item.brand as string | null,
      categoryId: item.category_id as string,
      categoryName,
      baseUnit: item.base_unit as BaseUnit,
      defaultPackSize: item.default_pack_size as number | null,
      isStaple: item.is_staple as boolean,
      perishabilityDays: item.perishability_days as number | null,
      aliases: aliasesByItem.get(item.id as string) ?? [],
      hasStockRow,
      rawStockBase,
      virtualStockBase,
      dailyRateBase,
      rateCorrection,
      lastPurchasedAt,
      predictedNextPurchaseAt,
      predictedDepletionAt,
      cadenceBucket: ((stats?.cadence_override ?? stats?.cadence_bucket) ?? null) as CadenceBucket | null,
      computedCadenceBucket: (stats?.cadence_bucket ?? null) as CadenceBucket | null,
      cadenceOverride: (stats?.cadence_override ?? null) as CadenceBucket | null,
      confidence: (stats?.confidence ?? null) as number | null,
      intervalEstDays: (stats?.interval_est_days ?? null) as number | null,
      avgUnitPrice90d,
      priceSeries,
      // Sourced from predicted_next_purchase_at, not predicted_depletion_at
      // (S-19 invariant) -- populated for any item with >=1 purchase, unlike
      // predicted_depletion_at which requires the rate-cross-check's q>=0.70
      // gate.
      daysRemaining: predictedNextPurchaseAt !== null ? daysBetween(now, predictedNextPurchaseAt) : null,
    };
  });
}

export type ItemDetail = InventoryItem & {
  movements: { id: string; type: string; qtyBase: number; occurredAt: string; note: string | null }[];
  fullPriceSeries: PricePoint[];
};

export async function getInventoryItem(catalogItemId: string): Promise<ItemDetail | null> {
  const context = await resolveHouseholdContext();
  const items = await getInventoryItems(context);
  const item = items.find((i) => i.id === catalogItemId);
  if (!item) return null;

  const { supabase } = context;
  const [movementsRes, pricesRes] = await Promise.all([
    supabase
      .from('stock_movements')
      .select('id, type, qty_base, occurred_at, note')
      .eq('catalog_item_id', catalogItemId)
      .order('occurred_at', { ascending: false })
      .limit(200),
    supabase.from('price_history').select('unit_price, observed_at').eq('catalog_item_id', catalogItemId).order('observed_at', { ascending: false }).limit(100),
  ]);
  if (movementsRes.error) throw movementsRes.error;
  if (pricesRes.error) throw pricesRes.error;

  return {
    ...item,
    movements: (movementsRes.data ?? []).map((m) => ({
      id: m.id as string,
      type: m.type as string,
      qtyBase: m.qty_base as number,
      occurredAt: m.occurred_at as string,
      note: m.note as string | null,
    })),
    fullPriceSeries: (pricesRes.data ?? []).map((p) => ({ observedAt: p.observed_at as string, unitPrice: p.unit_price as number })).reverse(),
  };
}

// S-20: the Today stub's "Needs attention" section -- items whose virtual
// stock (F9.2) has hit zero. Deliberately reuses getInventoryItems() rather
// than a leaner bespoke query: this repo's household scale (a few hundred
// items) makes the extra joins cheap, and a second, drifting definition of
// "current stock" is a worse tradeoff than one extra query cost.
//
// Gate is (hasStockRow OR lastPurchasedAt !== null), not lastPurchasedAt
// alone -- lastPurchasedAt only exists once item_stats has been computed,
// which only happens once a PURCHASE movement exists (recomputeOneItem
// no-ops on zero purchase events). An onboarding-only item (one 'initial'
// movement, no item_stats row at all) still gets a v_current_stock row the
// moment a real consumption action writes a movement against it -- that IS
// the majority real-world case this app launches into (confirmed via a
// live query against the real household: 22 items with positive raw stock,
// all onboarding-only, zero item_stats rows). A lastPurchasedAt-only gate
// would silently exclude every one of them from "Needs attention" after
// "Used it up" -- caught by advisor review before this function shipped.
// The remaining exclusion (no stock row AND no purchase history) is exactly
// "never touched this catalog item at all," which correctly stays out.
export async function getItemsNeedingAttention(): Promise<Pick<InventoryItem, 'id' | 'canonicalName' | 'brand'>[]> {
  const items = await getInventoryItems();
  return items
    .filter((i) => (i.hasStockRow || i.lastPurchasedAt !== null) && i.virtualStockBase <= 0)
    .map((i) => ({ id: i.id, canonicalName: i.canonicalName, brand: i.brand }));
}
