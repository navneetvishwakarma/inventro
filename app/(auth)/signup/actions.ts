'use server';

import { redirect } from 'next/navigation';
import { createRequestClient, createServiceClient } from '@/lib/supabase/server';

export type SignupResult = { ok: true } | { ok: false; error: string; field?: 'confirmPassword' };

export async function signupAction(_prevState: SignupResult | null, formData: FormData): Promise<SignupResult> {
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { ok: false, error: 'Email and password are required.' };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: 'Passwords do not match.', field: 'confirmPassword' };
  }

  const supabase = await createRequestClient();

  // Security-review fix: a distinguishing message here ("email already
  // registered" vs. any other failure) is a deterministic enumeration
  // oracle -- Supabase Auth returns that distinction explicitly once email
  // confirmations are disabled (S-56), unlike the obfuscated response it
  // gives with confirmations on. One generic message for every failure,
  // matching login's existing anti-enumeration design (S-58); the real
  // reason is server-logged, never returned to the client.
  const GENERIC_SIGNUP_ERROR = 'Could not create your account. Try a different email, or log in if you already have one.';

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
  if (signUpError) {
    console.error('signup: signUp failed', signUpError.message);
    return { ok: false, error: GENERIC_SIGNUP_ERROR };
  }
  if (!signUpData.session) {
    // Should not happen with email confirmations disabled (S-56) -- fail
    // loudly rather than redirecting into onboarding with no session.
    console.error('signup: signUp succeeded with no session');
    return { ok: false, error: GENERIC_SIGNUP_ERROR };
  }

  // S-57/ADR-0006: household + owner membership created via a
  // security-definer RPC (20260802091000), not a plain insert here --
  // see that migration for why (RLS-after-S-60 chicken-and-egg).
  const { error: rpcError } = await supabase.rpc('create_household_for_user', { p_household_name: 'My household' });
  if (rpcError) {
    console.error('signup: create_household_for_user RPC failed', rpcError.message);
    // Security-review follow-up: signUp and the RPC are two separate
    // round-trips with no shared transaction. Without this cleanup, an RPC
    // failure for any reason other than the duplicate-email case (already
    // handled above) would leave a real authenticated session with zero
    // household_members rows -- the session passes proxy.ts's gate, then
    // every household-scoped page throws on getCurrentHouseholdId()'s
    // .single(), with no self-serve recovery (no password reset either).
    // Compensating delete via the service-role client -- the one place in
    // this file that needs it, since signUp itself only ever returns a
    // request-scoped client and there's no user session left to clean up
    // with otherwise.
    const serviceClient = createServiceClient();
    await serviceClient.auth.admin.deleteUser(signUpData.user!.id);
    return { ok: false, error: GENERIC_SIGNUP_ERROR };
  }

  redirect('/onboarding');
}
