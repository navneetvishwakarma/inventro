import 'server-only';
import { createRequestClient } from '@/lib/supabase/server';
import { getCurrentHouseholdId } from '@/lib/household';
import { normalizeText, normalizeUnitToBase, matchCatalogItem, type BaseUnit } from '@/lib/receipts/canonicalize';
import { recomputeOneItem } from '@/lib/predictions/recompute';

export type ManualPurchaseResult = { catalogItemId: string; createdNew: boolean };

// S-29: the "two taps" path -- item already resolved via search_catalog_items
// (lib/catalog/search.ts), qtyBase already prefilled from that same RPC's
// last_qty_base. No matching ladder involved: the human already picked this
// exact catalog item from a list, there is nothing left to disambiguate.
export async function logExistingItemPurchase(catalogItemId: string, qtyBase: number, unitPrice: number | null, occurredAt: string): Promise<ManualPurchaseResult> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();

  const { data, error } = await supabase
    .rpc('log_manual_purchase', {
      p_household_id: householdId,
      p_catalog_item_id: catalogItemId,
      p_new_item_name: null,
      p_new_item_brand: null,
      p_new_item_category_slug: null,
      p_raw_text: null,
      p_qty_base: qtyBase,
      p_unit_price: unitPrice,
      p_occurred_at: occurredAt,
    })
    .single();
  if (error) throw error;

  const result = data as { out_catalog_item_id: string; out_created_new: boolean };
  await recomputeOneItem(result.out_catalog_item_id, householdId);
  return { catalogItemId: result.out_catalog_item_id, createdNew: result.out_created_new };
}

export type DuplicateCheckResult = { likelyDuplicate: true; existingItemId: string; existingName: string } | { likelyDuplicate: false };

// S-29's reuse of S-09's ladder: before creating a "new" catalog item, run
// the exact same matchCatalogItem() the receipt pipeline uses. A >=0.62
// (state='matched') hit means the ladder already considers this the same
// product as something that exists -- block creation rather than let manual
// entry become a second, drifting source of duplicate catalog_items. A
// 'needs_review' or 'new_item' result proceeds: the user has already seen
// live search results before choosing "Add as new item", so this band is a
// legitimate proceedable case, not a silently-skipped ambiguity.
export async function checkForDuplicate(name: string, brand: string | null): Promise<DuplicateCheckResult> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();
  const normalized = normalizeText(`${brand ? `${brand} ` : ''}${name}`);

  const match = await matchCatalogItem(supabase, householdId, normalized);
  if (match.state !== 'matched') return { likelyDuplicate: false };

  const { data: existing, error } = await supabase.from('catalog_items').select('canonical_name').eq('id', match.matchedItemId).single();
  if (error) throw error;

  return { likelyDuplicate: true, existingItemId: match.matchedItemId, existingName: existing.canonical_name as string };
}

export type NewItemInput = {
  name: string;
  brand: string | null;
  categorySlug: string;
  qtyDisplay: string;
  unitDisplay: string;
  unitPrice: number | null;
  occurredAt: string;
};

// New-item path: resolves the category's default_base_unit (same source of
// truth commit_receipt() uses for new_item receipt lines), converts the
// user's typed qty+unit via S-10's own normalizeUnitToBase() -- zero new
// unit-parsing logic -- then writes through the same RPC as the
// existing-item path. Callers MUST run checkForDuplicate() first; this
// function does not re-check (kept as two explicit steps so the UI can show
// the duplicate warning before committing to the create flow).
export async function createNewItemAndLogPurchase(input: NewItemInput): Promise<ManualPurchaseResult> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();

  const { data: category, error: categoryError } = await supabase.from('categories').select('default_base_unit').eq('slug', input.categorySlug).not('parent_id', 'is', null).single();
  if (categoryError || !category) throw categoryError ?? new Error(`unresolved category_slug ${input.categorySlug}`);

  const { qtyBase } = normalizeUnitToBase(input.qtyDisplay, input.unitDisplay, null, category.default_base_unit as BaseUnit);
  const rawText = normalizeText(`${input.brand ? `${input.brand} ` : ''}${input.name}`) === '' ? input.name : `${input.brand ? `${input.brand} ` : ''}${input.name}`;

  const { data, error } = await supabase
    .rpc('log_manual_purchase', {
      p_household_id: householdId,
      p_catalog_item_id: null,
      p_new_item_name: input.name,
      p_new_item_brand: input.brand,
      p_new_item_category_slug: input.categorySlug,
      p_raw_text: rawText,
      p_qty_base: qtyBase,
      p_unit_price: input.unitPrice,
      p_occurred_at: input.occurredAt,
    })
    .single();
  if (error) throw error;

  const result = data as { out_catalog_item_id: string; out_created_new: boolean };
  await recomputeOneItem(result.out_catalog_item_id, householdId);
  return { catalogItemId: result.out_catalog_item_id, createdNew: result.out_created_new };
}
