import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { Badge } from '@/components/ui/badge';
import { MobileTopBar } from '@/components/ui/mobile-top-bar';
import { cn } from '@/lib/utils';
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
    <>
      <MobileTopBar title="Today" />
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{household.name}</CardTitle>
          <CardDescription>
            {nothingToShow
              ? "Nothing due yet — you're all set."
              : `${dueSoon.length} item${dueSoon.length === 1 ? '' : 's'} due soon, ${needsAttention.length} need${needsAttention.length === 1 ? 's' : ''} attention.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Add your first receipt to start tracking what&apos;s in stock.</p>
          <Link href="/review" className={cn(buttonVariants({ variant: 'tertiary', size: 'sm' }), 'self-start')}>
            {reviewQueue.length > 0
              ? `${reviewQueue.length} receipt${reviewQueue.length === 1 ? '' : 's'} waiting for review`
              : 'Review queue'}
          </Link>
        </CardContent>
        <CardFooter className="flex-wrap">
          <Link href="/plan" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            View plan{dueSoon.length > 0 ? ` (${dueSoon.length})` : ''}
          </Link>
          <Link href="/inventory" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            View inventory
          </Link>
          <Link href="/add/manual" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Add manually
          </Link>
          <Link href="/catalog" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Manage catalog
          </Link>
          <Link href="/insights" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            View insights
          </Link>
          <Link href="/shopping-list" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Shopping list
          </Link>
          <Link href="/settings" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Settings
          </Link>
        </CardFooter>
      </Card>

      {dueSoon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Due soon</CardTitle>
            <CardDescription>Due or overdue in the next 3 days, across all cadence buckets.</CardDescription>
          </CardHeader>
          <CardContent>
            {dueSoon.map((item) => (
              <ListRow
                key={item.id}
                href={`/plan?bucket=${item.cadenceBucket}`}
                title={
                  <>
                    {item.canonicalName}
                    {item.brand ? <span className="text-muted-foreground"> ({item.brand})</span> : null}
                  </>
                }
                subtitle={`Suggested: ${formatBaseQty(item.suggestedQtyBase, item.baseUnit, item.defaultPackSize)}`}
                meta={[formatDueDate(item.dueDate)]}
              />
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
          <CardContent>
            {needsAttention.map((item) => (
              <ListRow
                key={item.id}
                href={`/inventory/${item.id}`}
                title={
                  <>
                    {item.canonicalName}
                    {item.brand ? <span className="text-muted-foreground"> ({item.brand})</span> : null}
                  </>
                }
                trailing={<Badge tone="error">Out of stock</Badge>}
              />
            ))}
          </CardContent>
        </Card>
      )}
      </div>
    </>
  );
}
