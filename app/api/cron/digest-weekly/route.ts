import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { buildWeeklyDigest, sendDigestEmail } from '@/lib/notifications/digest';

// docs/architecture/05-api-design.md's contract: Vercel Cron, Sunday 18:00
// IST (vercel.json: "30 12 * * 0" UTC). Same fail-closed CRON_SECRET
// pattern as /api/cron/recompute-stats. Mirrors digest-daily's
// empty-list-skips-the-send behavior at a 7-day window -- not a hard
// acceptance criterion for the weekly send, but no product reason to
// email an empty "next week" list either.
//
// S-63/ADR-0006: enumerates every household with a notify_email set,
// same reasoning as digest-daily's own comment.
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
      const digest = await buildWeeklyDigest({ supabase, householdId: household.id as string });
      if (digest.dueCount === 0) {
        return { householdId: household.id, sent: false, reason: 'nothing due within 7 days', dueCount: 0 };
      }
      const result = await sendDigestEmail(household.notify_email as string, digest);
      return { householdId: household.id, ...result, dueCount: digest.dueCount };
    }),
  );

  return NextResponse.json({ households: results.length, results });
}
