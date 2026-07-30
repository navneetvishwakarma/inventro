import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getHousehold } from '@/lib/onboarding/data';
import { getBudgetSummary, getForwardProjection, getTopSpendItems, getPriceAlerts, getWasteReport } from '@/lib/insights/data';

// Same force-dynamic rationale as app/plan/page.tsx and app/shopping-list/page.tsx
// -- Insights is a live view over the same underlying state everything else
// uses (UX doc's own stated success signal), never a cached/static report.
export const dynamic = 'force-dynamic';

function money(n: number): string {
  return `₹${n.toFixed(2)}`;
}

export default async function InsightsPage() {
  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  const [budget, projection, topItems, alerts, waste] = await Promise.all([getBudgetSummary(), getForwardProjection(), getTopSpendItems(), getPriceAlerts(), getWasteReport()]);

  return (
    <main style={{ maxWidth: 720, margin: '5vh auto', padding: '0 1rem' }} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Spend vs. budget</CardTitle>
          <CardDescription>This month, by category.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold">{money(budget.totalSpend)}</span>
            <span className="text-sm text-muted-foreground">{budget.monthlyBudget !== null ? `of ${money(budget.monthlyBudget)} budget` : 'no budget set yet'}</span>
          </div>
          <div className="flex flex-col gap-1">
            {budget.byCategory.map((c) => (
              <div key={c.categoryId} className="flex justify-between text-sm">
                <span>{c.categoryName}</span>
                <span>{money(c.spend)}</span>
              </div>
            ))}
          </div>
          {budget.legacyExcludedCount > 0 && (
            <p className="text-xs text-muted-foreground">{budget.legacyExcludedCount} purchase{budget.legacyExcludedCount === 1 ? '' : 's'} this month have no verified price basis and are excluded from these totals.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next month&apos;s committed spend</CardTitle>
          <CardDescription>A projection from live cadences and prices -- not a guarantee.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <span className="text-2xl font-semibold">{money(projection.totalMonthlyProjected)}</span>
          <div className="flex flex-col gap-1">
            {projection.items.slice(0, 10).map((i) => (
              <div key={i.catalogItemId} className="flex justify-between text-sm">
                <span>{i.canonicalName}</span>
                <span>{money(i.monthlyProjected)}</span>
              </div>
            ))}
          </div>
          {projection.items.length === 0 && <p className="text-sm text-muted-foreground">Not enough purchase history yet to project next month&apos;s spend.</p>}
          {projection.excludedNoPriceCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {projection.excludedNoPriceCount} item{projection.excludedNoPriceCount === 1 ? '' : 's'} with a known buying cadence but no verified price yet are excluded from this projection.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 spend items</CardTitle>
          <CardDescription>Trailing 90 days.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {topItems.length === 0 && <p className="text-sm text-muted-foreground">No priced purchases in the trailing 90 days yet.</p>}
          {topItems.map((i) => (
            <div key={i.catalogItemId} className="flex justify-between text-sm">
              <span>
                {i.canonicalName}
                {i.brand ? ` (${i.brand})` : ''}
              </span>
              <span>{money(i.spend)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price-change alerts</CardTitle>
          <CardDescription>More than 15% off the trailing average.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {alerts.length === 0 && <p className="text-sm text-muted-foreground">No notable price changes right now.</p>}
          {alerts.map((a) => (
            <div key={a.catalogItemId} className="rounded border p-2 text-sm">
              <div className="flex justify-between font-medium">
                <span>{a.canonicalName}</span>
                <span className={a.pctChange > 0 ? 'text-red-600' : 'text-green-700'}>
                  {a.pctChange > 0 ? '+' : ''}
                  {(a.pctChange * 100).toFixed(0)}%
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {a.merchant ? `${a.merchant} -- ` : ''}now {money(a.latestPrice)}/base unit, was averaging {money(a.trailingAvg)}/base unit
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Waste report</CardTitle>
          <CardDescription>This month.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {waste.items.length === 0 && <p className="text-sm text-muted-foreground">No waste logged this month.</p>}
          <div className="flex flex-col gap-1">
            {waste.items.map((i) => (
              <div key={i.catalogItemId} className="flex justify-between text-sm">
                <span>{i.canonicalName}</span>
                <span>
                  {i.qtyBaseDisplay}
                  {i.valuedAmount !== null ? ` -- ${money(i.valuedAmount)}` : ' -- value unknown'}
                </span>
              </div>
            ))}
          </div>
          {waste.items.length > 0 && (
            <p className="text-sm">
              Total valued: {money(waste.totalValued)}
              {waste.unvaluedCount > 0 ? ` (${waste.unvaluedCount} item${waste.unvaluedCount === 1 ? '' : 's'} of unknown value not included)` : ''}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
