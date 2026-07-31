import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableRowMobile } from '@/components/ui/table';
import { getHousehold } from '@/lib/onboarding/data';
import { getInventoryItem, type ItemDetail } from '@/lib/inventory/data';

type MovementRecord = ItemDetail['movements'][number];
import { formatBaseQty, formatDaysRemaining, formatCadenceBucket, buildPredictionExplanation } from '@/lib/inventory/format';
import { Sparkline } from '../sparkline';
import { ConsumeActions } from './consume-actions';

export const dynamic = 'force-dynamic';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <span className="text-xs text-foreground-subtle">{label}</span>
      <span className="font-mono text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  const item = await getInventoryItem(id);
  if (!item) notFound();

  const explanation = buildPredictionExplanation({
    intervalEstDays: item.intervalEstDays,
    lastPurchasedAt: item.lastPurchasedAt,
    daysRemaining: item.daysRemaining,
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {item.canonicalName}
            {item.brand ? <span className="text-muted-foreground"> ({item.brand})</span> : null}
          </CardTitle>
          <CardDescription>{item.categoryName}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-foreground">{explanation}</p>
          <ConsumeActions catalogItemId={item.id} baseUnit={item.baseUnit} />
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
            <Stat label="Current stock" value={formatBaseQty(item.virtualStockBase, item.baseUnit, item.defaultPackSize)} />
            <Stat label="Predicted" value={formatDaysRemaining(item.daysRemaining)} />
            <Stat label="Cadence" value={formatCadenceBucket(item.cadenceBucket)} />
            <Stat label="Last purchased" value={item.lastPurchasedAt ? new Date(item.lastPurchasedAt).toLocaleDateString() : 'Never'} />
            <Stat label="Avg price (90d)" value={item.avgUnitPrice90d !== null ? `₹${item.avgUnitPrice90d.toFixed(2)}` : '—'} />
            <Stat label="Confidence" value={item.confidence !== null ? `${Math.round(item.confidence * 100)}%` : '—'} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price trend</CardTitle>
        </CardHeader>
        <CardContent>
          <Sparkline points={item.fullPriceSeries} width={280} height={60} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchase history</CardTitle>
        </CardHeader>
        <CardContent>
          {item.movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No movements recorded yet.</p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table<MovementRecord>
                  columns={[
                    { key: 'type', header: 'Type', render: (m) => <span className="capitalize">{m.type}</span> },
                    { key: 'qty', header: 'Qty', render: (m) => formatBaseQty(Math.abs(m.qtyBase), item.baseUnit, item.defaultPackSize) },
                    { key: 'occurredAt', header: 'Date', align: 'right', render: (m) => new Date(m.occurredAt).toLocaleDateString() },
                  ]}
                  rows={item.movements}
                />
              </div>
              <div className="md:hidden">
                {item.movements.map((m) => (
                  <TableRowMobile
                    key={m.id}
                    primary={<span className="capitalize">{m.type}</span>}
                    secondary={formatBaseQty(Math.abs(m.qtyBase), item.baseUnit, item.defaultPackSize)}
                    meta={new Date(m.occurredAt).toLocaleDateString()}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
