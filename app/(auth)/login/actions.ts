'use server';

import { redirect } from 'next/navigation';
import { createRequestClient } from '@/lib/supabase/server';

export type LoginResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = 'Invalid email or password.';

function safeNextPath(next: FormDataEntryValue | null): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export async function loginAction(_prevState: LoginResult | null, formData: FormData): Promise<LoginResult> {
  const email = formData.get('email');
  const password = formData.get('password');
  const next = safeNextPath(formData.get('next'));

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const supabase = await createRequestClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Deliberately identical message whether the email doesn't exist or
    // the password is wrong -- no user-enumeration signal (S-58).
    return { ok: false, error: GENERIC_ERROR };
  }

  redirect(next);
}

export async function logoutAction() {
  const supabase = await createRequestClient();
  await supabase.auth.signOut();
  redirect('/login');
}
