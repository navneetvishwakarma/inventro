import 'server-only';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { getDefaultHouseholdId } from '@/lib/household';

export function hashFileBytes(bytes: ArrayBuffer): string {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

// S-25: one combined hash over an ORDERED set of files, for the grouped
// (multi-image-as-one-order) upload path. Deliberately a single hash of the
// concatenated bytes, not independent per-file hashes -- this only catches an
// identical re-submission of the same grouping+order, not the same images
// re-uploaded individually (documented limit, see S-25 spec).
export function hashCombinedFileBytes(byteList: ArrayBuffer[]): string {
  return createHash('sha256')
    .update(Buffer.concat(byteList.map((b) => Buffer.from(b))))
    .digest('hex');
}

// Runs before any Storage write or DB insert (invariant: a rejected
// duplicate must not leave orphaned Storage objects or partial rows).
export async function findDuplicateReceipt(contentHash: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('receipts')
    .select('id')
    .eq('household_id', getDefaultHouseholdId())
    .eq('content_hash', contentHash)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// Near-duplicate: same (merchant, purchased_at, total_amount) from a
// different file. Only checkable once parsing completes (S-06/S-07) since
// those fields don't exist before then. Flags, never blocks — exact-field
// equality only, no fuzzy matching (working spec's plain description).
export async function flagNearDuplicateIfAny(receiptId: string, merchant: string | null, purchasedAt: string | null, totalAmount: number | null): Promise<void> {
  if (!merchant || !purchasedAt || totalAmount === null) return;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('receipts')
    .select('id')
    .eq('household_id', getDefaultHouseholdId())
    .eq('merchant', merchant)
    .eq('purchased_at', purchasedAt)
    .eq('total_amount', totalAmount)
    .neq('id', receiptId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;

  const { error: updateError } = await supabase.from('receipts').update({ near_duplicate_of: data.id }).eq('id', receiptId);
  if (updateError) throw updateError;
}
