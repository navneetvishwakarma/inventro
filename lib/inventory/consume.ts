import 'server-only';
import { createRequestClient } from '@/lib/supabase/server';
import { getCurrentHouseholdId } from '@/lib/household';
import { getInventoryItem } from './data';
import { recomputeOneItem } from '@/lib/predictions/recompute';

export type ConsumeAction =
  | { kind: 'used_up' }
  | { kind: 'wasted' }
  | { kind: 'used_some_fraction'; fraction: 0.25 | 0.5 | 0.75 }
  | { kind: 'used_some_amount'; amountBase: number };

export type ConsumeResult = { wrote: true } | { wrote: false; reason: 'nothing_to_log' };

// F9.1's explicit consumption loop. Reads current stock through
// getInventoryItem (the SAME rawStockBase/virtualStockBase S-19 displays --
// deliberately not a second, parallel stock computation) so what the user
// taps against is exactly what they were shown.
export async function recordConsumption(catalogItemId: string, action: ConsumeAction): Promise<ConsumeResult> {
  const item = await getInventoryItem(catalogItemId);
  if (!item) throw new Error(`catalog item ${catalogItemId} not found`);

  const movementType = action.kind === 'wasted' ? 'waste' : 'consumption';

  let requestedAmount: number;
  if (action.kind === 'used_up' || action.kind === 'wasted') {
    requestedAmount = item.rawStockBase;
  } else if (action.kind === 'used_some_fraction') {
    // Fraction applies to the DISPLAYED virtual stock (what the user is
    // looking at when they tap 25/50/75%), not raw stock -- sub-S-20.json.
    requestedAmount = action.fraction * item.virtualStockBase;
  } else {
    requestedAmount = action.amountBase;
  }

  // Clamp to raw stock (never drive the ledger negative) and skip entirely
  // if there's nothing to write -- covers "used it up" tapped twice in a
  // row (second tap reads rawStockBase=0 post-revalidate) and any
  // fraction/amount that rounds to <=0. This does not fully close a true
  // concurrent double-submit race (two in-flight requests can both read the
  // same pre-write rawStockBase before either commits) -- that residual
  // risk is accepted and documented rather than silently assumed away; see
  // .claude/epic-7/ledger.md.
  const amount = Math.min(Math.max(requestedAmount, 0), item.rawStockBase);
  if (amount <= 0) return { wrote: false, reason: 'nothing_to_log' };

  const householdId = await getCurrentHouseholdId();
  const supabase = await createRequestClient();
  const { error } = await supabase
    .from('stock_movements')
    .insert({
      household_id: householdId,
      catalog_item_id: catalogItemId,
      type: movementType,
      qty_base: -amount,
      occurred_at: new Date().toISOString(),
    });
  if (error) throw error;

  // No rateCorrectionOverride -- S-15's reconciliation is purchase-commit-only
  // per its own invariants and must never be reached from a consumption action.
  await recomputeOneItem(catalogItemId, householdId);
  return { wrote: true };
}
