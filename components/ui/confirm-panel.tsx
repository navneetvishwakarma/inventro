'use client';

import { Button, type buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';

type ButtonVariant = NonNullable<Parameters<typeof buttonVariants>[0]>['variant'];

// S-69: the shared inline-confirm pattern for every ledger-writing/
// destructive action outside the Catalog merge flow (whose own MergePanel
// is welded to a two-item survivor/loser shape and a preview fetch --
// not reusable here, not contorted into being). This is the minimal
// common shape the other call sites (consume actions, shopping-list
// regeneration, Settings wipe) actually need: title, description, a
// confirm/cancel pair, pending + error state. Replaces window.confirm on
// Settings wipe, which was itself inconsistent with the rest of the app's
// visual language independent of any content difference.
export function ConfirmPanel({
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'destructive',
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  pending: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={pending}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
