import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getDefaultHouseholdId } from '@/lib/household';
import { getSignedReceiptUrl } from '@/lib/receipts/storage';
import { normalizeText, normalizeUnitToBase, matchCatalogItem, type BaseUnit } from '@/lib/receipts/canonicalize';
import { toKolkataDateString, kolkataDateStringToInstant } from '@/lib/date';

export type ReviewQueueItem = {
  id: string;
  merchant: string | null;
  purchased_at: string | null;
  total_amount: number | null;
  created_at: string;
};

// S-12: receipts land here once extraction (S-06/S-07) and canonicalization
// (E-3) have run -- status only ever becomes 'parsed' after both finish
// (lib/llm/extract.ts sets it last), so this list is never missing
// review_state on its lines.
export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('receipts')
    .select('id, merchant, purchased_at, total_amount, created_at')
    .eq('household_id', getDefaultHouseholdId())
    .eq('status', 'parsed')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type ReceiptForReview = {
  id: string;
  storage_paths: string[];
  mime: string | null;
  merchant: string | null;
  purchased_at: string | null;
  purchased_at_confirmed: boolean;
  date_source: string | null;
  near_duplicate_of: string | null;
  status: string;
};

export async function getReceiptForReview(receiptId: string): Promise<ReceiptForReview | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('receipts')
    .select('id, storage_paths, mime, merchant, purchased_at, purchased_at_confirmed, date_source, near_duplicate_of, status')
    .eq('id', receiptId)
    .eq('household_id', getDefaultHouseholdId())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDocumentPreviewUrl(storagePath: string): Promise<string> {
  return getSignedReceiptUrl(storagePath, 300);
}

// S-28: raw text has nothing useful to render via a signed URL + <img>/
// <embed> -- fetched and decoded server-side, unlike every other mime, which
// gets a signed URL instead.
export async function getDocumentPreviewText(storagePath: string): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from('receipts').download(storagePath);
  if (error || !data) throw error ?? new Error('download returned no data');
  return Buffer.from(await data.arrayBuffer()).toString('utf-8');
}

type ReceiptLineRow = {
  id: string;
  line_no: number;
  raw_text: string;
  item_name: string | null;
  brand: string | null;
  category_slug: string | null;
  qty_display: string | null;
  unit_display: string | null;
  pack_size: string | null;
  unit_price: number | null;
  line_total: number | null;
  qty_base: number | null;
  matched_item_id: string | null;
  match_confidence: number | null;
  review_state: string;
  catalog_items: { canonical_name: string; brand: string | null } | null;
};

export type ReceiptLineForReview = ReceiptLineRow;

export async function getReceiptLines(receiptId: string): Promise<ReceiptLineForReview[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('receipt_lines')
    .select(
      'id, line_no, raw_text, item_name, brand, category_slug, qty_display, unit_display, pack_size, unit_price, line_total, qty_base, matched_item_id, match_confidence, review_state, catalog_items(canonical_name, brand)',
    )
    .eq('receipt_id', receiptId)
    .order('line_no');
  if (error) throw error;
  return (data ?? []) as unknown as ReceiptLineRow[];
}

export type LeafCategory = { slug: string; name: string };

export async function getLeafCategories(): Promise<LeafCategory[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('categories').select('slug, name').not('parent_id', 'is', null).order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getStockEpoch(): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('households').select('stock_epoch').eq('id', getDefaultHouseholdId()).single();
  if (error) throw error;
  return data.stock_epoch;
}

