import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getHousehold } from '@/lib/onboarding/data';
import { getReviewQueue } from '@/lib/review/data';

// Same force-dynamic rationale as app/page.tsx and app/add/page.tsx: the
// review queue must reflect the latest extraction results on every load.
export const dynamic = 'force-dynamic';

export default async function ReviewQueuePage() {
  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  const queue = await getReviewQueue();

  return (
    <main style={{ maxWidth: 640, margin: '10vh auto', padding: '0 1rem' }}>
      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
          <CardDescription>{queue.length === 0 ? 'Nothing waiting for review.' : `${queue.length} receipt${queue.length === 1 ? '' : 's'} to review.`}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {queue.map((receipt) => (
            <Link key={receipt.id} href={`/review/${receipt.id}`} className="flex justify-between gap-2 rounded border p-3 hover:bg-accent">
              <span>{receipt.merchant ?? 'Unknown merchant'}</span>
              <span>{receipt.purchased_at ? new Date(receipt.purchased_at).toLocaleDateString() : 'No date'}</span>
              <span>{receipt.total_amount !== null ? receipt.total_amount : '—'}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
