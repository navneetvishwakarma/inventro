import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

// Request-scoped client (S-57/ADR-0006): runs queries as the signed-in
// user's `authenticated` role via their session cookies, so RLS (S-60)
// actually applies -- the opposite of createServiceClient() above, which
// always bypasses RLS. SUPABASE_ANON_KEY is deliberately NOT the
// NEXT_PUBLIC_-prefixed var -- this client is only ever constructed in
// Server Actions/Route Handlers/Server Components, never in a 'use client'
// file, so the anon key never needs to ship to the browser.
export async function createRequestClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY must be set');
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render, where cookies() is
          // read-only -- proxy.ts's session check on the next request is
          // what actually refreshes the session cookie in that case.
        }
      },
    },
  });
}
