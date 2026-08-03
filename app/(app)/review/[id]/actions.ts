'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { confirmPurchaseDate, saveAndMatchLine, confirmAsNewItem, markLineNonInventory } from '@/lib/review/data';
import { commitReceipt } from '@/lib/review/commit';
import { runExtraction } from '@/lib/llm/extract';

export type ActionResult = { ok: true } | { ok: false; error: string };

function asResult(fn: () => Promise<void>): Promise<ActionResult> {
  return fn()
    .then(() => ({ ok: true as const }))
    .catch((err) => ({ ok: false as const, error: err instanceof Error ? err.message : String(err) }));
}

export async function confirmPurchaseDateAction(receiptId: string, dateString: string): Promise<ActionResult> {
  const result = await asResult(() => confirmPurchaseDate(receiptId, dateString));
  revalidatePath(`/review/${receiptId}`);
  return result;
}

export async function saveAndMatchLineAction(
  receiptId: string,
  lineId: string,
  edits: { itemName: string; brand: string | null; categorySlug: string; qtyDisplay: string | null; unitDisplay: string | null },
): Promise<ActionResult> {
  const result = await asResult(() => saveAndMatchLine(lineId, edits));
  revalidatePath(`/review/${receiptId}`);
  return result;
}

export async function confirmAsNewItemAction(
  receiptId: string,
  lineId: string,
  edits: { itemName: string; brand: string | null; categorySlug: string; qtyDisplay: string | null; unitDisplay: string | null; packSize: string | null },
): Promise<ActionResult> {
  const result = await asResult(() => confirmAsNewItem(lineId, edits));
  revalidatePath(`/review/${receiptId}`);
  return result;
}

export async function markLineNonInventoryAction(receiptId: string, lineId: string): Promise<ActionResult> {
  const result = await asResult(() => markLineNonInventory(lineId));
  revalidatePath(`/review/${receiptId}`);
  return result;
}

export async function commitReceiptAction(receiptId: string, pastOrderOverride: boolean): Promise<ActionResult> {
  const result = await asResult(() => commitReceipt(receiptId, pastOrderOverride));
  revalidatePath(`/review/${receiptId}`);
  revalidatePath('/review');
  return result;
}

// S-67: re-runs the exact same extraction path a fresh upload uses
// (app/(app)/add/actions.ts's after(() => runExtraction(id))) against a
// receipt whose prior attempt failed. Safe to call again -- a failed
// attempt never inserts receipt_lines (lib/llm/extract.ts returns before
// that step on failure), so there's nothing to duplicate, and
// runExtraction updates the same ingest_jobs row in place rather than
// requiring a new one.
export async function retryExtractionAction(receiptId: string): Promise<ActionResult> {
  after(() => runExtraction(receiptId));
  revalidatePath(`/review/${receiptId}`);
  revalidatePath('/review');
  return { ok: true };
}
