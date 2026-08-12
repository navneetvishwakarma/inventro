'use server';

import { redirect } from 'next/navigation';
import { applyPresets, completeOnboarding } from '@/lib/onboarding/data';

export type OnboardingResult = { ok: true } | { ok: false; error: string };

// Generic message, matching login/signup's anti-leak style (S-58) -- the
// real reason is server-logged, never returned to the client.
const GENERIC_ONBOARDING_ERROR = 'Something went wrong saving your setup. Your progress is still here -- try again.';

export async function applyPresetsAction(presetIds: string[]): Promise<OnboardingResult> {
  try {
    await applyPresets(presetIds);
    return { ok: true };
  } catch (error) {
    console.error('onboarding: applyPresets failed', error);
    return { ok: false, error: GENERIC_ONBOARDING_ERROR };
  }
}

export async function completeOnboardingAction(name: string, monthlyBudget: number | null, tickedItemIds: string[]): Promise<OnboardingResult | void> {
  try {
    await completeOnboarding(name.trim() || 'Household', monthlyBudget, tickedItemIds);
  } catch (error) {
    console.error('onboarding: completeOnboarding failed', error);
    return { ok: false, error: GENERIC_ONBOARDING_ERROR };
  }
  redirect('/');
}
