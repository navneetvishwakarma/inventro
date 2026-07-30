import { NextResponse } from 'next/server';
import { recomputeAllItemsForHousehold } from '@/lib/predictions/recompute';
import { getDefaultHouseholdId } from '@/lib/household';

// docs/architecture/05-api-design.md's contract: Vercel Cron, nightly 03:00
// IST (vercel.json: "30 21 * * *" UTC). Fails closed -- an unset secret is
// never treated as "no auth required" (an unconfigured env var must not
// silently open this route).
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const result = await recomputeAllItemsForHousehold(getDefaultHouseholdId());
  return NextResponse.json(result);
}
