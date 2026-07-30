import Link from 'next/link';
import type { InventoryItem } from '@/lib/inventory/data';
import { formatBaseQty, formatDaysRemaining, formatCadenceBucket } from '@/lib/inventory/format';
import { Sparkline } from './sparkline';

export function stockStateOf(item: Pick<InventoryItem, 'virtualStockBase' | 'daysRemaining'>, runningLowDaysThreshold: number): 'out_of_stock' | 'running_low' | 'in_stock' {
  if (item.virtualStockBase <= 0) return 'out_of_stock';
  if (item.daysRemaining !== null && item.daysRemaining <= runningLowDaysThreshold) return 'running_low';
  return 'in_stock';
}

export function ItemCard({ item }: { item: InventoryItem }) {
  return (
    <Link href={`/inventory/${item.id}`} className="flex flex-col gap-1 rounded border p-3 hover:bg-accent">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {item.canonicalName}
          {item.brand ? <span className="text-muted-foreground"> ({item.brand})</span> : null}
        </span>
        <Sparkline points={item.priceSeries} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{formatBaseQty(item.virtualStockBase, item.baseUnit, item.defaultPackSize)}</span>
        <span>{formatDaysRemaining(item.daysRemaining)}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{formatCadenceBucket(item.cadenceBucket)}</span>
        <span>{item.lastPurchasedAt ? `last bought ${new Date(item.lastPurchasedAt).toLocaleDateString()}` : 'never purchased'}</span>
        <span>{item.avgUnitPrice90d !== null ? `avg ₹${item.avgUnitPrice90d.toFixed(2)}` : 'no recent price'}</span>
      </div>
    </Link>
  );
}
