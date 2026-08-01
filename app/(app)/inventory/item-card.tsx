import type { InventoryItem } from '@/lib/inventory/data';
import { formatBaseQty, formatDaysRemaining, formatCadenceBucket } from '@/lib/inventory/format';
import { formatMoney } from '@/lib/format/money';
import { ListRow } from '@/components/ui/list-row';
import { Badge } from '@/components/ui/badge';
import { Sparkline } from './sparkline';

export function stockStateOf(item: Pick<InventoryItem, 'virtualStockBase' | 'daysRemaining'>, runningLowDaysThreshold: number): 'out_of_stock' | 'running_low' | 'in_stock' {
  if (item.virtualStockBase <= 0) return 'out_of_stock';
  if (item.daysRemaining !== null && item.daysRemaining <= runningLowDaysThreshold) return 'running_low';
  return 'in_stock';
}

// design/screens/08-inventory-list.html's OutOfStockCard: no subtitle, a
// two-item meta (qty, cadence), and a status Badge trailing -- distinct
// from RunningLowCard/DairyCard's subtitle + Sparkline treatment, which
// only makes sense once there's a depletion trend to show.
export function ItemCard({ item, outOfStock = false }: { item: InventoryItem; outOfStock?: boolean }) {
  if (outOfStock) {
    return (
      <ListRow
        href={`/inventory/${item.id}`}
        title={
          <>
            {item.canonicalName}
            {item.brand ? <span className="text-muted-foreground"> ({item.brand})</span> : null}
          </>
        }
        meta={[formatBaseQty(item.virtualStockBase, item.baseUnit, item.defaultPackSize), formatCadenceBucket(item.cadenceBucket)]}
        trailing={<Badge tone="error">Out of stock</Badge>}
      />
    );
  }

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
      meta={[formatCadenceBucket(item.cadenceBucket), item.avgUnitPrice90d !== null ? `avg ${formatMoney(item.avgUnitPrice90d)}` : 'no recent price']}
      trailing={<Sparkline points={item.priceSeries} />}
    />
  );
}
