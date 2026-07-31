'use client';

import { useEffect } from 'react';

// Mounted once from RootLayout, so this runs on every page including
// /gate (pre-authentication) -- safe because /sw.js is explicitly exempted
// from the passcode gate (proxy.ts) precisely so this registration never
// 401s regardless of where in the app it first runs.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  }, []);

  return null;
}
