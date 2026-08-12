import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MobileTopBar } from '@/components/ui/mobile-top-bar';
import { buttonVariants } from '@/components/ui/button';
import { getHousehold } from '@/lib/onboarding/data';
import { getActiveShoppingList } from '@/lib/shopping-list/data';
import { getPlanItems } from '@/lib/plan/data';
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

  // S-97: getPlanItems() is already filtered to cadenceBucket !== null, so
  // an empty result means literally nothing in the household has a
  // computed prediction yet -- distinct from a generated list that's
  // empty because everything WITH predictions is already stocked. Only
  // fetched when it might matter (the list itself is empty) to avoid an
  // extra query on the common non-empty path.
  const hasAnyPredictionData = list && list.items.length === 0 ? (await getPlanItems()).length > 0 : true;

  return (
    <>
      <MobileTopBar title="Shopping list" backHref="/" />
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
          {list && list.items.length === 0 && hasAnyPredictionData && (
            <EmptyState title="Nothing due in this selection" description="Good news — nothing needs restocking right now." />
          )}
          {list && list.items.length === 0 && !hasAnyPredictionData && (
            <EmptyState
              title="No predictions yet"
              description="Add a receipt so Inventro can start predicting what you'll need to restock."
              action={
                <Link href="/add" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Add a receipt
                </Link>
              }
            />
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
