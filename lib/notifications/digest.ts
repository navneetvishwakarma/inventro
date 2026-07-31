import 'server-only';
import { getDueSoonItems, type PlanItem } from '@/lib/plan/data';
import { formatDueDate } from '@/lib/inventory/format';

export type Digest = {
  dueCount: number;
  subject: string;
  body: string;
};

function formatItemLine(item: PlanItem): string {
  const brand = item.brand ? ` (${item.brand})` : '';
  return `- ${item.canonicalName}${brand} — ${formatDueDate(item.dueDate)}`;
}

// F14: daily digest, due within 3 days -- reuses S-22's getDueSoonItems()
// verbatim rather than re-deriving "due soon" (it already excludes
// snoozed/skipped-active/excluded plan states).
export async function buildDailyDigest(): Promise<Digest> {
  const items = await getDueSoonItems(3);
  return {
    dueCount: items.length,
    subject: `${items.length} item${items.length === 1 ? '' : 's'} due soon`,
    body: `Due within the next 3 days:\n\n${items.map(formatItemLine).join('\n')}`,
  };
}

// F14: weekly "next week's list ready" digest, same due-soon data at a
// 7-day window rather than a second "what's coming up" computation.
export async function buildWeeklyDigest(): Promise<Digest> {
  const items = await getDueSoonItems(7);
  return {
    dueCount: items.length,
    subject: "Next week's shopping list is ready",
    body: `Coming up in the next 7 days:\n\n${items.map(formatItemLine).join('\n')}`,
  };
}

export type SendResult = { sent: boolean; reason?: string };

// Plain fetch against Resend's API -- no SDK dependency, since
// RESEND_API_KEY is unconfigured in this environment and the SDK's surface
// can't be exercised live either way (see .claude/epic-13/sub-S-32.json).
// Callers are responsible for the dueCount===0 skip (route-specific reason
// text); this function covers the three remaining honest-skip cases (no
// recipient, no key, no verified sending domain) plus the real send attempt.
export async function sendDigestEmail(to: string | null, digest: Digest): Promise<SendResult> {
  if (!to) return { sent: false, reason: 'no notify_email configured' };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not configured' };

  // Resend rejects a `from` address on a domain that hasn't been verified in
  // the Resend account -- there is no domain this repo can safely hardcode
  // (the deploy is inventro-tau.vercel.app, not a domain this project owns),
  // so this is a fourth honest-skip input, not a default.
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) return { sent: false, reason: 'RESEND_FROM_EMAIL not configured' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: digest.subject,
      text: digest.body,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { sent: false, reason: `Resend API error ${res.status}: ${errText.slice(0, 200)}` };
  }
  return { sent: true };
}
