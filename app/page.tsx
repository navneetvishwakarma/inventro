import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getHousehold } from '@/lib/onboarding/data';
import { getReviewQueue } from '@/lib/review/data';
import { getItemsNeedingAttention } from '@/lib/inventory/data';
import { getDueSoonItems } from '@/lib/plan/data';
import { formatBaseQty, formatDueDate } from '@/lib/inventory/format';

// Reads household state fresh every request (onboarding gate, cold-start
// display) — without this, Next statically prerenders the page at build
// time (the Supabase client's fetch gives Next no other dynamic signal),
// which bakes in stale household data and breaks the Server Action on
// /onboarding tied to the same static route.
export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  // No global nav exists yet in this repo — this is the only surface that
  // makes the review queue (S-12) discoverable once a receipt finishes
  // parsing asynchronously after upload.
  const reviewQueue = await getReviewQueue();

  // S-20: minimal "Needs attention" section (A8's "appears in Today"),
  // already-empty virtual stock -- a fact, not a prediction.
  const needsAttention = await getItemsNeedingAttention();

  // S-22: F11's Today view -- everything due within 3 days across all
  // cadence buckets, forward-looking (a prediction, not a fact). Distinct
  // from needsAttention: an item can be in one, both, or neither.
  const dueSoon = await getDueSoonItems();

  const nothingToShow = needsAttention.length === 0 && dueSoon.length === 0;

  return (
    <main style={{ maxWidth: 480, margin: '10vh auto', padding: '0 1rem' }} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{household.name}</CardTitle>
          <CardDescription>
            {nothingToShow
              ? "Nothing due yet — you're all set."
              : `${dueSoon.length} item${dueSoon.length === 1 ? '' : 's'} due soon, ${needsAttention.length} need${needsAttention.length === 1 ? 's' : ''} attention.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p>Add your first receipt to start tracking what&apos;s in stock.</p>
          {reviewQueue.length > 0 && (
            <Link href="/review" className="underline">
              {reviewQueue.length} receipt{reviewQueue.length === 1 ? '' : 's'} waiting for review
            </Link>
          )}
          <Link href="/plan" className="underline">
            View plan
          </Link>
          <Link href="/inventory" className="underline">
            View inventory
          </Link>
        </CardContent>
      </Card>

      {dueSoon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Due soon</CardTitle>
            <CardDescription>Everything due within 3 days, across all cadence buckets.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {dueSoon.map((item) => (
              <Link key={item.id} href={`/plan?bucket=${item.cadenceBucket}`} className="flex flex-col gap-0.5 rounded border p-2 hover:bg-accent">
                <span className="flex justify-between">
                  <span>
                    {item.canonicalName}
                    {item.brand ? <span className="text-muted-foreground"> ({item.brand})</span> : null}
                  </span>
                  <span className="text-sm text-muted-foreground">{formatDueDate(item.dueDate)}</span>
                </span>
                <span className="text-sm text-muted-foreground">Suggested: {formatBaseQty(item.suggestedQtyBase, item.baseUnit, item.defaultPackSize)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {needsAttention.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Out of stock, based on your recorded usage.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {needsAttention.map((item) => (
              <Link key={item.id} href={`/inventory/${item.id}`} className="flex justify-between rounded border p-2 hover:bg-accent">
                <span>
                  {item.canonicalName}
                  {item.brand ? <span className="text-muted-foreground"> ({item.brand})</span> : null}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
