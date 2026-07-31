import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getHousehold } from '@/lib/onboarding/data';
import { getCostMeterSummary } from '@/lib/settings/cost-meter';
import { SettingsForm } from './settings-form';
import { DataToolsPanel } from './data-tools-panel';

// Same force-dynamic + onboarding-gate pattern as every other page in this
// app (app/page.tsx, app/insights/page.tsx, ...).
export const dynamic = 'force-dynamic';

// USD, not the app's usual ₹ money() helper (app/insights/page.tsx) --
// parse_cost is USD (lib/llm/cost.ts) and households.monthly_budget is INR;
// mixing the two symbols would misrepresent one as the other. Per-receipt
// costs are fractions of a cent, so 4 decimal places is the minimum that
// shows a real, non-zero number rather than "$0.00" for every value.
function usd(n: number): string {
  return `$${n.toFixed(4)}`;
}

export default async function SettingsPage() {
  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  const costMeter = await getCostMeterSummary();

  return (
    <main style={{ maxWidth: 560, margin: '5vh auto', padding: '0 1rem' }} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Household</CardTitle>
          <CardDescription>Name, monthly grocery budget, and where digest emails go.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm initialName={household.name} initialMonthlyBudget={household.monthly_budget} initialNotifyEmail={household.notify_email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost meter</CardTitle>
          <CardDescription>LLM extraction spend (USD), this month.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold">{usd(costMeter.totalSpendUsd)}</span>
            <span className="text-sm text-muted-foreground">
              {costMeter.receiptCount} receipt{costMeter.receiptCount === 1 ? '' : 's'} parsed, avg {usd(costMeter.avgCostPerReceiptUsd)}/receipt
            </span>
          </div>

          {costMeter.countByModelTier.length > 0 && (
            <div className="flex flex-col gap-1">
              {costMeter.countByModelTier.map((m) => (
                <div key={m.model} className="flex justify-between text-sm">
                  <span>{m.model}</span>
                  <span>{m.count}</span>
                </div>
              ))}
            </div>
          )}

          <div
            className={
              costMeter.hardStopReached
                ? 'rounded border border-destructive bg-destructive/10 p-2 text-sm text-destructive'
                : costMeter.alertReached
                  ? 'rounded border border-amber-500 bg-amber-500/10 p-2 text-sm text-amber-700 dark:border-amber-400 dark:bg-amber-400/10 dark:text-amber-300'
                  : 'text-sm text-muted-foreground'
            }
          >
            {costMeter.hardStopReached
              ? `Daily limit reached: ${costMeter.todayCount} receipts uploaded today. Uploads are blocked until tomorrow.`
              : costMeter.alertReached
                ? `${costMeter.todayCount} receipts uploaded today -- approaching the daily limit of 100.`
                : `${costMeter.todayCount} receipts uploaded today.`}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>Merge, archive, or recategorize items.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/catalog" className="underline">
            Manage catalog
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>Export your data, or reset the synthetic demo household used for prediction validation.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataToolsPanel />
        </CardContent>
      </Card>
    </main>
  );
}
