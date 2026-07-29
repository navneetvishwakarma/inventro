import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Service-role key, never sent to the browser (ADR-0004). The `server-only`
// import makes any accidental client-component import a build error rather
// than a silent leak.

export function createServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
