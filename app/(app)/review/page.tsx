import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableRowMobile } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { MobileTopBar } from '@/components/ui/mobile-top-bar';
import { getHousehold } from '@/lib/onboarding/data';
import { getReviewQueue, type ReviewQueueItem } from '@/lib/review/data';

// Same force-dynamic rationale as app/page.tsx and app/add/page.tsx: the
// review queue must reflect the latest extraction results on every load.
export const dynamic = 'force-dynamic';

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : 'No date';
}

function formatTotal(value: number | null): string {
  return value !== null ? `₹${value}` : '—';
}

export default async function ReviewQueuePage() {
  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  const queue = await getReviewQueue();

  return (
    <>
      <MobileTopBar title="Review queue" />
      <div className="mx-auto w-full max-w-[780px] p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
          <CardDescription>
            {queue.length === 0 ? 'Nothing waiting for review.' : `${queue.length} receipt${queue.length === 1 ? '' : 's'} to review.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <EmptyState title="Review queue is empty" description="Receipts land here once extraction finishes parsing them." />
          ) : (
            <>
              <div className="hidden md:block">
                <Table<ReviewQueueItem>
                  columns={[
                    {
                      key: 'merchant',
                      header: 'Merchant',
                      render: (r) => (
                        <Link href={`/review/${r.id}`} className="font-semibold text-link no-underline hover:text-link-hover">
                          {r.merchant ?? 'Unknown merchant'}
                        </Link>
                      ),
                    },
                    { key: 'purchased_at', header: 'Date', render: (r) => formatDate(r.purchased_at) },
                    { key: 'total_amount', header: 'Total', align: 'right', numeric: true, render: (r) => formatTotal(r.total_amount) },
                  ]}
                  rows={queue}
                />
              </div>
              <div className="md:hidden">
                {queue.map((receipt) => (
                  <Link key={receipt.id} href={`/review/${receipt.id}`} className="block no-underline">
                    <TableRowMobile
                      primary={receipt.merchant ?? 'Unknown merchant'}
                      secondary={formatTotal(receipt.total_amount)}
                      meta={formatDate(receipt.purchased_at)}
                    />
                  </Link>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  );
}
