'use server';

import { revalidatePath } from 'next/cache';
import { searchCatalogItems, type CatalogSearchResult } from '@/lib/catalog/search';
import { logExistingItemPurchase, checkForDuplicate, createNewItemAndLogPurchase, type DuplicateCheckResult } from '@/lib/catalog/manual-entry';
import { kolkataDateStringToInstant } from '@/lib/date';

export type ActionResult = { ok: true; catalogItemId: string } | { ok: false; error: string };

function revalidateAll(): void {
  revalidatePath('/');
  revalidatePath('/inventory');
  revalidatePath('/plan');
}

export async function searchCatalogAction(query: string): Promise<CatalogSearchResult[]> {
  return searchCatalogItems(query);
}

export async function logExistingItemPurchaseAction(catalogItemId: string, qtyBase: number, unitPrice: number | null, dateString: string): Promise<ActionResult> {
  try {
    const result = await logExistingItemPurchase(catalogItemId, qtyBase, unitPrice, kolkataDateStringToInstant(dateString));
    revalidateAll();
    return { ok: true, catalogItemId: result.catalogItemId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function checkForDuplicateAction(name: string, brand: string | null): Promise<DuplicateCheckResult> {
  return checkForDuplicate(name, brand);
}

export async function createNewItemPurchaseAction(input: {
  name: string;
  brand: string | null;
  categorySlug: string;
  qtyDisplay: string;
  unitDisplay: string;
  unitPrice: number | null;
  dateString: string;
}): Promise<ActionResult> {
  try {
    const result = await createNewItemAndLogPurchase({
      name: input.name,
      brand: input.brand,
      categorySlug: input.categorySlug,
      qtyDisplay: input.qtyDisplay,
      unitDisplay: input.unitDisplay,
      unitPrice: input.unitPrice,
      occurredAt: kolkataDateStringToInstant(input.dateString),
    });
    revalidateAll();
    return { ok: true, catalogItemId: result.catalogItemId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
