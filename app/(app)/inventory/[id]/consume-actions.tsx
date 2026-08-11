'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { ConfirmPanel } from '@/components/ui/confirm-panel';
import type { BaseUnit } from '@/lib/receipts/canonicalize';
import { usedItUpAction, wastedAction, usedSomeFractionAction, usedSomeAmountAction } from './actions';

const FRACTIONS = [0.25, 0.5, 0.75] as const;

// S-69: 'Used it up' and 'Wasted' both write a stock_movement immediately
// on click, with no undo -- the two ledger-writing actions this story
// names explicitly. 'Used some' already requires typing an amount and a
// separate Log click, which is its own confirmation step, so it's left as
// is.
// S-94: the 25/50/75% quick-fraction buttons wrote on a single tap with no
// confirm step at all -- the only ledger-writing actions in this file that
// didn't. Routed through the same PendingConfirm union, carrying the
// fraction so the panel can label itself accordingly.
type PendingConfirm = 'used-it-up' | 'wasted' | { kind: 'fraction'; fraction: (typeof FRACTIONS)[number] } | null;

export function ConsumeActions({ catalogItemId, baseUnit }: { catalogItemId: string; baseUnit: BaseUnit }) {
  const [isPending, startTransition] = useTransition();
  const [showUsedSome, setShowUsedSome] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  // Buttons disable while a request is in flight -- reduces (does not
  // eliminate) the double-submit race consume.ts's own comment documents;
  // a genuine two-concurrent-request race can still double-write.
  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setError(null);
        setPendingConfirm(null);
      } else {
        // Stays open on failure so the error renders in the confirm
        // panel itself, with Retry/Cancel right there -- not silently
        // dropped back to the plain button row.
        setError(result.error ?? 'Something went wrong');
      }
    });
  }

  if (pendingConfirm) {
    const isFraction = typeof pendingConfirm === 'object';
    const fractionPct = isFraction ? pendingConfirm.fraction * 100 : null;
    return (
      <ConfirmPanel
        title={isFraction ? `Log ${fractionPct}% used?` : pendingConfirm === 'used-it-up' ? 'Mark as used up?' : 'Mark as wasted?'}
        description="Logs this to your purchase history now -- there's no undo."
        confirmLabel={isFraction ? `Log ${fractionPct}%` : pendingConfirm === 'used-it-up' ? 'Used it up' : 'Wasted'}
        confirmVariant={pendingConfirm === 'wasted' ? 'destructive' : 'primary'}
        pending={isPending}
        error={error}
        onConfirm={() =>
          run(() =>
            isFraction
              ? usedSomeFractionAction(catalogItemId, pendingConfirm.fraction)
              : pendingConfirm === 'used-it-up'
                ? usedItUpAction(catalogItemId)
                : wastedAction(catalogItemId),
          )
        }
        onCancel={() => setPendingConfirm(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={isPending} onClick={() => setPendingConfirm('used-it-up')}>
          Used it up
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => setShowUsedSome((v) => !v)}>
          Used some
        </Button>
        <Button size="sm" variant="destructive" disabled={isPending} onClick={() => setPendingConfirm('wasted')}>
          Wasted
        </Button>
      </div>

      {showUsedSome && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
          {FRACTIONS.map((f) => (
            <Button key={f} size="sm" variant="outline" disabled={isPending} onClick={() => setPendingConfirm({ kind: 'fraction', fraction: f })}>
              {f * 100}%
            </Button>
          ))}
          <Input
            type="number"
            min="0"
            step="any"
            aria-label={`Amount used (${baseUnit})`}
            placeholder={`Amount (${baseUnit})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            size="sm"
            className="w-32"
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending || !(Number.isFinite(Number(amount)) && Number(amount) > 0)}
            onClick={() => {
              const n = Number(amount);
              run(() => usedSomeAmountAction(catalogItemId, n));
              setAmount('');
            }}
          >
            Log
          </Button>
          {amount.trim() !== '' && !(Number.isFinite(Number(amount)) && Number(amount) > 0) && (
            <p className="w-full text-xs text-error">Enter an amount greater than 0.</p>
          )}
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
