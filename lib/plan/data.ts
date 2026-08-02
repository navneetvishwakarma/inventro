import 'server-only';
import { resolveHouseholdContext, type HouseholdContext } from '@/lib/household';
import { getInventoryItems, type InventoryItem } from '@/lib/inventory/data';
import { toKolkataDateString } from '@/lib/date';

export type PlanState = 'pending' | 'snoozed' | 'skipped' | 'excluded';

export type PlanItem = InventoryItem & {
  suggestedQtyBase: number;
  dueDate: string | null; // predictedNextPurchaseAt, unaffected by cadence_override (F11: override only relabels the bucket, not the prediction)
  planState: PlanState; // already resolved for snooze/skip auto-expiry -- callers never re-derive this
  snoozedUntil: string | null; // raw stored value, null once auto-expired (planState reflects the expiry, this is just for display of "snoozed until X")
};

type PlanEntryRow = {
  catalog_item_id: string;
  due_date: string | null; // 'YYYY-MM-DD', PostgREST date-column format
  state: string;
  snoozed_until: string | null;
};

// F11: suggested qty = pack size x ceil(cycle consumption / pack size),
// floored at 1. Falls back to "buy one pack" (or 1 base unit with no known
// pack size) whenever either input to "cycle consumption" is missing --
// dailyRateBase alone isn't enough; interval_est_days can independently be
// null on legacy rows (added by a later migration than daily_rate_base),
// and 0 * null coerces to 0 in JS, which would silently suggest 1 pack for
// an item that actually needs several.
function computeSuggestedQtyBase(dailyRateBase: number | null, intervalEstDays: number | null, defaultPackSize: number | null): number {
  if (dailyRateBase === null || intervalEstDays === null) {
    return defaultPackSize && defaultPackSize > 0 ? defaultPackSize : 1;
  }
  const cycleConsumption = dailyRateBase * intervalEstDays;
  if (defaultPackSize && defaultPackSize > 0) {
    return defaultPackSize * Math.max(1, Math.ceil(cycleConsumption / defaultPackSize));
  }
  return Math.max(1, Math.ceil(cycleConsumption));
}

// Resolves a raw plan_entries row (or its absence) against the item's
// freshly-computed dueDate, applying read-side auto-expiry so no
// regeneration job is needed:
// - 'snoozed' reverts to 'pending' once snoozed_until has passed.
// - 'skipped' reverts to 'pending' once the item's due date has moved to a
//   NEWER cycle than the one the skip was stamped against (a later
//   re-estimate that pulls the date earlier must not un-skip a dismissal
//   the user just made -- only forward progress, e.g. a real purchase,
//   spends the skip).
// - 'excluded' never auto-expires; only an explicit "include again" clears it.
function resolvePlanState(row: PlanEntryRow | undefined, dueDate: string | null, nowIso: string): { state: PlanState; snoozedUntil: string | null } {
  if (!row) return { state: 'pending', snoozedUntil: null };

  if (row.state === 'snoozed') {
    if (row.snoozed_until !== null && row.snoozed_until > nowIso) return { state: 'snoozed', snoozedUntil: row.snoozed_until };
    return { state: 'pending', snoozedUntil: null };
  }

  if (row.state === 'skipped') {
    if (dueDate === null || row.due_date === null) return { state: 'skipped', snoozedUntil: null };
    const newDueKolkata = toKolkataDateString(dueDate);
    if (newDueKolkata > row.due_date) return { state: 'pending', snoozedUntil: null };
    return { state: 'skipped', snoozedUntil: null };
  }

  if (row.state === 'excluded') return { state: 'excluded', snoozedUntil: null };

  return { state: 'pending', snoozedUntil: null };
}

// Every item ever purchased (cadenceBucket !== null), with suggested qty,
// due date, and resolved manual-action state. Reuses getInventoryItems()
// rather than a bespoke query -- same tradeoff S-20's getItemsNeedingAttention
// already made: one extra query cost beats a second, drifting definition of
// item state at this household scale.
export async function getPlanItems(context?: HouseholdContext): Promise<PlanItem[]> {
  const resolved = await resolveHouseholdContext(context);
  const { supabase, householdId } = resolved;
  const [items, planRes] = await Promise.all([
    getInventoryItems(resolved),
    supabase.from('plan_entries').select('catalog_item_id, due_date, state, snoozed_until').eq('household_id', householdId),
  ]);
  if (planRes.error) throw planRes.error;

  const planByItem = new Map((planRes.data ?? []).map((r) => [r.catalog_item_id as string, r as PlanEntryRow]));
  const nowIso = new Date().toISOString();

  return items
    .filter((item) => item.cadenceBucket !== null)
    .map((item) => {
      const dueDate = item.predictedNextPurchaseAt;
      const { state, snoozedUntil } = resolvePlanState(planByItem.get(item.id), dueDate, nowIso);
      return {
        ...item,
        suggestedQtyBase: computeSuggestedQtyBase(item.dailyRateBase, item.intervalEstDays, item.defaultPackSize),
        dueDate,
        planState: state,
        snoozedUntil,
      };
    });
}

const DEFAULT_DUE_SOON_DAYS = 3;

// F11's Today view / F14's digest threshold: everything due within N days,
// including overdue (dueDate in the past) -- matches the existing
// RUNNING_LOW_DAYS_THRESHOLD convention (app/inventory/page.tsx) rather than
// inventing a second due-window definition. Suppressed items (snoozed,
// skipped-and-still-active, excluded) never appear here even if their
// underlying dueDate would qualify.
export async function getDueSoonItems(daysThreshold: number = DEFAULT_DUE_SOON_DAYS, context?: HouseholdContext): Promise<PlanItem[]> {
  const planItems = await getPlanItems(context);
  const thresholdMs = Date.now() + daysThreshold * 86_400_000;

  return planItems
    .filter((item) => item.planState === 'pending' && item.dueDate !== null && new Date(item.dueDate).getTime() <= thresholdMs)
    .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime());
}
