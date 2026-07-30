import { formatBaseQty } from '@/lib/inventory/format';
import type { ShoppingList } from './data';

// F12's plain-text export -- the exact string both the clipboard-copy
// button and any future share/download affordance consume. One source of
// truth for the exported representation.
export function formatShoppingListAsText(list: ShoppingList): string {
  const header = list.name ?? 'Shopping list';
  const lines = list.items.map((item) => {
    const box = item.checked ? '[x]' : '[ ]';
    const name = item.brand ? `${item.canonicalName} (${item.brand})` : item.canonicalName;
    const qty = item.qtyBase !== null ? formatBaseQty(item.qtyBase, item.baseUnit, item.defaultPackSize) : '';
    return qty ? `${box} ${name} -- ${qty}` : `${box} ${name}`;
  });
  return [header, ...lines].join('\n');
}
