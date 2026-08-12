'use server';

import { revalidatePath } from 'next/cache';
import { recordConsumption, type ConsumeAction } from '@/lib/inventory/consume';
import { archiveItem, setStaple, setPerishabilityDays } from '@/lib/catalog/manager';
import { setCadenceOverride } from '@/lib/plan/actions';
import type { CadenceBucket } from '@/lib/predictions/types';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function runAndRevalidate(catalogItemId: string, action: ConsumeAction): Promise<ActionResult> {
  let result;
  try {
    result = await recordConsumption(catalogItemId, action);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  // S-94: recordConsumption previously no-op'd silently ({ok: true}, no
  // write) whenever stock was already at zero -- the confirm panel this
  // story adds would otherwise close with nothing visibly having happened
  // and no explanation. Not a real failure, but ActionResult has no
  // "false alarm" shape distinct from ok:false -- reusing it is the
  // pragmatic minimal change, matching how every other soft/expected
  // rejection in this file already surfaces (inline via the same error
  // Alert / ConfirmPanel error prop).
  if (!result.wrote) {
    return { ok: false, error: 'Nothing to log -- this item is already at zero stock.' };
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

// S-72: F8 spec-parity -- archive, staple, perishability, and cadence
// override were previously only reachable via the separate Catalog/Plan
// pages. Reuses the existing lib write functions unchanged, just exposed
// here too.
async function runAdminAction(catalogItemId: string, fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath(`/inventory/${catalogItemId}`);
  revalidatePath('/inventory');
  revalidatePath('/plan');
  return { ok: true };
}

export async function archiveItemAction(catalogItemId: string, archived: boolean): Promise<ActionResult> {
  return runAdminAction(catalogItemId, () => archiveItem(catalogItemId, archived));
}

export async function setStapleAction(catalogItemId: string, isStaple: boolean): Promise<ActionResult> {
  return runAdminAction(catalogItemId, () => setStaple(catalogItemId, isStaple));
}

export async function setPerishabilityDaysAction(catalogItemId: string, perishabilityDays: number | null): Promise<ActionResult> {
  return runAdminAction(catalogItemId, () => setPerishabilityDays(catalogItemId, perishabilityDays));
}

export async function setCadenceOverrideAction(catalogItemId: string, bucket: CadenceBucket | null): Promise<ActionResult> {
  return runAdminAction(catalogItemId, () => setCadenceOverride(catalogItemId, bucket));
}
