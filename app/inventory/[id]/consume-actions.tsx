'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BaseUnit } from '@/lib/receipts/canonicalize';
import { usedItUpAction, wastedAction, usedSomeFractionAction, usedSomeAmountAction } from './actions';

const FRACTIONS = [0.25, 0.5, 0.75] as const;

export function ConsumeActions({ catalogItemId, baseUnit }: { catalogItemId: string; baseUnit: BaseUnit }) {
  const [isPending, startTransition] = useTransition();
  const [showUsedSome, setShowUsedSome] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Buttons disable while a request is in flight -- reduces (does not
  // eliminate) the double-submit race consume.ts's own comment documents;
  // a genuine two-concurrent-request race can still double-write.
  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      setError(result.ok ? null : (result.error ?? 'Something went wrong'));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={isPending} onClick={() => run(() => usedItUpAction(catalogItemId))}>
          Used it up
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => setShowUsedSome((v) => !v)}>
          Used some
        </Button>
        <Button size="sm" variant="destructive" disabled={isPending} onClick={() => run(() => wastedAction(catalogItemId))}>
          Wasted
        </Button>
      </div>

      {showUsedSome && (
        <div className="flex flex-wrap items-center gap-2 rounded border p-2">
          {FRACTIONS.map((f) => (
            <Button key={f} size="sm" variant="outline" disabled={isPending} onClick={() => run(() => usedSomeFractionAction(catalogItemId, f))}>
              {f * 100}%
            </Button>
          ))}
          <Input
            type="number"
            min="0"
            step="any"
            placeholder={`Amount (${baseUnit})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32"
          />
          <Button
            size="sm"
            disabled={isPending || amount.trim() === '' || Number.isNaN(Number(amount))}
            onClick={() => {
              const n = Number(amount);
              if (!Number.isFinite(n) || n <= 0) return;
              run(() => usedSomeAmountAction(catalogItemId, n));
              setAmount('');
            }}
          >
            Log
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
