import 'server-only';
import { createRequestClient } from '@/lib/supabase/server';
import { getCurrentHouseholdId } from '@/lib/household';
import { currentKolkataMonthRange } from '@/lib/date';
import { getTodayReceiptCount, DAILY_INGEST_HARD_STOP, DAILY_INGEST_ALERT_THRESHOLD } from '@/lib/receipts/guard';

export type ModelTierCount = { model: string; count: number };

export type CostMeterSummary = {
  monthStart: string;
  monthEnd: string;
  totalSpendUsd: number;
  receiptCount: number;
  avgCostPerReceiptUsd: number;
  totalTokens: number;
  countByModelTier: ModelTierCount[];
  todayCount: number;
  hardStopReached: boolean;
  alertReached: boolean;
};

// parse_cost is USD (lib/llm/cost.ts's estimateCostUsd) -- deliberately
// never mixed with households.monthly_budget, which is an INR grocery
// budget (app/insights/page.tsx's money() helper). Two different
// currencies, two different helpers, never rendered with the same symbol.
export async function getCostMeterSummary(): Promise<CostMeterSummary> {
  const supabase = await createRequestClient();
  const householdId = await getCurrentHouseholdId();
  const { start, end } = currentKolkataMonthRange();

  const [receiptsRes, todayCount] = await Promise.all([
    supabase
      .from('receipts')
      .select('parse_model, parse_tokens, parse_cost')
      .eq('household_id', householdId)
      .gte('created_at', start)
      .lt('created_at', end)
      // Only receipts that actually got a real LLM call count toward spend --
      // a manual-entry-fallback receipt with parse_cost=null never diluted
      // the average toward zero.
      .not('parse_cost', 'is', null),
    getTodayReceiptCount(),
  ]);
  if (receiptsRes.error) throw receiptsRes.error;

  const rows = (receiptsRes.data ?? []) as { parse_model: string | null; parse_tokens: number | null; parse_cost: number | null }[];

  const totalSpendUsd = rows.reduce((sum, r) => sum + (r.parse_cost ?? 0), 0);
  const totalTokens = rows.reduce((sum, r) => sum + (r.parse_tokens ?? 0), 0);
  const receiptCount = rows.length;
  const avgCostPerReceiptUsd = receiptCount > 0 ? totalSpendUsd / receiptCount : 0;

  const countByModel = new Map<string, number>();
  for (const r of rows) {
    const model = r.parse_model ?? 'unknown';
    countByModel.set(model, (countByModel.get(model) ?? 0) + 1);
  }
  const countByModelTier: ModelTierCount[] = [...countByModel.entries()].map(([model, count]) => ({ model, count }));

  return {
    monthStart: start,
    monthEnd: end,
    totalSpendUsd,
    receiptCount,
    avgCostPerReceiptUsd,
    totalTokens,
    countByModelTier,
    todayCount,
    hardStopReached: todayCount >= DAILY_INGEST_HARD_STOP,
    alertReached: todayCount >= DAILY_INGEST_ALERT_THRESHOLD,
  };
}
