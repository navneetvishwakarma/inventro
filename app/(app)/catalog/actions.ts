'use server';

import { revalidatePath } from 'next/cache';
import { getMergePreview, mergeCatalogItems, archiveItem, recategorizeItem, type MergePreview, type MergeResult } from '@/lib/catalog/manager';

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateAll(): void {
  revalidatePath('/catalog');
  revalidatePath('/');
  revalidatePath('/inventory');
  revalidatePath('/plan');
}

export async function getMergePreviewAction(itemAId: string, itemBId: string): Promise<{ ok: true; preview: MergePreview } | { ok: false; error: string }> {
  try {
    const preview = await getMergePreview(itemAId, itemBId);
    return { ok: true, preview };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function mergeCatalogItemsAction(survivorId: string, loserId: string): Promise<{ ok: true; result: MergeResult } | { ok: false; error: string }> {
  try {
    const result = await mergeCatalogItems(survivorId, loserId);
    revalidateAll();
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function archiveItemAction(catalogItemId: string, archived: boolean): Promise<ActionResult> {
  try {
    await archiveItem(catalogItemId, archived);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidateAll();
  return { ok: true };
}

export async function recategorizeItemAction(catalogItemId: string, categorySlug: string): Promise<ActionResult> {
  try {
    await recategorizeItem(catalogItemId, categorySlug);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidateAll();
  return { ok: true };
}
