import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { recomputeAllItemsForHousehold } from '@/lib/predictions/recompute';

// docs/architecture/05-api-design.md's contract: Vercel Cron, nightly 03:00
// IST (vercel.json: "30 21 * * *" UTC). Fails closed -- an unset secret is
// never treated as "no auth required" (an unconfigured env var must not
// silently open this route).
//
// S-63/ADR-0006: sweeps every household, not just DEFAULT_HOUSEHOLD_ID (that
// env var is deleted in S-65) -- the architecturally correct behavior now
// that more than one household can exist, not just an access-pattern fix.
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: households, error } = await supabase.from('households').select('id');
  if (error) throw error;

  const results = await Promise.all(
    (households ?? []).map(async (household) => ({
      householdId: household.id,
      ...(await recomputeAllItemsForHousehold(household.id as string)),
    })),
  );

  return NextResponse.json({ households: results.length, results });
}
