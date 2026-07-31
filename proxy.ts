import { NextRequest, NextResponse } from 'next/server';
import { GATE_COOKIE_NAME, verifyGateCookie } from '@/lib/gate';

// Not real authentication (ADR-0004) — exists only because Vercel URLs are
// public by default. /gate itself and Next's own static assets are excluded
// via the matcher below so the passcode-entry page is reachable and doesn't
// self-lock on its own JS/CSS. api/cron/* is also excluded (S-16) -- Vercel
// Cron's request carries no gate cookie and would otherwise always get this
// gate's 401 before the route's own CRON_SECRET check ever runs; those
// routes authenticate themselves independently and fail closed.
//
// S-35/REQ-27: the PWA shell (manifest, icons, service worker, offline
// fallback) is also excluded. This is a deliberate exemption, not an
// oversight: the browser's manifest-fetch step and a service worker's
// install-time cache.addAll() are same-origin fetches, but not guaranteed to
// be credentialed the way a normal navigation is (a service worker in
// particular runs with no notion of the gate cookie until it has one to
// send) -- gating these would make "installable" and "offline shell" both
// silently false while every locally-cookied check still passes. None of
// these five paths carry household data or any capability beyond static
// branding assets -- the exact same class of thing favicon.ico already was.
// api/share-target stays gated (real data-write endpoint, unlike these).

const UNGATED_PWA_ASSETS = new Set(['/manifest.webmanifest', '/sw.js', '/offline.html']);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (UNGATED_PWA_ASSETS.has(pathname) || pathname.startsWith('/icons/')) {
    return NextResponse.next();
  }

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
