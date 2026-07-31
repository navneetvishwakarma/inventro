import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MobileTopBar } from '@/components/ui/mobile-top-bar';
import { getHousehold } from '@/lib/onboarding/data';
import { getInventoryItems, type InventoryItem } from '@/lib/inventory/data';
import { formatCadenceBucket } from '@/lib/inventory/format';
import { ItemCard, stockStateOf } from './item-card';

// Same force-dynamic rationale as app/page.tsx / app/review/page.tsx — must
// reflect the latest recompute and any consumption action on every load.
export const dynamic = 'force-dynamic';

// Matches F14's "due within 3 days" digest threshold — reused rather than
// inventing a second, unrelated urgency window.
const RUNNING_LOW_DAYS_THRESHOLD = 3;

type SearchParams = { q?: string; category?: string; cadence?: string; stock?: string; staples?: string };

function matchesSearch(item: InventoryItem, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (item.canonicalName.toLowerCase().includes(needle)) return true;
  if (item.brand && item.brand.toLowerCase().includes(needle)) return true;
  return item.aliases.some((a) => a.toLowerCase().includes(needle));
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  const params = await searchParams;
  const q = params.q ?? '';
  const category = params.category ?? '';
  const cadence = params.cadence ?? '';
  const stock = params.stock ?? 'all';
  const staplesOnly = params.staples === '1';

  const items = await getInventoryItems();

  const filtered = items.filter((item) => {
    if (!matchesSearch(item, q)) return false;
    if (category && item.categoryName !== category) return false;
    if (cadence && item.cadenceBucket !== cadence) return false;
    if (staplesOnly && !item.isStaple) return false;
    if (stock !== 'all' && stockStateOf(item, RUNNING_LOW_DAYS_THRESHOLD) !== stock) return false;
    return true;
  });

  const outOfStock = filtered.filter((i) => stockStateOf(i, RUNNING_LOW_DAYS_THRESHOLD) === 'out_of_stock');
  const runningLow = filtered.filter((i) => stockStateOf(i, RUNNING_LOW_DAYS_THRESHOLD) === 'running_low');
  const rest = filtered.filter((i) => {
    const state = stockStateOf(i, RUNNING_LOW_DAYS_THRESHOLD);
    return state !== 'out_of_stock' && state !== 'running_low';
  });

  const grouped = new Map<string, InventoryItem[]>();
  for (const item of rest) {
    const arr = grouped.get(item.categoryName) ?? [];
    arr.push(item);
    grouped.set(item.categoryName, arr);
  }
  const groupNames = [...grouped.keys()].sort();

  const allCategories = [...new Set(items.map((i) => i.categoryName))].sort();
  const allCadences = [...new Set(items.map((i) => i.cadenceBucket).filter((c): c is NonNullable<typeof c> => c !== null))];

  return (
    <>
      <MobileTopBar title="Inventory" />
      <div className="flex w-full flex-col gap-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>
            {items.length} item{items.length === 1 ? '' : 's'} tracked.{' '}
            <Link href="/catalog" className="text-link hover:text-link-hover">
              Seeing a duplicate? Manage the catalog.
            </Link>{' '}
            <Link href="/insights" className="text-link hover:text-link-hover">
              View budget &amp; insights.
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <Input name="q" defaultValue={q} placeholder="Name or alias" label="Search" size="sm" className="w-[200px]" />
            <div className="w-[150px]">
              <Select
                name="category"
                defaultValue={category}
                label="Category"
                placeholder="All categories"
                options={allCategories.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div className="w-[150px]">
              <Select
                name="cadence"
                defaultValue={cadence}
                label="Cadence"
                placeholder="All cadences"
                options={allCadences.map((c) => ({ value: c, label: formatCadenceBucket(c) }))}
              />
            </div>
            <div className="w-[150px]">
              <Select
                name="stock"
                defaultValue={stock}
                label="Stock state"
                options={[
                  { value: 'all', label: 'Any stock state' },
                  { value: 'out_of_stock', label: 'Out of stock' },
                  { value: 'running_low', label: 'Running low' },
                  { value: 'in_stock', label: 'In stock' },
                ]}
              />
            </div>
            <Checkbox name="staples" value="1" defaultChecked={staplesOnly} label="Staples only" />
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      {outOfStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Out of stock</CardTitle>
          </CardHeader>
          <CardContent>
            {outOfStock.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </CardContent>
        </Card>
      )}

      {runningLow.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Running low</CardTitle>
          </CardHeader>
          <CardContent>
            {runningLow.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </CardContent>
        </Card>
      )}

      {groupNames.length === 0 && outOfStock.length === 0 && runningLow.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState title="No items match these filters" action={<Link href="/inventory" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Clear filters</Link>} />
          </CardContent>
        </Card>
      )}

      {groupNames.map((name) => (
        <Card key={name}>
          <CardHeader>
            <CardTitle>{name}</CardTitle>
          </CardHeader>
          <CardContent>
            {(grouped.get(name) ?? []).map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </CardContent>
        </Card>
      ))}
      </div>
    </>
  );
}
