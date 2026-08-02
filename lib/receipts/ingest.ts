import 'server-only';
import { createRequestClient } from '@/lib/supabase/server';
import { getCurrentHouseholdId } from '@/lib/household';

export async function createIngestJob(receiptId: string): Promise<void> {
  const supabase = await createRequestClient();
  const { error } = await supabase.from('ingest_jobs').insert({
    household_id: await getCurrentHouseholdId(),
    receipt_id: receiptId,
    state: 'queued',
  });
  if (error) throw error;
}
