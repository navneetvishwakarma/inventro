import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { safeNextPath } from '@/lib/safe-redirect';

// S-59/ADR-0006: session gate, replacing the passcode gate (lib/gate.ts,
// removed this story). /login and /signup are excluded via the matcher
// below so the auth forms are reachable and don't self-lock on their own
// JS/CSS. api/cron/* is also excluded (S-16) -- Vercel Cron's request
// carries no user session and would otherwise always get this gate's
// redirect before the route's own CRON_SECRET check ever runs; those
// routes authenticate themselves independently and fail closed.
//
// S-35/REQ-27: the PWA shell (manifest, icons, service worker, offline
// fallback) is also excluded -- unchanged reasoning from the passcode-gate
// era (see git history on this file): none of these five paths carry
// household data or any capability beyond static branding assets.
// api/share-target stays gated (real data-write endpoint, unlike these).

const UNGATED_PWA_ASSETS = new Set(['/manifest.webmanifest', '/sw.js', '/offline.html']);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (UNGATED_PWA_ASSETS.has(pathname) || pathname.startsWith('/icons/')) {
    return NextResponse.next();
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const isApiRoute = pathname.startsWith('/api/');
    if (isApiRoute) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', safeNextPath(pathname));
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login(?:$|/)|signup(?:$|/)|api/cron/).*)'],
};
