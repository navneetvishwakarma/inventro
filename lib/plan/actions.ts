import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getDefaultHouseholdId } from '@/lib/household';
import { toKolkataDateString } from '@/lib/date';
import type { CadenceBucket } from '@/lib/predictions/types';

// item_stats.cadence_override -- excluded from recompute.ts's upsert payload
// by construction since E-5, so this is the only write path that ever
// touches it. null reverts to the computed cadence_bucket (A9's "revert to
// auto").
export async function setCadenceOverride(catalogItemId: string, bucket: CadenceBucket | null): Promise<void> {
  const householdId = getDefaultHouseholdId();
  const supabase = createServiceClient();
  const { error } = await supabase.from('item_stats').update({ cadence_override: bucket }).eq('catalog_item_id', catalogItemId).eq('household_id', householdId);
  if (error) throw error;
}

type PlanEntryPatch = {
  state: 'pending' | 'snoozed' | 'skipped' | 'excluded';
  snoozed_until: string | null;
  due_date: string | null; // 'YYYY-MM-DD' -- only meaningful for 'skipped' (the skip-expiry anchor)
};

async function upsertPlanEntry(catalogItemId: string, patch: PlanEntryPatch): Promise<void> {
  const householdId = getDefaultHouseholdId();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('plan_entries')
    .upsert({ household_id: householdId, catalog_item_id: catalogItemId, ...patch }, { onConflict: 'household_id,catalog_item_id' });
  if (error) throw error;
}

export async function snoozeItem(catalogItemId: string, days: 3 | 7 | 14): Promise<void> {
  const snoozedUntil = new Date(Date.now() + days * 86_400_000).toISOString();
  await upsertPlanEntry(catalogItemId, { state: 'snoozed', snoozed_until: snoozedUntil, due_date: null });
}

export async function unsnoozeItem(catalogItemId: string): Promise<void> {
  await upsertPlanEntry(catalogItemId, { state: 'pending', snoozed_until: null, due_date: null });
}

// Stamps the item's CURRENT predicted due date as the skip anchor -- read
// fresh here, not passed in by the caller, so the anchor always reflects
// reality at the moment of the click. getPlanItems()'s resolvePlanState
// auto-expires this once a later re-estimate pushes the due date forward
// (a new cycle), never on a date that merely moved earlier.
export async function skipOnce(catalogItemId: string): Promise<void> {
  const householdId = getDefaultHouseholdId();
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('item_stats').select('predicted_next_purchase_at').eq('catalog_item_id', catalogItemId).eq('household_id', householdId).maybeSingle();
  if (error) throw error;

  const dueDate = (data?.predicted_next_purchase_at ?? null) as string | null;
  await upsertPlanEntry(catalogItemId, { state: 'skipped', snoozed_until: null, due_date: dueDate !== null ? toKolkataDateString(dueDate) : null });
}

export async function undoSkip(catalogItemId: string): Promise<void> {
  await upsertPlanEntry(catalogItemId, { state: 'pending', snoozed_until: null, due_date: null });
}

export async function excludeItem(catalogItemId: string): Promise<void> {
  await upsertPlanEntry(catalogItemId, { state: 'excluded', snoozed_until: null, due_date: null });
}

export async function includeItem(catalogItemId: string): Promise<void> {
  await upsertPlanEntry(catalogItemId, { state: 'pending', snoozed_until: null, due_date: null });
}

// S-24: a purchase just happened for this item (logged via a shopping-list
// checkoff), so any active 'snoozed'/'skipped' suppression is moot -- the
// user no longer needs to be reminded to buy something they just bought.
// 'excluded' is left untouched: that is a deliberate, stronger "never plan
// this item" signal a stray purchase log must not silently override.
export async function resetSuppressionAfterPurchase(catalogItemId: string): Promise<void> {
  const householdId = getDefaultHouseholdId();
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('plan_entries').select('state').eq('household_id', householdId).eq('catalog_item_id', catalogItemId).maybeSingle();
  if (error) throw error;
  if (!data || data.state === 'excluded' || data.state === 'pending') return;
  await upsertPlanEntry(catalogItemId, { state: 'pending', snoozed_until: null, due_date: null });
}
