import 'server-only';
import { createRequestClient } from '@/lib/supabase/server';
import { getCurrentHouseholdId } from '@/lib/household';
import { SHOPPING_PRESETS } from '@/lib/onboarding/presets';

export type StapleItem = {
  id: string;
  canonical_name: string;
  brand: string | null;
  base_unit: string;
  default_pack_size: number | null;
};

export async function getHousehold() {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();
  const { data, error } = await supabase
    .from('households')
    .select('id, name, monthly_budget, onboarded_at, notify_email')
    .eq('id', householdId)
    .single();
  if (error) throw error;
  return data;
}

export async function getStapleItems(): Promise<StapleItem[]> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();
  const { data, error } = await supabase
    .from('catalog_items')
    .select('id, canonical_name, brand, base_unit, default_pack_size')
    .eq('household_id', householdId)
    .eq('is_staple', true)
    .order('canonical_name');
  if (error) throw error;
  return data ?? [];
}

// Applies the chosen presets (is_staple = true on every catalog_item in
// their mapped categories) for the prediction engine's cold-start priors.
// Deliberately does NOT return the resulting item set — the tick-off list
// shown in step 3 is a fixed snapshot taken before this runs (working spec
// F1: "~40 common household items", a short list, not everything a broad
// preset like "weekly grocery run" touches). Presets map to top-level
// category slugs; catalog_items.category_id points at the leaf category,
// so this resolves top -> leaf -> items in two queries rather than a raw
// SQL join.
export async function applyPresets(presetIds: string[]): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  const supabase = await createRequestClient();

  const topSlugs = [...new Set(presetIds.flatMap((id) => SHOPPING_PRESETS.find((p) => p.id === id)?.categorySlugs ?? []))];

  if (topSlugs.length > 0) {
    const { data: topCategories, error: topError } = await supabase
      .from('categories')
      .select('id')
      .in('slug', topSlugs)
      .is('parent_id', null);
    if (topError) throw topError;
    const topIds = (topCategories ?? []).map((c) => c.id);

    if (topIds.length > 0) {
      const { data: leafCategories, error: leafError } = await supabase
        .from('categories')
        .select('id')
        .in('parent_id', topIds);
      if (leafError) throw leafError;
      const leafIds = (leafCategories ?? []).map((c) => c.id);

      if (leafIds.length > 0) {
        const { error: updateError } = await supabase
          .from('catalog_items')
          .update({ is_staple: true })
          .eq('household_id', householdId)
          .in('category_id', leafIds);
        if (updateError) throw updateError;
      }
    }
  }
}

export async function completeOnboarding(name: string, monthlyBudget: number | null, tickedItemIds: string[]) {
  const householdId = await getCurrentHouseholdId();
  const supabase = await createRequestClient();
  const now = new Date().toISOString();

  if (tickedItemIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from('catalog_items')
      .select('id, default_pack_size')
      .eq('household_id', householdId)
      .in('id', tickedItemIds);
    if (itemsError) throw itemsError;

    const movements = (items ?? []).map((item) => ({
      household_id: householdId,
      catalog_item_id: item.id,
      type: 'initial' as const,
      qty_base: item.default_pack_size ?? 1,
      occurred_at: now,
    }));

    if (movements.length > 0) {
      const { error: insertError } = await supabase.from('stock_movements').insert(movements);
      if (insertError) throw insertError;
    }
  }

  // stock_epoch and onboarded_at share `now` with the movements above so
  // occurred_at >= stock_epoch holds exactly (ADR-0001) — updates the
  // household row create_household_for_user() (S-57) already created at
  // signup, never inserts a new one here.
  const { error: householdError } = await supabase
    .from('households')
    .update({ name, monthly_budget: monthlyBudget, stock_epoch: now, onboarded_at: now })
    .eq('id', householdId);
  if (householdError) throw householdError;
}
