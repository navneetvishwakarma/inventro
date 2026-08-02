'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { loginAction, type LoginResult } from './actions';

const initialState: LoginResult = { ok: true };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <Input id="email" name="email" type="email" label="Email" placeholder="you@example.com" required autoFocus disabled={isPending} />
        <Input id="password" name="password" type="password" label="Password" required disabled={isPending} />
        {!state.ok && <Alert tone="error">{state.error}</Alert>}
        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <div className="pt-4 text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link href="/signup" className="text-link">
          Create a household
        </Link>
      </div>
    </>
  );
}
