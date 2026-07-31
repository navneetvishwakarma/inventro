import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// S-36a/REQ-26: root-level Suspense fallback. Next applies the nearest
// loading.tsx up the route tree to every segment beneath it that doesn't
// define its own -- all 13 routes are single force-dynamic Server
// Component fetches with no nested Suspense boundaries today, so one shared
// skeleton here satisfies "every screen defines a loading state" without
// duplicating the same markup 13 times. A route only earns its own
// loading.tsx if its loading behavior is genuinely distinct from this.
export default function Loading() {
  return (
    <main style={{ maxWidth: 480, margin: '10vh auto', padding: '0 1rem' }} className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <Card>
        <CardHeader className="gap-2">
          <Skeleton width="33%" height={16} />
          <Skeleton width="66%" height={12} />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton height={32} />
          <Skeleton height={32} />
        </CardContent>
      </Card>
      <span className="sr-only">Loading…</span>
    </main>
  );
}
