import type { InventoryItem } from '@/lib/inventory/data';
import { formatBaseQty, formatDaysRemaining, formatCadenceBucket } from '@/lib/inventory/format';
import { ListRow } from '@/components/ui/list-row';
import { Sparkline } from './sparkline';

export function stockStateOf(item: Pick<InventoryItem, 'virtualStockBase' | 'daysRemaining'>, runningLowDaysThreshold: number): 'out_of_stock' | 'running_low' | 'in_stock' {
  if (item.virtualStockBase <= 0) return 'out_of_stock';
  if (item.daysRemaining !== null && item.daysRemaining <= runningLowDaysThreshold) return 'running_low';
  return 'in_stock';
}

export function ItemCard({ item }: { item: InventoryItem }) {
  return (
    <ListRow
      href={`/inventory/${item.id}`}
      title={
        <>
          {item.canonicalName}
          {item.brand ? <span className="text-muted-foreground"> ({item.brand})</span> : null}
        </>
      }
      subtitle={`${formatBaseQty(item.virtualStockBase, item.baseUnit, item.defaultPackSize)} · ${formatDaysRemaining(item.daysRemaining)}`}
      meta={[
        formatCadenceBucket(item.cadenceBucket),
        item.lastPurchasedAt ? `last bought ${new Date(item.lastPurchasedAt).toLocaleDateString()}` : 'never purchased',
        item.avgUnitPrice90d !== null ? `avg ₹${item.avgUnitPrice90d.toFixed(2)}` : 'no recent price',
      ]}
      trailing={<Sparkline points={item.priceSeries} />}
    />
  );
}
