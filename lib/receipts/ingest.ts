import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getDefaultHouseholdId } from '@/lib/household';

export async function createIngestJob(receiptId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('ingest_jobs').insert({
    household_id: getDefaultHouseholdId(),
    receipt_id: receiptId,
    state: 'queued',
  });
  if (error) throw error;
}
