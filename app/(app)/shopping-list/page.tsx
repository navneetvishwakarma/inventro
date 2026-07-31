import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { getHousehold } from '@/lib/onboarding/data';
import { getActiveShoppingList } from '@/lib/shopping-list/data';
import { formatShoppingListAsText } from '@/lib/shopping-list/format';
import { formatBaseQty, formatCadenceBucket, CADENCE_BUCKET_ORDER } from '@/lib/inventory/format';
import { generateShoppingListAction, generateDueInDaysAction } from './actions';
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Generate a shopping list</CardTitle>
          <CardDescription>From a cadence bucket, or everything due soon.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {CADENCE_BUCKET_ORDER.map((bucket) => (
              <form key={bucket} action={generateShoppingListAction.bind(null, { type: 'bucket', bucket })}>
                <Button type="submit" size="sm" variant="outline">
                  {formatCadenceBucket(bucket)}
                </Button>
              </form>
            ))}
          </div>
          <form action={generateDueInDaysAction} className="flex items-end gap-2">
            <Input id="days" name="days" type="number" min={1} defaultValue={3} label="Due within (days)" size="sm" className="w-[90px]" />
            <Button type="submit" size="sm">
              Generate
            </Button>
          </form>
        </CardContent>
      </Card>

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
  );
}
