'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { updateHouseholdSettingsAction } from './actions';

export function SettingsForm({
  initialName,
  initialMonthlyBudget,
  initialNotifyEmail,
}: {
  initialName: string;
  initialMonthlyBudget: number | null;
  initialNotifyEmail: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [budget, setBudget] = useState(initialMonthlyBudget === null ? '' : String(initialMonthlyBudget));
  const [notifyEmail, setNotifyEmail] = useState(initialNotifyEmail ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    startTransition(async () => {
      const budgetValue = budget.trim() === '' ? null : Number(budget);
      const result = await updateHouseholdSettingsAction(name, budgetValue, notifyEmail.trim() === '' ? null : notifyEmail);
      if (result.ok) {
        setError(null);
        setSaved(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Input label="Household name" id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isPending} />

      <Input
        label="Monthly grocery budget (optional)"
        id="budget"
        type="number"
        inputMode="decimal"
        min="0"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        placeholder="e.g. 15000"
        disabled={isPending}
      />

      <Input
        label="Digest email (optional)"
        id="notify_email"
        type="email"
        value={notifyEmail}
        onChange={(e) => setNotifyEmail(e.target.value)}
        placeholder="you@example.com"
        disabled={isPending}
        helperText="Where the daily/weekly due-soon digest is sent, once email delivery is configured."
      />

      <Button onClick={save} disabled={isPending}>
        {isPending ? 'Saving…' : 'Save'}
      </Button>
      {saved && !error && <span className="text-sm text-success">Saved.</span>}

      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
