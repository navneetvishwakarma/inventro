import 'server-only';
import { createRequestClient } from '@/lib/supabase/server';
import { getCurrentHouseholdId } from '@/lib/household';
import { normalizeText, type BaseUnit } from '@/lib/receipts/canonicalize';

export type CatalogSearchResult = {
  catalogItemId: string;
  canonicalName: string;
  brand: string | null;
  baseUnit: BaseUnit;
  defaultPackSize: number | null;
  categoryId: string;
  lastPurchasedAt: string | null;
  lastQtyBase: number;
  score: number;
};

const SEARCH_LIMIT = 8;

// S-29: empty query -> recency-ranked (REQ-07's default typeahead state).
// Non-empty -> trigram + alias similarity, ILIKE floor for short queries,
// via the search_catalog_items() RPC (migration 20260730150000). Query text
// is normalized the same way item_aliases.normalized_text is stored, so the
// comparison basis matches what S-09's matching ladder itself uses.
export async function searchCatalogItems(query: string): Promise<CatalogSearchResult[]> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();
  const normalized = normalizeText(query);

  const { data, error } = await supabase.rpc('search_catalog_items', { p_household_id: householdId, p_query: normalized, p_limit: SEARCH_LIMIT });
  if (error) throw error;

  type SearchRow = {
    out_catalog_item_id: string;
    out_canonical_name: string;
    out_brand: string | null;
    out_base_unit: BaseUnit;
    out_default_pack_size: number | null;
    out_category_id: string;
    out_last_purchased_at: string | null;
    out_last_qty_base: number;
    out_score: number;
  };

  return ((data ?? []) as SearchRow[]).map((r) => ({
    catalogItemId: r.out_catalog_item_id as string,
    canonicalName: r.out_canonical_name as string,
    brand: r.out_brand as string | null,
    baseUnit: r.out_base_unit as BaseUnit,
    defaultPackSize: r.out_default_pack_size as number | null,
    categoryId: r.out_category_id as string,
    lastPurchasedAt: r.out_last_purchased_at as string | null,
    lastQtyBase: r.out_last_qty_base as number,
    score: r.out_score as number,
  }));
}
