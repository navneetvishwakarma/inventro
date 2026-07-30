'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { getDefaultHouseholdId } from '@/lib/household';
import { generateShoppingList, type ShoppingListSource } from '@/lib/shopping-list/generate';

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

// No-price cross-off path: a plain checked-column update, no ledger write
// (S-24 adds the price-logging path in lib/shopping-list/checkoff.ts).
export async function setCheckedAction(shoppingListItemId: string, checked: boolean): Promise<ActionResult> {
  const householdId = getDefaultHouseholdId();
  const { error } = await createServiceClient().from('shopping_list_items').update({ checked }).eq('id', shoppingListItemId).eq('household_id', householdId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/shopping-list');
  return { ok: true };
}
