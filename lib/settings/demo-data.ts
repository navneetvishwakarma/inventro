import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentHouseholdId } from '@/lib/household';

// Mirrors scripts/lib/supabaseAdmin.ts's own DEMO_HOUSEHOLD_ID literal --
// kept as a second copy rather than a shared import, because that module
// has no 'server-only' boundary and runs under plain tsx (npm run
// seed:history / validate:predictions outside Next.js); importing this
// server-only module into it would break both scripts at runtime, and this
// repo has no test suite to catch that. A fixed UUID, effectively never
// changes -- if it ever needs to, update both copies together.
export const DEMO_HOUSEHOLD_ID = '11111111-1111-1111-1111-111111111111';

export type WipeResult = { wiped: true } | { wiped: false; reason: string };

// Same table set and FK-safe (children-before-parents) order as
// scripts/seed-history.ts's own wipeDemoData(), now reachable from Settings
// instead of only a CLI script. Leaves the households row itself intact
// (is_demo stays true) so `npm run seed:history` can reseed afterward,
// matching the script's own upsert-not-recreate behavior.
// S-64/ADR-0006: deliberately stays on the service-role client, a third
// documented exception beyond cron/the seeder. This function always
// operates on the fixed DEMO_HOUSEHOLD_ID -- a household the calling user
// does not belong to -- so a request-scoped client would get denied by
// RLS (correctly) rather than doing anything useful. Known, accepted
// residual exposure: wipeDemoDataAction (app/(app)/settings/actions.ts)
// is reachable by ANY authenticated user, not just whoever seeded the
// demo household -- low severity, since the target is regenerable
// synthetic validation fixture data (npm run seed:history), never a real
// tenant's own data, but recorded here rather than silently carried
// forward now that "any authenticated user" means more than one person.
export async function wipeDemoHouseholdData(): Promise<WipeResult> {
  // Hard-pinned target -- this function takes no caller-supplied household
  // id, so there is no code path by which a real household could be
  // targeted. Belt-and-suspenders assertion anyway, since the two are only
  // guaranteed distinct by convention, not by a DB constraint.
  if (DEMO_HOUSEHOLD_ID === (await getCurrentHouseholdId())) {
    throw new Error('DEMO_HOUSEHOLD_ID must not equal the caller\'s own household id -- refusing to wipe');
  }

  const supabase = createServiceClient();

  // Re-checked at runtime, not just pinned by UUID -- enforces the
  // acceptance clause literally ("only touches is_demo-flagged rows"),
  // same guard scripts/lib/supabaseAdmin.ts's assertDemoHousehold applies.
  const { data: household, error: householdError } = await supabase.from('households').select('id, is_demo').eq('id', DEMO_HOUSEHOLD_ID).maybeSingle();
  if (householdError) throw householdError;
  if (!household) return { wiped: false, reason: 'Demo household does not exist yet -- nothing to wipe' };
  if (!household.is_demo) throw new Error(`Household ${DEMO_HOUSEHOLD_ID} exists but is_demo is not true -- refusing to wipe`);

  const { error: historyErr } = await supabase.from('item_stats_history').delete().eq('household_id', DEMO_HOUSEHOLD_ID);
  if (historyErr) throw historyErr;
  const { error: statsErr } = await supabase.from('item_stats').delete().eq('household_id', DEMO_HOUSEHOLD_ID);
  if (statsErr) throw statsErr;
  const { error: priceErr } = await supabase.from('price_history').delete().eq('household_id', DEMO_HOUSEHOLD_ID);
  if (priceErr) throw priceErr;
  const { error: movementsErr } = await supabase.from('stock_movements').delete().eq('household_id', DEMO_HOUSEHOLD_ID);
  if (movementsErr) throw movementsErr;
  const { error: aliasesErr } = await supabase.from('item_aliases').delete().eq('household_id', DEMO_HOUSEHOLD_ID);
  if (aliasesErr) throw aliasesErr;
  const { error: itemsErr } = await supabase.from('catalog_items').delete().eq('household_id', DEMO_HOUSEHOLD_ID);
  if (itemsErr) throw itemsErr;

  return { wiped: true };
}
