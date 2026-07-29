'use server';

import { redirect } from 'next/navigation';
import { applyPresets, completeOnboarding } from '@/lib/onboarding/data';

export async function applyPresetsAction(presetIds: string[]): Promise<void> {
  await applyPresets(presetIds);
}

export async function completeOnboardingAction(name: string, monthlyBudget: number | null, tickedItemIds: string[]) {
  await completeOnboarding(name.trim() || 'Household', monthlyBudget, tickedItemIds);
  redirect('/');
}
