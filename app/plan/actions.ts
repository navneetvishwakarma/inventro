'use server';

import { revalidatePath } from 'next/cache';
import * as planActions from '@/lib/plan/actions';
import type { CadenceBucket } from '@/lib/predictions/types';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function runAndRevalidate(catalogItemId: string, fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath('/plan');
  revalidatePath('/');
  revalidatePath('/inventory');
  revalidatePath(`/inventory/${catalogItemId}`);
  return { ok: true };
}

export async function setCadenceOverrideAction(catalogItemId: string, bucket: CadenceBucket | null): Promise<ActionResult> {
  return runAndRevalidate(catalogItemId, () => planActions.setCadenceOverride(catalogItemId, bucket));
}

export async function snoozeItemAction(catalogItemId: string, days: 3 | 7 | 14): Promise<ActionResult> {
  return runAndRevalidate(catalogItemId, () => planActions.snoozeItem(catalogItemId, days));
}

export async function unsnoozeItemAction(catalogItemId: string): Promise<ActionResult> {
  return runAndRevalidate(catalogItemId, () => planActions.unsnoozeItem(catalogItemId));
}

export async function skipOnceAction(catalogItemId: string): Promise<ActionResult> {
  return runAndRevalidate(catalogItemId, () => planActions.skipOnce(catalogItemId));
}

export async function undoSkipAction(catalogItemId: string): Promise<ActionResult> {
  return runAndRevalidate(catalogItemId, () => planActions.undoSkip(catalogItemId));
}

export async function excludeItemAction(catalogItemId: string): Promise<ActionResult> {
  return runAndRevalidate(catalogItemId, () => planActions.excludeItem(catalogItemId));
}

export async function includeItemAction(catalogItemId: string): Promise<ActionResult> {
  return runAndRevalidate(catalogItemId, () => planActions.includeItem(catalogItemId));
}
