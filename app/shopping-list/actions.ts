'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { generateShoppingList, type ShoppingListSource } from '@/lib/shopping-list/generate';
import { setChecked, logShoppingListPurchase } from '@/lib/shopping-list/checkoff';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function generateShoppingListAction(source: ShoppingListSource): Promise<void> {
  await generateShoppingList(source);
  revalidatePath('/shopping-list');
  redirect('/shopping-list');
}

const DEFAULT_DUE_IN_DAYS = 3;

// Native <form action> can't bind a runtime user-entered value the way
// generateShoppingListAction.bind(null, {type:'bucket', bucket}) does for
// the fixed bucket buttons -- this reads the days value out of FormData.
export async function generateDueInDaysAction(formData: FormData): Promise<void> {
  const raw = formData.get('days');
  const days = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : DEFAULT_DUE_IN_DAYS;
  await generateShoppingListAction({ type: 'due_in_days', days: Number.isFinite(days) && days > 0 ? days : DEFAULT_DUE_IN_DAYS });
}

function revalidateAll(): void {
  revalidatePath('/shopping-list');
  revalidatePath('/plan');
  revalidatePath('/');
  revalidatePath('/inventory');
}

// No-price cross-off path: a plain checked-column update, no ledger write.
export async function setCheckedAction(shoppingListItemId: string, checked: boolean): Promise<ActionResult> {
  try {
    await setChecked(shoppingListItemId, checked);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath('/shopping-list');
  return { ok: true };
}

// Price-logging path (S-24): writes a real purchase, changes predicted
// dates/cadence -- revalidates every screen that surfaces those.
export async function logPurchaseAction(shoppingListItemId: string, unitPrice: number): Promise<ActionResult> {
  try {
    await logShoppingListPurchase(shoppingListItemId, unitPrice);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidateAll();
  return { ok: true };
}
