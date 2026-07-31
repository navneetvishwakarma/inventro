'use server';

import { revalidatePath } from 'next/cache';
import { recordConsumption, type ConsumeAction } from '@/lib/inventory/consume';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function runAndRevalidate(catalogItemId: string, action: ConsumeAction): Promise<ActionResult> {
  try {
    await recordConsumption(catalogItemId, action);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath(`/inventory/${catalogItemId}`);
  revalidatePath('/inventory');
  revalidatePath('/');
  return { ok: true };
}

export async function usedItUpAction(catalogItemId: string): Promise<ActionResult> {
  return runAndRevalidate(catalogItemId, { kind: 'used_up' });
}

export async function wastedAction(catalogItemId: string): Promise<ActionResult> {
  return runAndRevalidate(catalogItemId, { kind: 'wasted' });
}

export async function usedSomeFractionAction(catalogItemId: string, fraction: 0.25 | 0.5 | 0.75): Promise<ActionResult> {
  return runAndRevalidate(catalogItemId, { kind: 'used_some_fraction', fraction });
}

export async function usedSomeAmountAction(catalogItemId: string, amountBase: number): Promise<ActionResult> {
  return runAndRevalidate(catalogItemId, { kind: 'used_some_amount', amountBase });
}
