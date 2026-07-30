'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import type { CadenceBucket } from '@/lib/predictions/types';
import { CADENCE_BUCKET_ORDER, formatCadenceBucket } from '@/lib/inventory/format';
import type { PlanState } from '@/lib/plan/data';
import {
  setCadenceOverrideAction,
  snoozeItemAction,
  unsnoozeItemAction,
  skipOnceAction,
  undoSkipAction,
  excludeItemAction,
  includeItemAction,
} from './actions';

const SNOOZE_DAYS = [3, 7, 14] as const;

export function PlanItemActions({
  catalogItemId,
  planState,
  hasCadenceOverride,
  effectiveBucket,
}: {
  catalogItemId: string;
  planState: PlanState;
  hasCadenceOverride: boolean;
  effectiveBucket: CadenceBucket;
}) {
  const [isPending, startTransition] = useTransition();
  const [showSnooze, setShowSnooze] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      setError(result.ok ? null : (result.error ?? 'Something went wrong'));
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {planState === 'pending' && (
          <>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setShowSnooze((v) => !v)}>
              Snooze
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => skipOnceAction(catalogItemId))}>
              Skip once
            </Button>
            <Button size="sm" variant="destructive" disabled={isPending} onClick={() => run(() => excludeItemAction(catalogItemId))}>
              Always exclude
            </Button>
          </>
        )}
        {planState === 'snoozed' && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => unsnoozeItemAction(catalogItemId))}>
            Un-snooze
          </Button>
        )}
        {planState === 'skipped' && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => undoSkipAction(catalogItemId))}>
            Undo skip
          </Button>
        )}
        {planState === 'excluded' && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => includeItemAction(catalogItemId))}>
            Include again
          </Button>
        )}

        <select
          className="rounded border px-2 py-1 text-sm"
          disabled={isPending}
          value=""
          onChange={(e) => {
            const bucket = e.target.value as CadenceBucket;
            if (bucket) run(() => setCadenceOverrideAction(catalogItemId, bucket));
          }}
        >
          <option value="">Move to...</option>
          {CADENCE_BUCKET_ORDER.filter((b) => b !== effectiveBucket).map((b) => (
            <option key={b} value={b}>
              {formatCadenceBucket(b)}
            </option>
          ))}
        </select>

        {hasCadenceOverride && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => setCadenceOverrideAction(catalogItemId, null))}>
            Revert to auto
          </Button>
        )}
      </div>

      {showSnooze && planState === 'pending' && (
        <div className="flex items-center gap-2">
          {SNOOZE_DAYS.map((d) => (
            <Button key={d} size="sm" variant="outline" disabled={isPending} onClick={() => run(() => snoozeItemAction(catalogItemId, d))}>
              {d}d
            </Button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
