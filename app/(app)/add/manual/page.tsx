import { redirect } from 'next/navigation';
import { getHousehold } from '@/lib/onboarding/data';
import { getLeafCategories } from '@/lib/review/data';
import { MobileTopBar } from '@/components/ui/mobile-top-bar';
import { ManualEntryForm } from './manual-entry-form';

// See app/add/page.tsx for why force-dynamic is needed here too.
export const dynamic = 'force-dynamic';

export default async function ManualEntryPage() {
  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  // A manual new-item always has a human present at creation time (unlike
  // an LLM extraction miss) -- 'uncategorized' is excluded from the picker
  // entirely, backed by log_manual_purchase()'s own server-side guard.
  const categories = (await getLeafCategories()).filter((c) => c.slug !== 'uncategorized');

  return (
    <>
      <MobileTopBar title="Add manually" backHref="/add" />
      <ManualEntryForm categories={categories} />
    </>
  );
}
