import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getDefaultHouseholdId } from '@/lib/household';
import { recomputeOneItem } from '@/lib/predictions/recompute';
import { resetSuppressionAfterPurchase } from '@/lib/plan/actions';

// Column names match the RPC's RETURNS TABLE(out_*) -- deliberately not
// catalog_item_id/household_id, which plpgsql would implicitly declare as
// in-scope variables inside the function body and collide with the real
// columns of the same name (migration 20260730120000's fix, caught by this
// story's own live-Supabase verification run).
type LogPurchaseResult = { out_catalog_item_id: string; out_household_id: string; out_already_logged: boolean };

// S-24: the no-price cross-off path -- a plain checked-column update, no
// ledger write. Used both for plain checking off and for unchecking
// (checked=false never touches purchase_logged_at/logged_price, so a
// logged purchase stays logged even if the box is later unchecked --
// ADR-0001, history is never reversed by a list-crossing-off toggle).
export async function setChecked(shoppingListItemId: string, checked: boolean): Promise<void> {
  const householdId = getDefaultHouseholdId();
  const { error } = await createServiceClient().from('shopping_list_items').update({ checked }).eq('id', shoppingListItemId).eq('household_id', householdId);
  if (error) throw error;
}

// S-24: checking an item off WITH a price -- writes a real stock_movements
// purchase row + price_history + item_stats bump via the atomic, race-safe
// log_shopping_list_purchase() RPC (migration 20260730110000), then
// recomputes just this item. No rateCorrectionOverride is ever passed --
// S-15's reconciliation stays receipt-commit-only by its own invariants,
// the same reasoning lib/inventory/consume.ts's recordConsumption already
// established for consumption movements. Only recomputes/resets
// suppression when the RPC actually wrote (already_logged=false) -- a
// repeat call (double-click) is a pure no-op past the RPC's own guard.
export async function logShoppingListPurchase(shoppingListItemId: string, unitPrice: number): Promise<void> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('log_shopping_list_purchase', { p_shopping_list_item_id: shoppingListItemId, p_unit_price: unitPrice }).single();
  if (error) throw error;

  const result = data as LogPurchaseResult;
  if (result.out_already_logged) return;

  await recomputeOneItem(result.out_catalog_item_id, result.out_household_id);
  await resetSuppressionAfterPurchase(result.out_catalog_item_id);
}
