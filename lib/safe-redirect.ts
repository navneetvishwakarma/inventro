// Security-review fix (E-20): the original per-file `startsWith('/') &&
// !startsWith('//')` check (three independent copies) is a known-weak
// open-redirect filter -- browsers normalize a leading backslash to a
// forward slash for special schemes, so `/\evil.com` or `/\t/evil.com`
// pass a prefix check but resolve off-origin. A single allow-list
// character class closes that (no backslash, no colon, no whitespace/
// control characters in the allowed set at all) and removes the
// three-copies drift risk. Runs in proxy.ts's Edge runtime too, so no
// Node-only APIs (e.g. `new URL` parsing quirks) -- a plain regex.
const SAFE_NEXT_PATH = /^\/[a-zA-Z0-9\-_/]*$/;

export function safeNextPath(next: string | null | undefined): string {
  if (!next || !SAFE_NEXT_PATH.test(next) || next.startsWith('//')) return '/';
  return next;
}
