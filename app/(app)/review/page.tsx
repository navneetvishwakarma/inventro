import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableRowMobile } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { MobileTopBar } from '@/components/ui/mobile-top-bar';
import { Badge } from '@/components/ui/badge';
import { getHousehold } from '@/lib/onboarding/data';
import { getReviewQueue, type ReviewQueueItem } from '@/lib/review/data';
import { formatMoney } from '@/lib/format/money';

// Same force-dynamic rationale as app/page.tsx and app/add/page.tsx: the
// review queue must reflect the latest extraction results on every load.
export const dynamic = 'force-dynamic';

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : 'No date';
}

function formatTotal(value: number | null): string {
  return value !== null ? formatMoney(value) : '—';
}

// S-67: a 'parsed' receipt is the expected steady state for this list --
// no badge needed. Anything else (still processing, or permanently failed)
// gets a badge so it's never silently indistinguishable from a normal
// ready-to-review row.
function statusBadge(receipt: ReviewQueueItem): { tone: 'error' | 'info'; label: string } | null {
  if (receipt.status === 'parsed') return null;
  if (receipt.ingestState === 'failed') return { tone: 'error', label: 'Failed' };
  return { tone: 'info', label: 'Processing' };
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
                      render: (r) => {
                        const badge = statusBadge(r);
                        return (
                          <Link href={`/review/${r.id}`} className="flex items-center gap-2 font-semibold text-link no-underline hover:text-link-hover">
                            {r.merchant ?? 'Unknown merchant'}
                            {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
                          </Link>
                        );
                      },
                    },
                    { key: 'purchased_at', header: 'Date', render: (r) => formatDate(r.purchased_at) },
                    { key: 'total_amount', header: 'Total', align: 'right', numeric: true, render: (r) => formatTotal(r.total_amount) },
                  ]}
                  rows={queue}
                />
              </div>
              <div className="md:hidden">
                {queue.map((receipt) => {
                  const badge = statusBadge(receipt);
                  return (
                    <Link key={receipt.id} href={`/review/${receipt.id}`} className="block no-underline">
                      <TableRowMobile
                        primary={
                          <span className="flex items-center gap-2">
                            {receipt.merchant ?? 'Unknown merchant'}
                            {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
                          </span>
                        }
                        secondary={formatTotal(receipt.total_amount)}
                        meta={formatDate(receipt.purchased_at)}
                      />
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  );
}
