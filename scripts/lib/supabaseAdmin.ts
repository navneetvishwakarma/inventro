// Shared by scripts/seed-history.ts and scripts/validate-predictions.ts.
// Deliberately does NOT import lib/supabase/server.ts -- that file imports
// 'server-only', which throws when loaded outside a bundler's react-server
// condition (i.e. under plain tsx/node), per repo convention for scripts
// (AGENTS.md).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Minimal .env.local loader -- no new dependency (dotenv is only reachable
// transitively, not a declared package.json dependency). Strips \r so a
// Windows CRLF checkout never leaves a trailing carriage return baked into
// a secret (would otherwise surface as phantom 401s against Supabase).
export function loadEnvLocal(): void {
  let raw: string;
  try {
    raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  } catch {
    return; // no .env.local -- fall through to whatever's already in process.env
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.replace(/\r$/, '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set (check .env.local)');
  return createClient(url, key, { auth: { persistSession: false } });
}

// Fixed constant, never derived at runtime -- one typo away from pointing
// at the real household is exactly the failure mode the write guard below
// exists to catch even if this constant were ever wrong.
export const DEMO_HOUSEHOLD_ID = '11111111-1111-1111-1111-111111111111';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

// Working spec Sec12: "writes only to a household flagged is_demo = true."
// Re-reads the row fresh (never trusts a cached in-memory flag) and refuses
// to proceed if it isn't the demo household -- called before every write
// path (seed and --wipe alike), not just once at startup.
export async function assertDemoHousehold(supabase: SupabaseAdmin): Promise<void> {
  const defaultHouseholdId = process.env.DEFAULT_HOUSEHOLD_ID;
  if (!defaultHouseholdId) throw new Error('DEFAULT_HOUSEHOLD_ID must be set (check .env.local)');
  if (DEMO_HOUSEHOLD_ID === defaultHouseholdId) {
    throw new Error('DEMO_HOUSEHOLD_ID must not equal DEFAULT_HOUSEHOLD_ID -- refusing to write');
  }

  const { data, error } = await supabase.from('households').select('id, is_demo').eq('id', DEMO_HOUSEHOLD_ID).maybeSingle();
  if (error) throw error;
  if (data && data.is_demo !== true) {
    throw new Error(`Household ${DEMO_HOUSEHOLD_ID} exists but is_demo is not true -- refusing to write`);
  }
  // data === null (household not created yet) is fine -- the seeder creates
  // it with is_demo=true in the same run this guard gates.
}
