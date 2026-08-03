import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Alert } from '@/components/ui/alert';
import { MobileTopBar } from '@/components/ui/mobile-top-bar';
import { getHousehold } from '@/lib/onboarding/data';
import { getBudgetSummary, getForwardProjection, getTopSpendItems, getPriceAlerts, getWasteReport } from '@/lib/insights/data';
import { formatMoney as money } from '@/lib/format/money';
import { ProgressBar } from './progress-bar';

// Same force-dynamic rationale as app/plan/page.tsx and app/shopping-list/page.tsx
// -- Insights is a live view over the same underlying state everything else
// uses (UX doc's own stated success signal), never a cached/static report.
export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  const [budget, projection, topItems, alerts, waste] = await Promise.all([getBudgetSummary(), getForwardProjection(), getTopSpendItems(), getPriceAlerts(), getWasteReport()]);

  return (
    <>
      <MobileTopBar title="Insights" />
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Spend vs. budget</CardTitle>
          <CardDescription>This month, by category.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold">{money(budget.totalSpend)}</span>
            <span className="text-sm text-muted-foreground">
              {budget.monthlyBudget !== null ? (
                `of ${money(budget.monthlyBudget)} budget`
              ) : (
                <Link href="/settings" className="text-link hover:text-link-hover">
                  Set a budget in Settings
                </Link>
              )}
            </span>
          </div>
          {budget.monthlyBudget !== null && <ProgressBar value={budget.totalSpend} max={budget.monthlyBudget} />}
          <div className="flex flex-col gap-1">
            {budget.byCategory.map((c) => (
              <div key={c.categoryId} className="flex justify-between text-sm">
                <span>{c.categoryName}</span>
                <span className="font-mono">{money(c.spend)}</span>
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
          <CardDescription>A projection from live cadences and prices — not a guarantee.</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="font-mono text-2xl font-semibold">{money(projection.totalMonthlyProjected)}</span>
          {projection.items.slice(0, 10).map((i) => (
            <ListRow key={i.catalogItemId} title={i.canonicalName} trailing={<span className="font-mono text-sm">{money(i.monthlyProjected)}</span>} />
          ))}
          {projection.items.length === 0 && <p className="text-sm text-muted-foreground">Not enough purchase history yet to project next month&apos;s spend.</p>}
          {projection.excludedNoPriceCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {projection.excludedNoPriceCount} item{projection.excludedNoPriceCount === 1 ? '' : 's'} with a known buying cadence but no verified price yet are excluded from this projection.
            </p>
          )}
        </CardContent>
      </Card>

      {/* REQ/S-31 requires a top-10-spend-items surface; the approved
         prototype's Demo doesn't render this card (only Spend/Projection/
         Alerts/Waste) -- kept per "prototype is a visual spec, not a scope
         reduction," styled to match the rest rather than silently dropped. */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 spend items</CardTitle>
          <CardDescription>Trailing 90 days.</CardDescription>
        </CardHeader>
        <CardContent>
          {topItems.length === 0 && <p className="text-sm text-muted-foreground">No priced purchases in the trailing 90 days yet.</p>}
          {topItems.map((i) => (
            <ListRow
              key={i.catalogItemId}
              title={`${i.canonicalName}${i.brand ? ` (${i.brand})` : ''}`}
              trailing={<span className="font-mono text-sm">{money(i.spend)}</span>}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price-change alerts</CardTitle>
          <CardDescription>More than 15% off the trailing average.</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 && <p className="text-sm text-muted-foreground">No notable price changes right now.</p>}
          {alerts.map((a) => (
            <Alert key={a.catalogItemId} tone={a.pctChange > 0 ? 'warning' : 'success'} title={a.canonicalName}>
              {a.merchant ? `${a.merchant} — ` : ''}now {money(a.latestPrice)}/base unit, was averaging {money(a.trailingAvg)}/base unit ({a.pctChange > 0 ? '+' : ''}
              {(a.pctChange * 100).toFixed(0)}%).
            </Alert>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Waste report</CardTitle>
          <CardDescription>This month.</CardDescription>
        </CardHeader>
        <CardContent>
          {waste.items.length === 0 && <p className="text-sm text-muted-foreground">No waste logged this month.</p>}
          {waste.items.map((i) => (
            <ListRow
              key={i.catalogItemId}
              title={i.canonicalName}
              subtitle={i.qtyBaseDisplay}
              trailing={<span className="font-mono text-sm">{i.valuedAmount !== null ? money(i.valuedAmount) : 'value unknown'}</span>}
            />
          ))}
          {waste.items.length > 0 && (
            <p className="pt-1 text-sm">
              Total valued: {money(waste.totalValued)}
              {waste.unvaluedCount > 0 ? ` (${waste.unvaluedCount} item${waste.unvaluedCount === 1 ? '' : 's'} of unknown value not included)` : ''}
            </p>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  );
}