function isValidDateString(value: string): boolean {
  if (!value.trim()) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

// S-12: the ONLY write path for receipts.purchased_at. Always sets
// purchased_at + purchased_at_confirmed together (A21) -- there is no
// action anywhere that clears purchased_at while leaving the flag true, and
// no action that sets the flag without a concrete date.
export async function confirmPurchaseDate(receiptId: string, dateString: string): Promise<void> {
  if (!isValidDateString(dateString)) throw new Error('Invalid date');

  const supabase = createServiceClient();
  const { data: existing, error: existingError } = await supabase.from('receipts').select('purchased_at, date_source').eq('id', receiptId).single();
  if (existingError) throw existingError;

  // Kolkata midnight, not UTC midnight (new Date(dateString).toISOString()
  // would drift the calendar day by the +5:30 offset) -- this is the exact
  // boundary the past-order banner and commit_receipt's override guard
  // compare against, so a systematic UTC/local mismatch here silently
  // misclassifies same-day receipts. Caught by advisor review before ship.
  const isoDate = kolkataDateStringToInstant(dateString);
  const unchanged = existing.purchased_at !== null && toKolkataDateString(existing.purchased_at) === dateString;

  const { error } = await supabase
    .from('receipts')
    .update({
      purchased_at: isoDate,
      purchased_at_confirmed: true,
      date_source: unchanged ? existing.date_source : 'manual',
    })
    .eq('id', receiptId);
  if (error) throw error;
}

// S-12 "Save & match": re-runs S-09's exact ladder against a human-edited
// line, once, on this one row only. Never called from S-13's commit path.
export async function saveAndMatchLine(
  lineId: string,
  edits: { itemName: string; brand: string | null; categorySlug: string; qtyDisplay: string | null; unitDisplay: string | null },
): Promise<void> {
  const supabase = createServiceClient();
  const { data: line, error: lineError } = await supabase.from('receipt_lines').select('household_id, pack_size').eq('id', lineId).single();
  if (lineError) throw lineError;

  const normalized = normalizeText(`${edits.brand ? `${edits.brand} ` : ''}${edits.itemName}`);
  const match = await matchCatalogItem(supabase, line.household_id, normalized);

  const baseUpdate = {
    item_name: edits.itemName,
    brand: edits.brand,
    category_slug: edits.categorySlug,
    qty_display: edits.qtyDisplay,
    unit_display: edits.unitDisplay,
  };

  if (match.state !== 'matched') {
    const { error } = await supabase
      .from('receipt_lines')
      .update({ ...baseUpdate, matched_item_id: null, match_confidence: match.matchConfidence, review_state: match.state, qty_base: null })
      .eq('id', lineId);
    if (error) throw error;
    return;
  }

  const { data: catalogItem, error: catalogItemError } = await supabase.from('catalog_items').select('base_unit').eq('id', match.matchedItemId).single();
  if (catalogItemError) throw catalogItemError;

  const { qtyBase, ambiguous } = normalizeUnitToBase(edits.qtyDisplay, edits.unitDisplay, line.pack_size, catalogItem.base_unit as BaseUnit);
  const reviewState = edits.categorySlug === 'uncategorized' || ambiguous ? 'needs_review' : 'matched';

  const { error } = await supabase
    .from('receipt_lines')
    .update({ ...baseUpdate, matched_item_id: match.matchedItemId, match_confidence: match.matchConfidence, qty_base: qtyBase, review_state: reviewState })
    .eq('id', lineId);
  if (error) throw error;
}

// S-12 "Confirm as new item": locks the line's review_state to 'new_item'
// with the human-edited fields. Rejected for 'uncategorized' -- S-13's
// commit_receipt() would reject it too (server-side backstop), but failing
// here gives the user an immediate, actionable error.
export async function confirmAsNewItem(
  lineId: string,
  edits: { itemName: string; brand: string | null; categorySlug: string; qtyDisplay: string | null; unitDisplay: string | null; packSize: string | null },
): Promise<void> {
  if (edits.categorySlug === 'uncategorized') throw new Error('Pick a real category before confirming a new item');

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('receipt_lines')
    .update({
      item_name: edits.itemName,
      brand: edits.brand,
      category_slug: edits.categorySlug,
      qty_display: edits.qtyDisplay,
      unit_display: edits.unitDisplay,
      pack_size: edits.packSize,
      matched_item_id: null,
      review_state: 'new_item',
    })
    .eq('id', lineId);
  if (error) throw error;
}

export async function markLineNonInventory(lineId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('receipt_lines').update({ is_non_inventory: true, review_state: 'excluded', matched_item_id: null, qty_base: null }).eq('id', lineId);
  if (error) throw error;
}
