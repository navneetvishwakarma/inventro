import { Card, CardContent, CardHeader } from '@/components/ui/card';

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
        <CardHeader className="animate-pulse">
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="h-3 w-2/3 rounded bg-muted" />
        </CardHeader>
        <CardContent className="flex animate-pulse flex-col gap-2">
          <div className="h-8 rounded bg-muted" />
          <div className="h-8 rounded bg-muted" />
        </CardContent>
      </Card>
      <span className="sr-only">Loading…</span>
    </main>
  );
}
