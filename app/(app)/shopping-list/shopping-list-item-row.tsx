'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format/money';
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
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
      <Checkbox
        id={`shopping-item-${id}`}
        checked={checked}
        disabled={isPending}
        onChange={handleCheckboxChange}
        label={<span className={cn(checked && 'text-muted-foreground line-through')}>{label}</span>}
      />
      {purchaseLoggedAt !== null ? (
        <span className="ml-[52px] text-xs text-muted-foreground">Logged: {loggedPrice !== null ? formatMoney(loggedPrice) : '—'}</span>
      ) : (
        <div className="ml-[52px] flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            aria-label="Total paid"
            placeholder="Total paid"
            value={price}
            disabled={isPending}
            onChange={(e) => setPrice(e.target.value)}
            size="sm"
            className="w-28"
          />
          <Button type="button" size="sm" variant="outline" disabled={isPending || !price} onClick={handleLogPurchase}>
            Log purchase
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
