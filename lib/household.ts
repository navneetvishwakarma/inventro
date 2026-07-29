import 'server-only';

export function getDefaultHouseholdId(): string {
  const id = process.env.DEFAULT_HOUSEHOLD_ID;
  if (!id) throw new Error('DEFAULT_HOUSEHOLD_ID must be set');
  return id;
}
