import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestClient } from '@/lib/supabase/server';

// S-57/S-61/ADR-0006: session-derived household lookup. Replaces the old
// getDefaultHouseholdId()/DEFAULT_HOUSEHOLD_ID env-var getter (deleted in
// S-65, no fallback kept) call site by call site across E-20/E-21.
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
