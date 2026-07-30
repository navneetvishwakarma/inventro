import { NextRequest, NextResponse } from 'next/server';
import { GATE_COOKIE_NAME, verifyGateCookie } from '@/lib/gate';

// Not real authentication (ADR-0004) — exists only because Vercel URLs are
// public by default. /gate itself and Next's own static assets are excluded
// via the matcher below so the passcode-entry page is reachable and doesn't
// self-lock on its own JS/CSS. api/cron/* is also excluded (S-16) -- Vercel
// Cron's request carries no gate cookie and would otherwise always get this
// gate's 401 before the route's own CRON_SECRET check ever runs; those
// routes authenticate themselves independently and fail closed.

export async function proxy(request: NextRequest) {
  const secret = process.env.GATE_COOKIE_SECRET;
  const cookie = request.cookies.get(GATE_COOKIE_NAME)?.value;

  if (!secret || !(await verifyGateCookie(cookie, secret))) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|gate(?:$|/)|api/cron/).*)'],
};
