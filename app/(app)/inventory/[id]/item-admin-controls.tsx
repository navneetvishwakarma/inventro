'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { ConfirmPanel } from '@/components/ui/confirm-panel';
import { CADENCE_BUCKET_ORDER, formatCadenceBucket } from '@/lib/inventory/format';
import type { CadenceBucket } from '@/lib/predictions/types';
import { archiveItemAction, setStapleAction, setPerishabilityDaysAction, setCadenceOverrideAction } from './actions';

// S-72/F8: archive, staple, perishability, and cadence override were
// previously only reachable via the separate Catalog/Plan pages. The
// cadence-override control mirrors app/(app)/plan/plan-item-actions.tsx's
// "Move to.../Revert to auto" pattern exactly, reusing the same
// lib/plan/actions.ts write path -- not a second implementation.
export function ItemAdminControls({
  catalogItemId,
  isStaple,
  perishabilityDays,
  cadenceBucket,
  cadenceOverride,
}: {
  catalogItemId: string;
  isStaple: boolean;
  perishabilityDays: number | null;
  cadenceBucket: CadenceBucket | null;
  cadenceOverride: CadenceBucket | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [perishability, setPerishability] = useState(perishabilityDays !== null ? String(perishabilityDays) : '');
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  function toggleStaple(checked: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setStapleAction(catalogItemId, checked);
      if (!result.ok) setError(result.error);
    });
  }

  function savePerishability() {
    setError(null);
    const trimmed = perishability.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
      setError('Perishability must be a positive number of days, or blank.');
      return;
    }
    startTransition(async () => {
      const result = await setPerishabilityDaysAction(catalogItemId, parsed);
      if (!result.ok) setError(result.error);
    });
  }

  function moveCadence(bucket: CadenceBucket) {
    setError(null);
    startTransition(async () => {
      const result = await setCadenceOverrideAction(catalogItemId, bucket);
      if (!result.ok) setError(result.error);
    });
  }

  function revertCadence() {
    setError(null);
    startTransition(async () => {
      const result = await setCadenceOverrideAction(catalogItemId, null);
      if (!result.ok) setError(result.error);
    });
  }

  function confirmArchive() {
    setError(null);
    startTransition(async () => {
      const result = await archiveItemAction(catalogItemId, true);
      if (result.ok) {
        // Archived items are filtered out of getInventoryItem() (matching
        // Catalog's own is_archived=false scoping for this view) -- this
        // page would 404 on the next render, so navigate away instead of
        // leaving the user on a page about to disappear.
        router.push('/inventory');
      } else {
        setError(result.error);
      }
    });
  }

  if (confirmingArchive) {
    return (
      <ConfirmPanel
        title="Archive this item?"
        description="Removes it from your active inventory. Unarchive it later from the Catalog page."
        confirmLabel="Archive"
        pending={isPending}
        error={error}
        onConfirm={confirmArchive}
        onCancel={() => {
          setConfirmingArchive(false);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <Checkbox checked={isStaple} onChange={toggleStaple} disabled={isPending} label="Staple item (always in your typical basket)" />
      <div className="flex items-end gap-2">
        <Input
          type="number"
          min="1"
          step="1"
          value={perishability}
          onChange={(e) => setPerishability(e.target.value)}
          label="Perishability (days, optional)"
          placeholder="No limit"
          size="sm"
          className="w-40"
          disabled={isPending}
        />
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={savePerishability}>
          Save
        </Button>
      </div>
      {cadenceBucket !== null && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-[150px]">
            <Select
              disabled={isPending}
              value=""
              label="Cadence"
              placeholder="Move to…"
              onChange={(e) => {
                const bucket = e.target.value as CadenceBucket;
                if (bucket) moveCadence(bucket);
              }}
              options={CADENCE_BUCKET_ORDER.filter((b) => b !== cadenceBucket).map((b) => ({ value: b, label: formatCadenceBucket(b) }))}
            />
          </div>
          {cadenceOverride !== null && (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={revertCadence}>
              Revert to auto
            </Button>
          )}
        </div>
      )}
      <Button type="button" size="sm" variant="destructive" disabled={isPending} onClick={() => setConfirmingArchive(true)} className="self-start">
        Archive item
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
