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

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
  if (signUpError) {
    return { ok: false, error: signUpError.message };
  }
  if (!signUpData.session) {
    // Should not happen with email confirmations disabled (S-56) -- fail
    // loudly rather than redirecting into onboarding with no session.
    return { ok: false, error: 'Could not start a session after signup. Try logging in.' };
  }

  // S-57/ADR-0006: household + owner membership created via a
  // security-definer RPC (20260802091000), not a plain insert here --
  // see that migration for why (RLS-after-S-60 chicken-and-egg).
  const { error: rpcError } = await supabase.rpc('create_household_for_user', { p_household_name: 'My household' });
  if (rpcError) {
    return { ok: false, error: 'Could not create your household: ' + rpcError.message };
  }

  redirect('/onboarding');
}
