import { NextResponse } from 'next/server';
import { buildWeeklyDigest, sendDigestEmail } from '@/lib/notifications/digest';
import { getHousehold } from '@/lib/onboarding/data';

// docs/architecture/05-api-design.md's contract: Vercel Cron, Sunday 18:00
// IST (vercel.json: "30 12 * * 0" UTC). Same fail-closed CRON_SECRET
// pattern as /api/cron/recompute-stats. Mirrors digest-daily's
// empty-list-skips-the-send behavior at a 7-day window -- not a hard
// acceptance criterion for the weekly send, but no product reason to
// email an empty "next week" list either.
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const digest = await buildWeeklyDigest();
  if (digest.dueCount === 0) {
    return NextResponse.json({ sent: false, reason: 'nothing due within 7 days', dueCount: 0 });
  }

  const household = await getHousehold();
  const result = await sendDigestEmail(household.notify_email, digest);
  return NextResponse.json({ ...result, dueCount: digest.dueCount });
}
