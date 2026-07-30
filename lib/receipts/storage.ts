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

// S-25: grouped upload for the multi-image-as-one-order toggle. Uploads each
// file to its own Storage object under the household prefix, in order, then
// inserts ONE receipts row referencing all of them -- mirrors
// uploadReceiptFile's shape but for N files -> 1 receipt instead of 1 -> 1.
// Any failure after one or more Storage uploads have already succeeded removes
// ALL of them before rethrowing (extends uploadReceiptFile's single-object
// no-orphans cleanup to the plural case).
export async function uploadGroupedReceiptFiles(files: { bytes: ArrayBuffer; ext: AcceptedExtension }[], contentHash: string): Promise<{ id: string; storagePaths: string[] }> {
  const supabase = createServiceClient();
  const householdId = getDefaultHouseholdId();
  const storagePaths: string[] = [];

  try {
    for (const file of files) {
      const storagePath = `${householdId}/${randomUUID()}.${file.ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file.bytes, {
        contentType: contentTypeFor(file.ext),
        upsert: false,
      });
      if (uploadError) throw uploadError;
      storagePaths.push(storagePath);
    }

    const { data, error: insertError } = await supabase
      .from('receipts')
      .insert({
        household_id: householdId,
        storage_paths: storagePaths,
        mime: contentTypeFor(files[0].ext),
        status: 'pending',
        content_hash: contentHash,
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    return { id: data.id, storagePaths };
  } catch (err) {
    if (storagePaths.length > 0) await supabase.storage.from(BUCKET).remove(storagePaths);
    throw err;
  }
}

export async function getSignedReceiptUrl(storagePath: string, expiresInSeconds = 60): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
