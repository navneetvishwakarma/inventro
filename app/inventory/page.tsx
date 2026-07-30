import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <main style={{ maxWidth: 720, margin: '5vh auto', padding: '0 1rem' }} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>
            {items.length} item{items.length === 1 ? '' : 's'} tracked.{' '}
            <Link href="/catalog" className="underline">
              Seeing a duplicate? Manage the catalog.
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-center gap-2">
            <input type="text" name="q" defaultValue={q} placeholder="Search name or alias" className="rounded border px-2 py-1 text-sm" />
            <select name="category" defaultValue={category} className="rounded border px-2 py-1 text-sm">
              <option value="">All categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select name="cadence" defaultValue={cadence} className="rounded border px-2 py-1 text-sm">
              <option value="">All cadences</option>
              {allCadences.map((c) => (
                <option key={c} value={c}>
                  {formatCadenceBucket(c)}
                </option>
              ))}
            </select>
            <select name="stock" defaultValue={stock} className="rounded border px-2 py-1 text-sm">
              <option value="all">Any stock state</option>
              <option value="out_of_stock">Out of stock</option>
              <option value="running_low">Running low</option>
              <option value="in_stock">In stock</option>
            </select>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="staples" value="1" defaultChecked={staplesOnly} /> Staples only
            </label>
            <button type="submit" className="rounded border px-2 py-1 text-sm hover:bg-accent">
              Apply
            </button>
          </form>
        </CardContent>
      </Card>

      {outOfStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Out of stock</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
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
          <CardContent className="flex flex-col gap-2">
            {runningLow.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </CardContent>
        </Card>
      )}

      {groupNames.length === 0 && outOfStock.length === 0 && runningLow.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">No items match these filters.</CardContent>
        </Card>
      )}

      {groupNames.map((name) => (
        <Card key={name}>
          <CardHeader>
            <CardTitle>{name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(grouped.get(name) ?? []).map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
