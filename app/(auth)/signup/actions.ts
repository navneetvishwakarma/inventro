'use server';

import { redirect } from 'next/navigation';
import { createRequestClient } from '@/lib/supabase/server';

export type SignupResult = { ok: true } | { ok: false; error: string };

export async function signupAction(_prevState: SignupResult | null, formData: FormData): Promise<SignupResult> {
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { ok: false, error: 'Email and password are required.' };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: 'Passwords do not match.' };
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
    return { ok: false, error: GENERIC_SIGNUP_ERROR };
  }

  redirect('/onboarding');
}
