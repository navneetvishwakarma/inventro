import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getDefaultHouseholdId } from '@/lib/household';
import { currentKolkataDayRange } from '@/lib/date';

// Working spec Sec13 / PRD REQ-25: loop-bug guard -- hard stop at 100
// receipts/day, alert (display-only, not blocking) at 50.
export const DAILY_INGEST_HARD_STOP = 100;
export const DAILY_INGEST_ALERT_THRESHOLD = 50;

// Counts today's (Kolkata calendar day) receipts for the real household --
// every accepted upload creates exactly one receipts row before extraction
// runs (app/add/actions.ts), so this is the same count the guard blocks
// against and the count Settings displays.
export async function getTodayReceiptCount(): Promise<number> {
  const supabase = createServiceClient();
  const { start, end } = currentKolkataDayRange();
  const { count, error } = await supabase
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', getDefaultHouseholdId())
    .gte('created_at', start)
    .lt('created_at', end);
  if (error) throw error;
  return count ?? 0;
}

// Pure boundary logic, exported separately so it's testable without the DB:
// given today's count so far and a batch of N candidate uploads, returns how
// many of the batch are allowed before the hard stop (files before the cap
// succeed, files at/after it are blocked -- never all-or-nothing).
export function allowedCountInBatch(countSoFar: number, batchSize: number): number {
  return Math.max(0, Math.min(batchSize, DAILY_INGEST_HARD_STOP - countSoFar));
}
