import 'server-only';
import { createRequestClient } from '@/lib/supabase/server';
import { getCurrentHouseholdId } from '@/lib/household';
import { recomputeOneItem } from '@/lib/predictions/recompute';
import type { BaseUnit } from '@/lib/receipts/canonicalize';

export type CatalogManagerItem = {
  id: string;
  canonicalName: string;
  brand: string | null;
  categoryId: string;
  categoryName: string;
  baseUnit: BaseUnit;
  isStaple: boolean;
  isArchived: boolean;
  aliasCount: number;
  lastPurchasedAt: string | null;
};

// S-30: deliberately NOT a reuse of getInventoryItems() (lib/inventory/data.ts),
// which hard-filters is_archived=false -- this screen's entire unarchive
// path requires archived rows to be visible, and it doesn't need
// getInventoryItems()'s stock/prediction joins. A lean, separate query.
//
// Deliberately does NOT fetch stock_movements household-wide to derive a
// per-item movement count the way an earlier draft did (advisor-caught,
// epic gate review): PostgREST's default 1000-row cap makes that the exact
// bug class lib/inventory/data.ts's price_history query already guards
// against (S-18's live incident) -- a household with enough purchase
// history would silently truncate and undercount. Movement counts are only
// ever needed bounded to two items at a time (getMergePreview, below),
// which the acceptance criteria actually require; the full list doesn't.
export async function getCatalogManagerItems(): Promise<CatalogManagerItem[]> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();

  const [itemsRes, aliasesRes, statsRes] = await Promise.all([
    supabase.from('catalog_items').select('id, canonical_name, brand, category_id, base_unit, is_staple, is_archived, categories(name)').eq('household_id', householdId),
    supabase.from('item_aliases').select('catalog_item_id').eq('household_id', householdId),
    supabase.from('item_stats').select('catalog_item_id, last_purchased_at').eq('household_id', householdId),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (aliasesRes.error) throw aliasesRes.error;
  if (statsRes.error) throw statsRes.error;

  const aliasCountByItem = new Map<string, number>();
  for (const a of aliasesRes.data ?? []) aliasCountByItem.set(a.catalog_item_id as string, (aliasCountByItem.get(a.catalog_item_id as string) ?? 0) + 1);

  const lastPurchasedByItem = new Map((statsRes.data ?? []).map((s) => [s.catalog_item_id as string, s.last_purchased_at as string | null]));

  return (itemsRes.data ?? []).map((item) => {
    const categoryRow = item.categories as unknown as { name: string } | { name: string }[] | null;
    const categoryName = Array.isArray(categoryRow) ? (categoryRow[0]?.name ?? 'Uncategorized') : (categoryRow?.name ?? 'Uncategorized');
    return {
      id: item.id as string,
      canonicalName: item.canonical_name as string,
      brand: item.brand as string | null,
      categoryId: item.category_id as string,
      categoryName,
      baseUnit: item.base_unit as BaseUnit,
      isStaple: item.is_staple as boolean,
      isArchived: item.is_archived as boolean,
      aliasCount: aliasCountByItem.get(item.id as string) ?? 0,
      lastPurchasedAt: lastPurchasedByItem.get(item.id as string) ?? null,
    };
  });
}

export type MergePreview = {
  itemAId: string;
  itemAAliasCount: number;
  itemAMovementCount: number;
  itemBId: string;
  itemBAliasCount: number;
  itemBMovementCount: number;
};

// UX journey doc's explicit friction point: merge must show a low-risk
// preview ("combine N purchases and M aliases") before the user commits.
export async function getMergePreview(itemAId: string, itemBId: string): Promise<MergePreview> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();

  const [aliasesRes, movementsRes] = await Promise.all([
    supabase.from('item_aliases').select('catalog_item_id').eq('household_id', householdId).in('catalog_item_id', [itemAId, itemBId]),
    supabase.from('stock_movements').select('catalog_item_id').eq('household_id', householdId).in('catalog_item_id', [itemAId, itemBId]),
  ]);
  if (aliasesRes.error) throw aliasesRes.error;
  if (movementsRes.error) throw movementsRes.error;

  const countFor = (rows: { catalog_item_id: string }[], id: string) => rows.filter((r) => r.catalog_item_id === id).length;

  return {
    itemAId,
    itemAAliasCount: countFor(aliasesRes.data ?? [], itemAId),
    itemAMovementCount: countFor(movementsRes.data ?? [], itemAId),
    itemBId,
    itemBAliasCount: countFor(aliasesRes.data ?? [], itemBId),
    itemBMovementCount: countFor(movementsRes.data ?? [], itemBId),
  };
}

export type MergeResult = { survivorId: string; reassignedMovements: number; reassignedAliases: number };

// Reassigns everything via the atomic merge_catalog_items() RPC, then
// recomputes the survivor from its now-combined stock_movements history --
// the UX doc's explicit edge case ("recomputed stats after merge should
// reflect the combined interval history, not just the survivor's").
// recomputeOneItem no-ops if there are zero purchase events; purchase_count
// is already handled inside the RPC itself (see its own comment) since
// recompute structurally cannot derive it.
export async function mergeCatalogItems(survivorId: string, loserId: string): Promise<MergeResult> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();

  const { data, error } = await supabase.rpc('merge_catalog_items', { p_household_id: householdId, p_survivor_id: survivorId, p_loser_id: loserId }).single();
  if (error) throw error;

  const result = data as { out_survivor_id: string; out_reassigned_movements: number; out_reassigned_aliases: number };
  await recomputeOneItem(result.out_survivor_id, householdId);

  return { survivorId: result.out_survivor_id, reassignedMovements: result.out_reassigned_movements, reassignedAliases: result.out_reassigned_aliases };
}

export async function archiveItem(catalogItemId: string, archived: boolean): Promise<void> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();
  const { error } = await supabase.from('catalog_items').update({ is_archived: archived }).eq('id', catalogItemId).eq('household_id', householdId);
  if (error) throw error;
}

// Updates category_id ONLY -- base_unit is never touched (S-09's sticky-unit
// invariant: existing stock_movements.qty_base values were recorded against
// the item's CURRENT base_unit, so changing it would silently corrupt every
// historical quantity). Rejects 'uncategorized' server-side, same backstop
// posture as log_manual_purchase's own guard (S-29).
export async function recategorizeItem(catalogItemId: string, categorySlug: string): Promise<void> {
  if (categorySlug === 'uncategorized') {
    throw new Error('an item must have a real category, not uncategorized');
  }

  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();

  const { data: category, error: categoryError } = await supabase.from('categories').select('id').eq('slug', categorySlug).not('parent_id', 'is', null).single();
  if (categoryError || !category) throw categoryError ?? new Error(`unresolved category_slug ${categorySlug}`);

  const { error } = await supabase.from('catalog_items').update({ category_id: category.id }).eq('id', catalogItemId).eq('household_id', householdId);
  if (error) throw error;
}
