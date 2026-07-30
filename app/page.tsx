import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getHousehold } from '@/lib/onboarding/data';
import { getReviewQueue } from '@/lib/review/data';

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

  return (
    <main style={{ maxWidth: 480, margin: '10vh auto', padding: '0 1rem' }}>
      <Card>
        <CardHeader>
          <CardTitle>{household.name}</CardTitle>
          <CardDescription>Nothing due yet — you&apos;re all set.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p>Add your first receipt to start tracking what&apos;s in stock.</p>
          {reviewQueue.length > 0 && (
            <Link href="/review" className="underline">
              {reviewQueue.length} receipt{reviewQueue.length === 1 ? '' : 's'} waiting for review
            </Link>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
