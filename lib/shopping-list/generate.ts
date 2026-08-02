import 'server-only';
import { createRequestClient } from '@/lib/supabase/server';
import { getCurrentHouseholdId } from '@/lib/household';
import { getPlanItems, getDueSoonItems } from '@/lib/plan/data';
import { formatCadenceBucket } from '@/lib/inventory/format';
import type { CadenceBucket } from '@/lib/predictions/types';

export type ShoppingListSource = { type: 'bucket'; bucket: CadenceBucket } | { type: 'due_in_days'; days: number };

function nameForSource(source: ShoppingListSource): string {
  if (source.type === 'bucket') return formatCadenceBucket(source.bucket);
  return `Due in ${source.days} day${source.days === 1 ? '' : 's'}`;
}

// F12: generate from any bucket, or "everything due in next N days" --
// both sources reuse E-8's getPlanItems()/getDueSoonItems() rather than
// re-deriving cadence/due-date logic. Both are additionally filtered to
// planState==='pending' (getDueSoonItems already does this internally;
// the bucket source does it here) -- an item the user snoozed/skipped/
// excluded on /plan must not silently reappear on a generated list.
export async function generateShoppingList(source: ShoppingListSource): Promise<{ id: string }> {
  const householdId = await getCurrentHouseholdId();
  const supabase = await createRequestClient();

  const candidates =
    source.type === 'bucket' ? (await getPlanItems()).filter((i) => i.cadenceBucket === source.bucket && i.planState === 'pending') : await getDueSoonItems(source.days);

  // Generating replaces, never appends -- no unique constraint exists on
  // (shopping_list_id, catalog_item_id), so appending risks duplicate rows.
  const { error: archiveError } = await supabase.from('shopping_lists').update({ status: 'archived' }).eq('household_id', householdId).eq('status', 'active');
  if (archiveError) throw archiveError;

  const { data: list, error: listError } = await supabase
    .from('shopping_lists')
    .insert({ household_id: householdId, name: nameForSource(source), status: 'active' })
    .select('id')
    .single();
  if (listError) throw listError;

  if (candidates.length > 0) {
    const rows = candidates.map((item) => ({
      household_id: householdId,
      shopping_list_id: list.id as string,
      catalog_item_id: item.id,
      qty_base: item.suggestedQtyBase,
      checked: false,
    }));
    const { error: itemsError } = await supabase.from('shopping_list_items').insert(rows);
    if (itemsError) throw itemsError;
  }

  return { id: list.id as string };
}
