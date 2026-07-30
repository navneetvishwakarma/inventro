import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getHousehold } from '@/lib/onboarding/data';
import { getPlanItems, type PlanItem } from '@/lib/plan/data';
import { formatBaseQty, formatDueDate, formatCadenceBucket, CADENCE_BUCKET_ORDER } from '@/lib/inventory/format';
import type { CadenceBucket } from '@/lib/predictions/types';
import { PlanItemActions } from './plan-item-actions';

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

  return (
    <main style={{ maxWidth: 720, margin: '5vh auto', padding: '0 1rem' }} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>{items.length} item{items.length === 1 ? '' : 's'} being planned.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {CADENCE_BUCKET_ORDER.map((bucket) => {
              const count = countsByBucket.get(bucket) ?? 0;
              const active = bucket === selectedBucket;
              return (
                <a
                  key={bucket}
                  href={`/plan?bucket=${bucket}`}
                  className={`rounded border px-2 py-1 text-sm ${active ? 'bg-accent font-medium' : 'hover:bg-accent'}`}
                >
                  {formatCadenceBucket(bucket)} ({count})
                </a>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{formatCadenceBucket(selectedBucket)}</CardTitle>
          <CardDescription>{bucketItems.length} item{bucketItems.length === 1 ? '' : 's'} in this bucket.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {bucketItems.length === 0 && <p className="text-muted-foreground">No items in this bucket yet.</p>}
          {bucketItems.map((item) => (
            <div key={item.id} className="flex flex-col gap-1 rounded border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {item.canonicalName}
                  {item.brand ? <span className="text-muted-foreground"> ({item.brand})</span> : null}
                </span>
                <span className="text-sm text-muted-foreground">{formatDueDate(item.dueDate)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>Suggested: {formatBaseQty(item.suggestedQtyBase, item.baseUnit, item.defaultPackSize)}</span>
                {item.cadenceOverride !== null && <span className="rounded bg-muted px-1.5 py-0.5 text-xs">Overridden</span>}
                {item.planState !== 'pending' && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {item.planState === 'snoozed' ? `Snoozed${item.snoozedUntil ? ` until ${new Date(item.snoozedUntil).toLocaleDateString()}` : ''}` : item.planState === 'skipped' ? 'Skipped this cycle' : 'Excluded'}
                  </span>
                )}
              </div>
              <PlanItemActions catalogItemId={item.id} planState={item.planState} hasCadenceOverride={item.cadenceOverride !== null} effectiveBucket={selectedBucket} />
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
