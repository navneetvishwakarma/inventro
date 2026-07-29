import { redirect } from 'next/navigation';
import { getHousehold, getStapleItems } from '@/lib/onboarding/data';
import { OnboardingWizard } from './wizard';

// See app/page.tsx for why this must be forced dynamic.
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const household = await getHousehold();
  if (household.onboarded_at) redirect('/');

  const prefillName = household.name === 'Household' ? '' : household.name;
  const stapleItems = await getStapleItems();

  return <OnboardingWizard initialName={prefillName} initialStapleItems={stapleItems} />;
}
