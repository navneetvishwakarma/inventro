'use server';

import { revalidatePath } from 'next/cache';
import { updateHouseholdSettings } from '@/lib/settings/data';
import { wipeDemoHouseholdData } from '@/lib/settings/demo-data';
import { getExportJson, getExportCsv } from '@/lib/settings/export';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateHouseholdSettingsAction(name: string, monthlyBudget: number | null, notifyEmail: string | null): Promise<ActionResult> {
  try {
    await updateHouseholdSettings(name, monthlyBudget, notifyEmail);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath('/settings');
  revalidatePath('/');
  return { ok: true };
}

export async function wipeDemoDataAction(): Promise<ActionResult> {
  try {
    const result = await wipeDemoHouseholdData();
    if (!result.wiped) return { ok: false, error: result.reason };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return { ok: true };
}

export async function exportJsonAction(): Promise<string> {
  return getExportJson();
}

export async function exportCsvAction(): Promise<string> {
  return getExportCsv();
}
