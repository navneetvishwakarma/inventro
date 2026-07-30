import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getHousehold } from '@/lib/onboarding/data';
import { getInventoryItem } from '@/lib/inventory/data';
import { formatBaseQty, formatDaysRemaining, formatCadenceBucket, buildPredictionExplanation } from '@/lib/inventory/format';
import { Sparkline } from '../sparkline';
import { ConsumeActions } from './consume-actions';

export const dynamic = 'force-dynamic';

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
    <main style={{ maxWidth: 640, margin: '5vh auto', padding: '0 1rem' }} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {item.canonicalName}
            {item.brand ? <span className="text-muted-foreground"> ({item.brand})</span> : null}
          </CardTitle>
          <CardDescription>{item.categoryName}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p>{explanation}</p>
          <ConsumeActions catalogItemId={item.id} baseUnit={item.baseUnit} />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-muted-foreground">Current stock</div>
              <div>{formatBaseQty(item.virtualStockBase, item.baseUnit, item.defaultPackSize)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Predicted</div>
              <div>{formatDaysRemaining(item.daysRemaining)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Cadence</div>
              <div>{formatCadenceBucket(item.cadenceBucket)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Last purchased</div>
              <div>{item.lastPurchasedAt ? new Date(item.lastPurchasedAt).toLocaleDateString() : 'Never'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Avg price (90d)</div>
              <div>{item.avgUnitPrice90d !== null ? `₹${item.avgUnitPrice90d.toFixed(2)}` : '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Confidence</div>
              <div>{item.confidence !== null ? `${Math.round(item.confidence * 100)}%` : '—'}</div>
            </div>
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
        <CardContent className="flex flex-col gap-1 text-sm">
          {item.movements.length === 0 && <p className="text-muted-foreground">No movements recorded yet.</p>}
          {item.movements.map((m) => (
            <div key={m.id} className="flex justify-between border-b py-1 last:border-b-0">
              <span className="capitalize">{m.type}</span>
              <span>{formatBaseQty(Math.abs(m.qtyBase), item.baseUnit, item.defaultPackSize)}</span>
              <span className="text-muted-foreground">{new Date(m.occurredAt).toLocaleDateString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
