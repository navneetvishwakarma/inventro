import { NextResponse } from 'next/server';
import { buildDailyDigest, sendDigestEmail } from '@/lib/notifications/digest';
import { getHousehold } from '@/lib/onboarding/data';

// docs/architecture/05-api-design.md's contract: Vercel Cron, daily 07:00
// IST (vercel.json: "30 1 * * *" UTC). Same fail-closed CRON_SECRET pattern
// as /api/cron/recompute-stats.
//
// S-32's literal acceptance criterion: fires only when something is due
// within 3 days. An empty due-soon list short-circuits before any Resend
// call is even attempted -- never a "sent" response for nothing to send.
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const digest = await buildDailyDigest();
  if (digest.dueCount === 0) {
    return NextResponse.json({ sent: false, reason: 'nothing due within 3 days', dueCount: 0 });
  }

  const household = await getHousehold();
  const result = await sendDigestEmail(household.notify_email, digest);
  return NextResponse.json({ ...result, dueCount: digest.dueCount });
}
