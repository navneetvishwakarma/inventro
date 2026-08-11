'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import { Radio } from '@/components/ui/radio';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import type { CatalogManagerItem } from '@/lib/catalog/manager';
import type { LeafCategory } from '@/lib/review/data';
import type { MergePreview } from '@/lib/catalog/manager';
import { getMergePreviewAction, mergeCatalogItemsAction, archiveItemAction, recategorizeItemAction } from './actions';

function itemLabel(item: CatalogManagerItem): string {
  return item.brand ? `${item.canonicalName} (${item.brand})` : item.canonicalName;
}

function ItemRow({
  item,
  categories,
  selected,
  onToggleSelect,
  disabled,
}: {
  item: CatalogManagerItem;
  categories: LeafCategory[];
  selected: boolean;
  onToggleSelect: (id: string) => void;
  disabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleArchiveToggle() {
    startTransition(async () => {
      const result = await archiveItemAction(item.id, !item.isArchived);
      setError(result.ok ? null : result.error);
    });
  }

  // The <Select> below is a stateless trigger, not a persisted "current
  // selection" -- it always renders at the placeholder value (see its
  // value="" below). item.categoryName (shown as a Badge above it) is the
  // only thing that claims to show the item's actual category; a select
  // that remembered its last-picked slug would keep showing a stale or even
  // failed choice across an unrelated revalidation (advisor-caught at the
  // epic gate: a failed recategorize would otherwise leave the dropdown
  // still displaying the rejected target as if it had taken effect).
  function handleRecategorize(slug: string) {
    startTransition(async () => {
      const result = await recategorizeItemAction(item.id, slug);
      setError(result.ok ? null : result.error);
    });
  }

  return (
    <div className={item.isArchived ? 'flex flex-col gap-2 rounded-md border border-border p-3 opacity-60' : 'flex flex-col gap-2 rounded-md border border-border p-3'}>
      <div className="flex items-center justify-between gap-2">
        {!item.isArchived ? (
          <Checkbox
            checked={selected}
            onChange={() => onToggleSelect(item.id)}
            disabled={disabled || isPending}
            label={itemLabel(item)}
          />
        ) : (
          <span className="text-sm">
            {itemLabel(item)}
            <span className="ml-1 text-xs text-muted-foreground">(archived)</span>
          </span>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={handleArchiveToggle} disabled={isPending}>
          {item.isArchived ? 'Unarchive' : 'Archive'}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{item.categoryName}</Badge>
        <Badge tone="neutral">
          {item.aliasCount} alias{item.aliasCount === 1 ? '' : 'es'}
        </Badge>
        {item.isStaple && <Badge tone="success">Staple</Badge>}
      </div>
      {!item.isArchived && (
        <div className="w-fit min-w-[220px]">
          <Select
            value=""
            placeholder="Recategorize…"
            aria-label="Recategorize item"
            onChange={(e) => handleRecategorize(e.target.value)}
            disabled={isPending}
            options={categories.map((c) => ({ value: c.slug, label: c.name }))}
          />
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

function MergePanel({ itemA, itemB, onDone, onCancel }: { itemA: CatalogManagerItem; itemB: CatalogManagerItem; onDone: (message: string) => void; onCancel: () => void }) {
  const [survivorId, setSurvivorId] = useState(itemA.id);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      const result = await getMergePreviewAction(itemA.id, itemB.id);
      if (result.ok) {
        setPreview(result.preview);
      } else {
        setError(result.error);
      }
    });
  }, [itemA.id, itemB.id]);

  const survivor = survivorId === itemA.id ? itemA : itemB;
  const loser = survivorId === itemA.id ? itemB : itemA;

  function handleConfirm() {
    startTransition(async () => {
      const result = await mergeCatalogItemsAction(survivor.id, loser.id);
      if (result.ok) {
        onDone(`Merged ${itemLabel(loser)} into ${itemLabel(survivor)}.`);
      } else {
        setError(result.error);
      }
    });
  }

  const totalAliases = preview ? preview.itemAAliasCount + preview.itemBAliasCount : null;
  const totalMovements = preview ? preview.itemAMovementCount + preview.itemBMovementCount : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Merge these two items?</CardTitle>
        <CardDescription>Pick which one survives — the other is archived and its history moves to the survivor.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Radio name="survivor" checked={survivorId === itemA.id} onChange={() => setSurvivorId(itemA.id)} label={`${itemLabel(itemA)} survives`} />
        <Radio name="survivor" checked={survivorId === itemB.id} onChange={() => setSurvivorId(itemB.id)} label={`${itemLabel(itemB)} survives`} />
        {preview && (
          <p className="text-sm text-muted-foreground">
            Combine {totalMovements} purchase{totalMovements === 1 ? '' : 's'} and {totalAliases} alias{totalAliases === 1 ? '' : 'es'} into one item.
          </p>
        )}
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button type="button" onClick={handleConfirm} disabled={isPending || !preview}>
            Confirm merge
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CatalogManager({ items, categories }: { items: CatalogManagerItem[]; categories: LeafCategory[] }) {
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => showArchived || !i.isArchived)
      .filter((i) => q === '' || i.canonicalName.toLowerCase().includes(q) || (i.brand ?? '').toLowerCase().includes(q));
  }, [items, query, showArchived]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // keep the selection to the two most recent picks
      return [...prev, id];
    });
  }

  // Filtered to !isArchived, not just found-by-id: an item can be archived
  // (via its own Archive button) while still sitting in selectedIds, since
  // its checkbox disappears once archived and there's no path to actively
  // deselect it. Without this filter, "Merge selected" would keep offering
  // a merge that the RPC always rejects (advisor-caught at the epic gate) --
  // filtering here makes the button disappear instead, and a later new
  // selection naturally evicts the stale id from selectedIds on its own.
  const selectedItems = selectedIds
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is CatalogManagerItem => i !== undefined && !i.isArchived);

  const mergeBarVisible = selectedItems.length === 2 && !merging;

  return (
    <div className={cn('mx-auto flex w-full max-w-[620px] flex-col gap-4 p-4 md:p-6', mergeBarVisible && 'pb-20 md:pb-6')}>
      <Card>
        <CardHeader>
          <CardTitle>Catalog manager</CardTitle>
          <CardDescription>Merge duplicates, fix categories, archive items you no longer buy.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search catalog" placeholder="Search catalog…" size="sm" className="w-full sm:w-[260px]" />
            <Checkbox checked={showArchived} onChange={(c) => setShowArchived(c)} label="Show archived" />
            {selectedItems.length === 2 && !merging && (
              <Button
                type="button"
                size="sm"
                className="hidden md:inline-flex"
                onClick={() => {
                  setMergeResult(null);
                  setMerging(true);
                }}
              >
                Merge selected
              </Button>
            )}
          </div>

          {selectedItems.length === 2 && !merging && (
            <div className="fixed inset-x-0 bottom-16 z-10 border-t border-border bg-surface p-3 md:hidden">
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={() => {
                  setMergeResult(null);
                  setMerging(true);
                }}
              >
                Merge selected
              </Button>
            </div>
          )}

          {merging && selectedItems.length === 2 && (
            <MergePanel
              itemA={selectedItems[0]}
              itemB={selectedItems[1]}
              onDone={(message) => {
                setMerging(false);
                setSelectedIds([]);
                setMergeResult(message);
              }}
              onCancel={() => setMerging(false)}
            />
          )}

          {/* S-93: additive, not a gate -- rendered alongside the row list
             the merge already removed via revalidation, not blocking it. */}
          {mergeResult && !merging && <Alert tone="success">{mergeResult}</Alert>}

          <div className="flex flex-col gap-2">
            {filtered.map((item) => (
              <ItemRow key={item.id} item={item} categories={categories} selected={selectedIds.includes(item.id)} onToggleSelect={toggleSelect} disabled={merging} />
            ))}
            {filtered.length === 0 && <p className="text-sm text-muted-foreground">No items match.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
