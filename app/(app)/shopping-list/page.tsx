import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MobileTopBar } from '@/components/ui/mobile-top-bar';
import { getHousehold } from '@/lib/onboarding/data';
import { getActiveShoppingList } from '@/lib/shopping-list/data';
import { formatShoppingListAsText } from '@/lib/shopping-list/format';
import { formatBaseQty } from '@/lib/inventory/format';
import { GenerateListPanel } from './generate-list-panel';
import { CopyListButton } from './copy-list-button';
import { ShoppingListItemRow } from './shopping-list-item-row';

// Same force-dynamic rationale as app/plan/page.tsx -- must reflect the
// latest generation/checkoff on every load.
export const dynamic = 'force-dynamic';

export default async function ShoppingListPage() {
  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  const list = await getActiveShoppingList();
  const listText = list ? formatShoppingListAsText(list) : '';
  const hasCheckedItems = list ? list.items.some((item) => item.checked) : false;

  return (
    <>
      <MobileTopBar title="Shopping list" />
      <div className="flex w-full flex-col gap-4 p-4 md:p-6">
      <GenerateListPanel hasCheckedItems={hasCheckedItems} />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>{list?.name ?? 'No active list'}</CardTitle>
            <CardDescription>
              {list ? `${list.items.length} item${list.items.length === 1 ? '' : 's'}.` : 'Generate a list above to get started.'}
            </CardDescription>
          </div>
          {list && list.items.length > 0 && <CopyListButton text={listText} />}
        </CardHeader>
        <CardContent>
          {list && list.items.length === 0 && (
            <EmptyState title="Nothing due in this selection" description="Good news — nothing needs restocking right now." />
          )}
          {list?.items.map((item) => (
            <ShoppingListItemRow
              key={item.id}
              id={item.id}
              checked={item.checked}
              purchaseLoggedAt={item.purchaseLoggedAt}
              loggedPrice={item.loggedPrice}
              label={
                item.qtyBase !== null
                  ? `${item.canonicalName}${item.brand ? ` (${item.brand})` : ''} -- ${formatBaseQty(item.qtyBase, item.baseUnit, item.defaultPackSize)}`
                  : `${item.canonicalName}${item.brand ? ` (${item.brand})` : ''}`
              }
            />
          ))}
        </CardContent>
      </Card>
      </div>
    </>
  );
}
