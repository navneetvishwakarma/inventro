import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getHousehold } from '@/lib/onboarding/data';

// Reads household state fresh every request (onboarding gate, cold-start
// display) — without this, Next statically prerenders the page at build
// time (the Supabase client's fetch gives Next no other dynamic signal),
// which bakes in stale household data and breaks the Server Action on
// /onboarding tied to the same static route.
export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  return (
    <main style={{ maxWidth: 480, margin: '10vh auto', padding: '0 1rem' }}>
      <Card>
        <CardHeader>
          <CardTitle>{household.name}</CardTitle>
          <CardDescription>Nothing due yet — you&apos;re all set.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Add your first receipt to start tracking what&apos;s in stock.</p>
        </CardContent>
      </Card>
    </main>
  );
}
