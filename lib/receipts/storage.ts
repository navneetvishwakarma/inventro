import 'server-only';
import { randomUUID } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { getDefaultHouseholdId } from '@/lib/household';
import { contentTypeFor, type AcceptedExtension } from '@/lib/receipts/formats';

const BUCKET = 'receipts';

export async function uploadReceiptFile(bytes: ArrayBuffer, ext: AcceptedExtension, contentHash: string): Promise<{ id: string; storagePath: string }> {
  const supabase = createServiceClient();
  const householdId = getDefaultHouseholdId();
  const storagePath = `${householdId}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: contentTypeFor(ext),
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from('receipts')
    .insert({
      household_id: householdId,
      storage_paths: [storagePath],
      mime: contentTypeFor(ext),
      status: 'pending',
      content_hash: contentHash,
    })
    .select('id')
    .single();

  if (insertError) {
    // Don't leave an orphaned Storage object behind an insert we know failed.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw insertError;
  }

  return { id: data.id, storagePath };
}

export async function getSignedReceiptUrl(storagePath: string, expiresInSeconds = 60): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
