import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    <main style={{ maxWidth: 720, margin: '5vh auto', padding: '0 1rem' }} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Generate a shopping list</CardTitle>
          <CardDescription>From a cadence bucket, or everything due soon.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            {CADENCE_BUCKET_ORDER.map((bucket) => (
              <form key={bucket} action={generateShoppingListAction.bind(null, { type: 'bucket', bucket })}>
                <Button type="submit" size="sm" variant="outline">
                  {formatCadenceBucket(bucket)}
                </Button>
              </form>
            ))}
          </div>
          <form action={generateDueInDaysAction} className="flex items-center gap-2">
            <label htmlFor="days" className="text-sm text-muted-foreground">
              Due within
            </label>
            <input id="days" name="days" type="number" min={1} defaultValue={3} className="w-16 rounded border px-2 py-1 text-sm" />
            <span className="text-sm text-muted-foreground">days</span>
            <Button type="submit" size="sm">
              Generate
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{list?.name ?? 'No active list'}</CardTitle>
          <CardDescription>
            {list ? `${list.items.length} item${list.items.length === 1 ? '' : 's'}.` : 'Generate a list above to get started.'}
          </CardDescription>
          {list && list.items.length > 0 && (
            <div className="pt-1">
              <CopyListButton text={listText} />
            </div>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {list && list.items.length === 0 && <p className="text-muted-foreground">Nothing due in this selection right now.</p>}
          {list?.items.map((item) => (
            <ShoppingListItemRow
              key={item.id}
              id={item.id}
              checked={item.checked}
              label={
                item.qtyBase !== null
                  ? `${item.canonicalName}${item.brand ? ` (${item.brand})` : ''} -- ${formatBaseQty(item.qtyBase, item.baseUnit, item.defaultPackSize)}`
                  : `${item.canonicalName}${item.brand ? ` (${item.brand})` : ''}`
              }
            />
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
