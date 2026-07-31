import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getDefaultHouseholdId } from '@/lib/household';

// Simple RFC-5322-ish check, not a full validator library (none installed
// in this app) -- good enough to reject obvious garbage without pretending
// to be a real deliverability check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// currency/timezone are deliberately not settable here -- both are
// hardcoded app-wide (lib/date.ts's HOUSEHOLD_TIMEZONE comment: "fixed to
// Asia/Kolkata... not read from households.timezone"); a control that
// edited a value nothing else in the app reads would be a broken control.
export async function updateHouseholdSettings(name: string, monthlyBudget: number | null, notifyEmail: string | null): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Household name cannot be empty');

  if (monthlyBudget !== null && (Number.isNaN(monthlyBudget) || monthlyBudget < 0)) {
    throw new Error('Monthly budget must be a non-negative number');
  }

  // Empty input normalized to null on write -- never stores '' (a falsy-but-
  // not-null string a future strict-null check on the digest's send path
  // could otherwise slip past).
  const trimmedEmail = notifyEmail?.trim() || null;
  if (trimmedEmail !== null && !EMAIL_RE.test(trimmedEmail)) {
    throw new Error('Notification email is not a valid email address');
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('households')
    .update({ name: trimmedName, monthly_budget: monthlyBudget, notify_email: trimmedEmail })
    .eq('id', getDefaultHouseholdId());
  if (error) throw error;
}
