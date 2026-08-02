import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestClient } from '@/lib/supabase/server';

export function getDefaultHouseholdId(): string {
  const id = process.env.DEFAULT_HOUSEHOLD_ID;
  if (!id) throw new Error('DEFAULT_HOUSEHOLD_ID must be set');
  return id;
}

// S-57/S-61/ADR-0006: session-derived household lookup, replacing
// getDefaultHouseholdId() call site by call site (S-62/S-63/S-64) until
// the static env-var getter above is deleted entirely (S-65). Built ahead
// of S-61's original schedule because S-57's signup -> onboarding redirect
// cannot work correctly against a static DEFAULT_HOUSEHOLD_ID -- a freshly
// signed-up user's onboarding data would otherwise land on the wrong
// (old, single-tenant) household.
export async function getCurrentHouseholdId(): Promise<string> {
  const supabase = await createRequestClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('getCurrentHouseholdId called with no authenticated session');

  const { data, error } = await supabase.from('household_members').select('household_id').eq('user_id', user.id).single();
  if (error || !data) throw new Error('getCurrentHouseholdId: no household_members row for user ' + user.id);
  return data.household_id;
}

// S-63/ADR-0006: a handful of read functions (getInventoryItems,
// getPlanItems, getDueSoonItems) are shared between real user requests
// (default: request-scoped, session-derived) and the digest cron routes
// (which legitimately enumerate every household, no user session --
// pass an explicit override sourced from createServiceClient()). Centralizes
// the "default to the request-scoped session, allow an explicit override"
// shape so it isn't reimplemented per function.
export type HouseholdContext = { supabase: SupabaseClient; householdId: string };

export async function resolveHouseholdContext(override?: HouseholdContext): Promise<HouseholdContext> {
  if (override) return override;
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();
  return { supabase, householdId };
}
