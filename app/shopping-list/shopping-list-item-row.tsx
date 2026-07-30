'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { setCheckedAction, logPurchaseAction } from './actions';

// Matches PlanItemActions' convention -- no local optimistic state for the
// server-derived fields, disable while pending, let revalidatePath's
// server refresh drive the next render. Price input is local UI state only
// (the value being typed, not the logged result).
export function ShoppingListItemRow({
  id,
  checked,
  label,
  purchaseLoggedAt,
  loggedPrice,
}: {
  id: string;
  checked: boolean;
  label: string;
  purchaseLoggedAt: string | null;
  loggedPrice: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleCheckboxChange(next: boolean) {
    startTransition(async () => {
      const result = await setCheckedAction(id, next);
      setError(result.ok ? null : (result.error ?? 'Something went wrong'));
    });
  }

  function handleLogPurchase() {
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) return;
    startTransition(async () => {
      const result = await logPurchaseAction(id, value);
      if (result.ok) {
        setPrice('');
        setError(null);
      } else {
        setError(result.error ?? 'Something went wrong');
      }
    });
  }

  return (
    <div className="flex flex-col gap-1 rounded border p-2">
      <label className={`flex items-center gap-2 text-sm ${checked ? 'text-muted-foreground line-through' : ''}`}>
        <input type="checkbox" checked={checked} disabled={isPending} onChange={(e) => handleCheckboxChange(e.target.checked)} />
        {label}
      </label>
      {purchaseLoggedAt !== null ? (
        <span className="text-xs text-muted-foreground">Logged: ₹{loggedPrice}</span>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Price"
            value={price}
            disabled={isPending}
            onChange={(e) => setPrice(e.target.value)}
            className="w-20 rounded border px-2 py-1 text-xs"
          />
          <Button type="button" size="xs" variant="outline" disabled={isPending || !price} onClick={handleLogPurchase}>
            Log purchase
          </Button>
        </div>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
