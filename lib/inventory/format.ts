// Pure display helpers -- no DB access. Narrow inverse of
// lib/receipts/canonicalize.ts's normalizeUnitToBase (display -> base); this
// only goes base -> friendly display, not a generalized inverse of that
// whole module.
import type { BaseUnit } from '@/lib/receipts/canonicalize';

const PACK_DISPLAY_MIN_FRACTION = 0.05;

export function formatBaseQty(qtyBase: number, baseUnit: BaseUnit, defaultPackSize: number | null): string {
  let primary: string;
  if (baseUnit === 'g') {
    primary = qtyBase >= 1000 ? `${round1(qtyBase / 1000)} kg` : `${Math.round(qtyBase)} g`;
  } else if (baseUnit === 'ml') {
    primary = qtyBase >= 1000 ? `${round1(qtyBase / 1000)} l` : `${Math.round(qtyBase)} ml`;
  } else {
    const n = Math.round(qtyBase);
    primary = `${n} ${n === 1 ? 'piece' : 'pieces'}`;
  }

  if (defaultPackSize && defaultPackSize > 0) {
    const packs = qtyBase / defaultPackSize;
    if (packs >= PACK_DISPLAY_MIN_FRACTION) {
      const packsRounded = Math.round(packs * 10) / 10;
      primary += ` ≈ ${packsRounded} pack${packsRounded === 1 ? '' : 's'}`;
    }
  }
  return primary;
}

function round1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function formatDaysRemaining(days: number | null): string {
  if (days === null) return 'Unknown';
  if (days <= 0) return 'Due now';
  const rounded = Math.round(days);
  return rounded <= 1 ? '~1 day left' : `~${rounded} days left`;
}

const CADENCE_LABELS: Record<string, string> = {
  daily: 'Daily',
  every_2_3_days: 'Every 2-3 days',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half-yearly',
  yearly: 'Yearly',
  unpredictable: 'Unpredictable',
};

export function formatCadenceBucket(bucket: string | null): string {
  if (bucket === null) return 'Not enough data';
  return CADENCE_LABELS[bucket] ?? bucket;
}

// F11's tab order (daily -> unpredictable) -- single source of truth for
// both /plan's tabs and any other place that needs to walk buckets in a
// stable, human-meaningful order. Mirrors computeItemStats.ts's internal
// CADENCE_ORDER + 'unpredictable', duplicated rather than imported from
// that module's `_internal` (reserved for verification scripts, not
// production code) since this list is a stable, algorithm-independent
// display fact.
export const CADENCE_BUCKET_ORDER = [
  'daily',
  'every_2_3_days',
  'weekly',
  'fortnightly',
  'monthly',
  'quarterly',
  'half_yearly',
  'yearly',
  'unpredictable',
] as const;

// "Due today" / "Due in N days" / "Overdue by N days" -- companion to
// formatDaysRemaining, but phrased for a due-date-centric list (Plan/Today)
// rather than a stock-remaining one.
export function formatDueDate(dueDate: string | null): string {
  if (dueDate === null) return 'No estimate yet';
  const days = Math.round((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
  if (days === 0) return 'Due today';
  if (days > 0) return days === 1 ? 'Due in 1 day' : `Due in ${days} days`;
  const overdue = Math.abs(days);
  return overdue === 1 ? 'Overdue by 1 day' : `Overdue by ${overdue} days`;
}

// F8's "plain-language prediction explanation", e.g.
// "You buy this every ~9 days; last bought 7 days ago; ~2 days left."
export function buildPredictionExplanation(input: {
  intervalEstDays: number | null;
  lastPurchasedAt: string | null;
  daysRemaining: number | null;
}): string {
  const { intervalEstDays, lastPurchasedAt, daysRemaining } = input;

  if (lastPurchasedAt === null) {
    return 'No purchase history yet -- buy it once and predictions start.';
  }

  const daysSincePurchase = Math.round((Date.now() - new Date(lastPurchasedAt).getTime()) / 86_400_000);
  const purchasedPhrase = daysSincePurchase <= 0 ? 'last bought today' : daysSincePurchase === 1 ? 'last bought 1 day ago' : `last bought ${daysSincePurchase} days ago`;

  const cadencePhrase = intervalEstDays !== null ? `You buy this every ~${Math.round(intervalEstDays)} days; ` : '';
  const remainingPhrase = daysRemaining !== null ? formatDaysRemaining(daysRemaining) : 'timing unclear';

  return `${cadencePhrase}${purchasedPhrase}; ${remainingPhrase}.`;
}
