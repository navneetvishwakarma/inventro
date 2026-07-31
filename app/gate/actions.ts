'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GATE_COOKIE_NAME, signGateCookie } from '@/lib/gate';

export async function submitPasscode(formData: FormData) {
  const passcode = formData.get('passcode');
  const expected = process.env.GATE_PASSCODE;
  const secret = process.env.GATE_COOKIE_SECRET;

  if (!expected || !secret || typeof passcode !== 'string' || passcode !== expected) {
    redirect('/gate?error=1');
  }

  const cookieStore = await cookies();
  cookieStore.set(GATE_COOKIE_NAME, await signGateCookie(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect('/');
}
