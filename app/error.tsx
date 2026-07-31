'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// S-36a/REQ-26: segment-level error boundary. Next mounts this in place of
// whichever route threw, wrapping every page under app/ (no page defines
// its own, so this is the one boundary the whole app relies on). `reset()`
// re-renders the segment without a full page reload -- appropriate here
// since every page's data fetch is a fresh Supabase read on each render.
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main style={{ maxWidth: 480, margin: '10vh auto', padding: '0 1rem' }}>
      <Card>
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>This page hit an unexpected error. Your data is untouched — try again.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset}>Try again</Button>
        </CardContent>
      </Card>
    </main>
  );
}
