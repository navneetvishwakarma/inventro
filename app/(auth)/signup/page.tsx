'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { signupAction, type SignupResult } from './actions';

const initialState: SignupResult = { ok: true };

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-sunken p-4">
      <div className="w-full max-w-[360px]">
        <Card>
          <div className="flex flex-col items-center gap-2 pb-4 text-center">
            <span className="text-lg font-semibold text-primary">Inventro</span>
            <span className="text-sm text-muted-foreground">Create a household to start tracking.</span>
          </div>
          <form action={formAction} className="flex flex-col gap-3">
            <Input id="email" name="email" type="email" label="Email" placeholder="you@example.com" required autoFocus disabled={isPending} />
            <Input id="password" name="password" type="password" label="Password" required disabled={isPending} />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm password"
              required
              disabled={isPending}
              error={!state.ok && state.field === 'confirmPassword' ? state.error : undefined}
            />
            {!state.ok && state.field !== 'confirmPassword' && <Alert tone="error">{state.error}</Alert>}
            <Button type="submit" size="lg" className="w-full" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create household'}
            </Button>
          </form>
          <div className="pt-4 text-center text-sm text-muted-foreground">
            Already have a household?{' '}
            <Link href="/login" className="text-link">
              Log in
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
