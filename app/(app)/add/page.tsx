import { redirect } from 'next/navigation';
import { getHousehold } from '@/lib/onboarding/data';
import { AddCapture } from './capture';

// See app/page.tsx (S-04) for why this must be forced dynamic: without it,
// Next statically prerenders the page at build time since the only dynamic
// signal is an indirect Supabase fetch, not a direct cookies()/headers() call.
export const dynamic = 'force-dynamic';

export default async function AddPage() {
  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  return <AddCapture />;
}
