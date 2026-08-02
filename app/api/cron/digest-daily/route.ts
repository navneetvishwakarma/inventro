import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { buildDailyDigest, sendDigestEmail } from '@/lib/notifications/digest';

// docs/architecture/05-api-design.md's contract: Vercel Cron, daily 07:00
// IST (vercel.json: "30 1 * * *" UTC). Same fail-closed CRON_SECRET pattern
// as /api/cron/recompute-stats.
//
// S-32's literal acceptance criterion: fires only when something is due
// within 3 days. An empty due-soon list short-circuits before any Resend
// call is even attempted -- never a "sent" response for nothing to send.
//
// S-63/ADR-0006: enumerates every household with a notify_email set
// (service-role -- cron has no user session, one of the two documented
// exceptions) instead of the old single-household getHousehold() call,
// which no longer works from a session-less context after E-20/E-21's
// migration to session-derived household resolution. This is also the
// architecturally correct behavior now that more than one household can
// exist, not just a mechanical access-pattern fix.
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: households, error } = await supabase.from('households').select('id, notify_email').not('notify_email', 'is', null);
  if (error) throw error;

  const results = await Promise.all(
    (households ?? []).map(async (household) => {
      const digest = await buildDailyDigest({ supabase, householdId: household.id as string });
      if (digest.dueCount === 0) {
        return { householdId: household.id, sent: false, reason: 'nothing due within 3 days', dueCount: 0 };
      }
      const result = await sendDigestEmail(household.notify_email as string, digest);
      return { householdId: household.id, ...result, dueCount: digest.dueCount };
    }),
  );

  return NextResponse.json({ households: results.length, results });
}
