'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { SHOPPING_PRESETS } from '@/lib/onboarding/presets';
import { applyPresetsAction, completeOnboardingAction } from './actions';
import type { StapleItem } from '@/lib/onboarding/data';
import { StepDots } from './step-dots';

function itemLabel(item: StapleItem) {
  return item.brand ? `${item.canonical_name} (${item.brand})` : item.canonical_name;
}

export function OnboardingWizard({ initialName, initialStapleItems }: { initialName: string; initialStapleItems: StapleItem[] }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(initialName);
  const [budget, setBudget] = useState('');
  const [presetIds, setPresetIds] = useState<string[]>([]);
  // Fixed snapshot from before any preset is applied — presets can flip
  // is_staple on far more items than this (e.g. "weekly grocery run" alone
  // touches 100+), but the tick-off list must stay the short, ~40-item list
  // the working spec calls for, not everything a broad preset touches.
  const tickOffItems = initialStapleItems;
  const [tickedIds, setTickedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function togglePreset(id: string) {
    setError(null);
    setPresetIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function toggleTick(id: string) {
    setError(null);
    setTickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goToTickOff() {
    startTransition(async () => {
      const result = await applyPresetsAction(presetIds);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setStep(3);
    });
  }

  function finish(skipTickOff: boolean) {
    startTransition(async () => {
      const budgetValue = budget.trim() === '' ? null : Number(budget);
      const result = await completeOnboardingAction(name, budgetValue, skipTickOff ? [] : [...tickedIds]);
      // On success completeOnboardingAction redirects (throws internally) and
      // never returns here -- a defined result only happens on failure.
      if (result && !result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-sunken p-4">
      <div className="w-full max-w-[420px]">
        <Card>
          <div className="flex flex-col gap-4">
            <StepDots step={step} />
            {step === 1 && (
              <>
                <CardHeader>
                  <CardTitle>Welcome to Inventro</CardTitle>
                  <CardDescription>Let&apos;s set up your household. Takes about two minutes.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Input label="Household name" id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  <Input
                    label="Monthly grocery budget (optional)"
                    id="budget"
                    type="number"
                    inputMode="decimal"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. 15000"
                    helperText="You can change this later in Settings."
                  />
                </CardContent>
                <CardFooter>
                  <Button className="w-full" disabled={!name.trim()} onClick={() => setStep(2)}>
                    Continue
                  </Button>
                </CardFooter>
              </>
            )}

            {step === 2 && (
              <>
                <CardHeader>
                  <CardTitle>How do you shop?</CardTitle>
                  <CardDescription>Pick as many as apply — this just helps us guess right from day one.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {SHOPPING_PRESETS.map((preset) => (
                    <Checkbox key={preset.id} id={preset.id} checked={presetIds.includes(preset.id)} onChange={() => togglePreset(preset.id)} label={preset.label} />
                  ))}
                  {error && <Alert tone="error">{error}</Alert>}
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setError(null);
                      setStep(1);
                    }}
                    disabled={pending}
                  >
                    Back
                  </Button>
                  <Button className="flex-1" onClick={goToTickOff} disabled={pending}>
                    {pending ? 'Loading…' : 'Continue'}
                  </Button>
                </CardFooter>
              </>
            )}

            {step === 3 && (
              <>
                <CardHeader>
                  <CardTitle>Already have these at home?</CardTitle>
                  <CardDescription>Tap anything you already have — takes about a minute. Totally optional.</CardDescription>
                </CardHeader>
                <CardContent className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
                  {tickOffItems.map((item) => (
                    <Checkbox key={item.id} id={item.id} checked={tickedIds.has(item.id)} onChange={() => toggleTick(item.id)} label={itemLabel(item)} />
                  ))}
                </CardContent>
                {error && (
                  <div className="mt-3">
                    <Alert tone="error">{error}</Alert>
                  </div>
                )}
                <CardFooter className="flex gap-2">
                  <Button variant="outline" onClick={() => finish(true)} disabled={pending}>
                    Skip
                  </Button>
                  <Button className="flex-1" onClick={() => finish(false)} disabled={pending}>
                    {pending ? 'Finishing…' : `Finish (${tickedIds.size} selected)`}
                  </Button>
                </CardFooter>
              </>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
