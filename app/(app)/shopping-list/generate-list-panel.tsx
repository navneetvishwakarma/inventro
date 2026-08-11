'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { ConfirmPanel } from '@/components/ui/confirm-panel';
import { CADENCE_BUCKET_ORDER, formatCadenceBucket } from '@/lib/inventory/format';
import type { ShoppingListSource } from '@/lib/shopping-list/generate';
import { generateShoppingListAction } from './actions';

const DEFAULT_DUE_IN_DAYS = 3;

// S-69: generating always archives the current active list (generate.ts's
// own comment: "replaces, never appends"). Silently discarding a list with
// checked-off items mid-trip is a real data-loss-adjacent surprise --
// warn only when that's actually true (checked-off items exist), not on
// every generation. An empty or all-unchecked list regenerates instantly,
// same as before this story -- confirm-fatigue on the common path would be
// its own usability regression.
export function GenerateListPanel({ hasCheckedItems }: { hasCheckedItems: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingSource, setPendingSource] = useState<ShoppingListSource | null>(null);
  const [days, setDays] = useState(String(DEFAULT_DUE_IN_DAYS));
  // S-99: every button in the row previously just disabled uniformly during
  // the round-trip -- no spinner, no way to tell which one was actually
  // clicked. Tracks the specific source so only that button renders
  // Button's loading prop; the others stay merely disabled, unchanged.
  const [clickedSource, setClickedSource] = useState<ShoppingListSource | null>(null);

  function isClicked(source: ShoppingListSource): boolean {
    if (!clickedSource) return false;
    if (source.type === 'bucket') return clickedSource.type === 'bucket' && clickedSource.bucket === source.bucket;
    return clickedSource.type === 'due_in_days';
  }

  function generate(source: ShoppingListSource) {
    setError(null);
    setClickedSource(source);
    startTransition(async () => {
      try {
        await generateShoppingListAction(source);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function requestGenerate(source: ShoppingListSource) {
    if (hasCheckedItems) {
      setPendingSource(source);
    } else {
      generate(source);
    }
  }

  if (pendingSource) {
    return (
      <ConfirmPanel
        title="Replace the current list?"
        description="Your active list has checked-off items -- generating a new one archives it, checked items included."
        confirmLabel="Generate new list"
        confirmVariant="destructive"
        pending={isPending}
        error={error}
        onConfirm={() => generate(pendingSource)}
        onCancel={() => setPendingSource(null)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate a shopping list</CardTitle>
        <CardDescription>From a cadence bucket, or everything due soon.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {CADENCE_BUCKET_ORDER.map((bucket) => (
            <Button
              key={bucket}
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              loading={isPending && isClicked({ type: 'bucket', bucket })}
              onClick={() => requestGenerate({ type: 'bucket', bucket })}
            >
              {formatCadenceBucket(bucket)}
            </Button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Input
            id="days"
            name="days"
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            label="Due within (days)"
            size="sm"
            className="w-[90px]"
          />
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            loading={isPending && isClicked({ type: 'due_in_days', days: 0 })}
            onClick={() => {
              const n = Number(days);
              requestGenerate({ type: 'due_in_days', days: Number.isFinite(n) && n > 0 ? n : DEFAULT_DUE_IN_DAYS });
            }}
          >
            Generate
          </Button>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
      </CardContent>
    </Card>
  );
}
