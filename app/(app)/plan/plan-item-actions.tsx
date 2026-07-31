'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
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

  const moveToSelect = (
    <Select
      disabled={isPending}
      value=""
      placeholder="Move to…"
      onChange={(e) => {
        const bucket = e.target.value as CadenceBucket;
        if (bucket) run(() => setCadenceOverrideAction(catalogItemId, bucket));
      }}
      options={CADENCE_BUCKET_ORDER.filter((b) => b !== effectiveBucket).map((b) => ({ value: b, label: formatCadenceBucket(b) }))}
    />
  );

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
            <Button size="sm" variant="destructive" disabled={isPending} className="hidden md:inline-flex" onClick={() => run(() => excludeItemAction(catalogItemId))}>
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

        <div className="hidden w-[150px] md:block">{moveToSelect}</div>

        {hasCadenceOverride && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => setCadenceOverrideAction(catalogItemId, null))}>
            Revert to auto
          </Button>
        )}

        <details className="md:hidden">
          <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-border text-muted-foreground">
            &hellip;
          </summary>
          <div className="mt-2 flex flex-col items-start gap-2">
            {planState === 'pending' && (
              <Button size="sm" variant="destructive" disabled={isPending} onClick={() => run(() => excludeItemAction(catalogItemId))}>
                Always exclude
              </Button>
            )}
            <div className="w-[150px]">{moveToSelect}</div>
          </div>
        </details>
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

      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
