'use client';

import { useTransition } from 'react';
import { setCheckedAction } from './actions';

// S-23 scope: plain cross-off, no ledger write. S-24 adds a price-logging
// control to this same row once purchase_logged_at exists. Matches
// PlanItemActions' convention -- no local optimistic state, disable while
// pending, let revalidatePath's server refresh drive the next render.
export function ShoppingListItemRow({ id, checked, label }: { id: string; checked: boolean; label: string }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    startTransition(() => {
      void setCheckedAction(id, next);
    });
  }

  return (
    <label className={`flex items-center gap-2 rounded border p-2 text-sm ${checked ? 'text-muted-foreground line-through' : ''}`}>
      <input type="checkbox" checked={checked} disabled={isPending} onChange={(e) => handleChange(e.target.checked)} />
      {label}
    </label>
  );
}
