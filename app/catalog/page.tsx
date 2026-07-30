import { redirect } from 'next/navigation';
import { getHousehold } from '@/lib/onboarding/data';
import { getCatalogManagerItems } from '@/lib/catalog/manager';
import { getLeafCategories } from '@/lib/review/data';
import { CatalogManager } from './catalog-manager';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  const [items, categories] = await Promise.all([getCatalogManagerItems(), getLeafCategories()]);
  const recategorizeCategories = categories.filter((c) => c.slug !== 'uncategorized');

  return <CatalogManager items={items} categories={recategorizeCategories} />;
}
