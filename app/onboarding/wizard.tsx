'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SHOPPING_PRESETS } from '@/lib/onboarding/presets';
import { applyPresetsAction, completeOnboardingAction } from './actions';
import type { StapleItem } from '@/lib/onboarding/data';

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

  function togglePreset(id: string) {
    setPresetIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function toggleTick(id: string) {
    setTickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goToTickOff() {
    startTransition(async () => {
      await applyPresetsAction(presetIds);
      setStep(3);
    });
  }

  function finish(skipTickOff: boolean) {
    startTransition(async () => {
      const budgetValue = budget.trim() === '' ? null : Number(budget);
      await completeOnboardingAction(name, budgetValue, skipTickOff ? [] : [...tickedIds]);
    });
  }

  return (
    <main style={{ maxWidth: 480, margin: '10vh auto', padding: '0 1rem' }}>
      <Card>
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Welcome to Inventro</CardTitle>
              <CardDescription>Let&apos;s set up your household. Takes about two minutes.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Household name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="budget">Monthly grocery budget (optional)</Label>
                <Input id="budget" type="number" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 15000" />
              </div>
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
                <div key={preset.id} className="flex items-center gap-2">
                  <Checkbox id={preset.id} checked={presetIds.includes(preset.id)} onCheckedChange={() => togglePreset(preset.id)} />
                  <Label htmlFor={preset.id}>{preset.label}</Label>
                </div>
              ))}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={pending}>
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
            <CardContent className="flex flex-col gap-2" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
              {tickOffItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox id={item.id} checked={tickedIds.has(item.id)} onCheckedChange={() => toggleTick(item.id)} />
                  <Label htmlFor={item.id}>{itemLabel(item)}</Label>
                </div>
              ))}
            </CardContent>
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
      </Card>
    </main>
  );
}
