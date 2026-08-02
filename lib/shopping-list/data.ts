import 'server-only';
import { createRequestClient } from '@/lib/supabase/server';
import { getCurrentHouseholdId } from '@/lib/household';
import type { BaseUnit } from '@/lib/receipts/canonicalize';

export type ShoppingListItem = {
  id: string;
  catalogItemId: string;
  canonicalName: string;
  brand: string | null;
  baseUnit: BaseUnit;
  defaultPackSize: number | null;
  qtyBase: number | null;
  checked: boolean;
  // S-24: null until log_shopping_list_purchase() has actually written a
  // purchase for this row -- distinct from `checked`, which a user can
  // toggle back and forth without ever touching the ledger (ADR-0001).
  purchaseLoggedAt: string | null;
  loggedPrice: number | null;
};

export type ShoppingList = {
  id: string;
  name: string | null;
  createdAt: string;
  items: ShoppingListItem[];
};

type ShoppingListItemRow = {
  id: string;
  catalog_item_id: string;
  qty_base: number | null;
  checked: boolean;
  purchase_logged_at: string | null;
  logged_price: number | null;
  catalog_items: {
    canonical_name: string;
    brand: string | null;
    base_unit: BaseUnit;
    default_pack_size: number | null;
  } | null;
};

// F12: the household's single current list (at most one status='active'
// row -- generateShoppingList() enforces that by archiving any prior
// active list before inserting a new one). Joined with catalog_items so
// display/export never need a second round trip per item.
export async function getActiveShoppingList(): Promise<ShoppingList | null> {
  const householdId = await getCurrentHouseholdId();
  const supabase = await createRequestClient();

  const { data: list, error: listError } = await supabase
    .from('shopping_lists')
    .select('id, name, created_at')
    .eq('household_id', householdId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (listError) throw listError;
  if (!list) return null;

  const { data: itemRows, error: itemsError } = await supabase
    .from('shopping_list_items')
    .select('id, catalog_item_id, qty_base, checked, purchase_logged_at, logged_price, catalog_items(canonical_name, brand, base_unit, default_pack_size)')
    .eq('shopping_list_id', list.id);
  if (itemsError) throw itemsError;

  const items = ((itemRows ?? []) as unknown as ShoppingListItemRow[])
    .filter((row) => row.catalog_items !== null)
    .map((row) => ({
      id: row.id,
      catalogItemId: row.catalog_item_id,
      canonicalName: row.catalog_items!.canonical_name,
      brand: row.catalog_items!.brand,
      baseUnit: row.catalog_items!.base_unit,
      defaultPackSize: row.catalog_items!.default_pack_size,
      qtyBase: row.qty_base,
      checked: row.checked,
      purchaseLoggedAt: row.purchase_logged_at,
      loggedPrice: row.logged_price,
    }))
    .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));

  return { id: list.id as string, name: list.name as string | null, createdAt: list.created_at as string, items };
}
