import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MobileTopBar } from '@/components/ui/mobile-top-bar';
import { getHousehold } from '@/lib/onboarding/data';
import { getPlanItems, type PlanItem } from '@/lib/plan/data';
import { formatBaseQty, formatDueDate, formatCadenceBucket, CADENCE_BUCKET_ORDER } from '@/lib/inventory/format';
import { formatMoney } from '@/lib/format/money';
import type { CadenceBucket } from '@/lib/predictions/types';
import { PlanItemActions } from './plan-item-actions';
import { PlanBucketTabs } from './bucket-tabs';

// Same force-dynamic rationale as app/page.tsx / app/inventory/page.tsx --
// must reflect the latest recompute and any manual action on every load.
export const dynamic = 'force-dynamic';

type SearchParams = { bucket?: string };

function isCadenceBucket(value: string): value is CadenceBucket {
  return (CADENCE_BUCKET_ORDER as readonly string[]).includes(value);
}

// F11's tabs show everything assigned to a bucket, not just items literally
// due today -- a "weekly" tab that only lit up on the exact due day would be
// nearly always empty and defeat the point of browsing a cadence group. Due
// date is still shown per row so the user can see what's coming up within
// the bucket. Recorded here rather than left an accident: see
// .claude/epic-8/ledger.md.
function pickDefaultBucket(items: PlanItem[]): CadenceBucket {
  const withActiveItem = CADENCE_BUCKET_ORDER.find((b) => items.some((i) => i.cadenceBucket === b && i.planState === 'pending'));
  if (withActiveItem) return withActiveItem;
  const withAnyItem = CADENCE_BUCKET_ORDER.find((b) => items.some((i) => i.cadenceBucket === b));
  return withAnyItem ?? 'daily';
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  const params = await searchParams;
  const items = await getPlanItems();

  const selectedBucket = params.bucket && isCadenceBucket(params.bucket) ? params.bucket : pickDefaultBucket(items);

  const countsByBucket = new Map<CadenceBucket, number>();
  for (const item of items) {
    if (item.cadenceBucket === null) continue;
    countsByBucket.set(item.cadenceBucket, (countsByBucket.get(item.cadenceBucket) ?? 0) + 1);
  }

  const bucketItems = items
    .filter((i) => i.cadenceBucket === selectedBucket)
    .sort((a, b) => {
      if (a.dueDate === null && b.dueDate === null) return 0;
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  // S-72/F12: avgUnitPrice90d is per-purchase-event average (what you
  // typically pay when you buy this item), not scaled by suggestedQtyBase
  // -- reused as-is since it's the same field item-detail's own "Avg price
  // (90d)" stat already shows, not a new price definition. Items with no
  // price history (avgUnitPrice90d === null) are excluded from the sum and
  // counted separately so the total doesn't silently understate itself.
  const itemsWithPrice = bucketItems.filter((i) => i.avgUnitPrice90d !== null);
  const estimatedTotal = itemsWithPrice.reduce((sum, i) => sum + (i.avgUnitPrice90d as number), 0);
  const itemsMissingPrice = bucketItems.length - itemsWithPrice.length;

  return (
    <>
      <MobileTopBar title="Plan" />
      <div className="flex w-full flex-col gap-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>
            {items.length} item{items.length === 1 ? '' : 's'} being planned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlanBucketTabs
            active={selectedBucket}
            items={CADENCE_BUCKET_ORDER.map((bucket) => ({
              value: bucket,
              label: formatCadenceBucket(bucket),
              count: countsByBucket.get(bucket) ?? 0,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>{formatCadenceBucket(selectedBucket)}</CardTitle>
            <CardDescription>
              {bucketItems.length} item{bucketItems.length === 1 ? '' : 's'} in this bucket.
            </CardDescription>
          </div>
          {itemsWithPrice.length > 0 && (
            <div className="text-right">
              <span className="block font-mono text-lg font-semibold">~{formatMoney(estimatedTotal)}</span>
              <span className="block text-xs text-muted-foreground">
                estimated{itemsMissingPrice > 0 ? ` (${itemsMissingPrice} item${itemsMissingPrice === 1 ? '' : 's'} without price history)` : ''}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {bucketItems.length === 0 && <p className="text-sm text-muted-foreground">No items in this bucket yet.</p>}
          {bucketItems.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {item.canonicalName}
                  {item.brand ? <span className="text-muted-foreground"> ({item.brand})</span> : null}
                </span>
                <span className="text-sm text-muted-foreground">{formatDueDate(item.dueDate)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Suggested: {formatBaseQty(item.suggestedQtyBase, item.baseUnit, item.defaultPackSize)}</span>
                {item.cadenceOverride !== null && <Badge tone="info">Overridden</Badge>}
                {item.planState !== 'pending' && (
                  <Badge tone="neutral">
                    {item.planState === 'snoozed'
                      ? `Snoozed${item.snoozedUntil ? ` until ${new Date(item.snoozedUntil).toLocaleDateString()}` : ''}`
                      : item.planState === 'skipped'
                        ? 'Skipped this cycle'
                        : 'Excluded'}
                  </Badge>
                )}
              </div>
              <PlanItemActions catalogItemId={item.id} planState={item.planState} hasCadenceOverride={item.cadenceOverride !== null} effectiveBucket={selectedBucket} />
            </div>
          ))}
        </CardContent>
      </Card>
      </div>
    </>
  );
}
