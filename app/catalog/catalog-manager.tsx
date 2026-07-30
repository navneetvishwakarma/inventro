'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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

  // The <select> below is a stateless trigger, not a persisted "current
  // selection" -- it always renders at the placeholder value (see its
  // value="" below). item.categoryName (rendered above it) is the only
  // thing that claims to show the item's actual category; a select that
  // remembered its last-picked slug would keep showing a stale or even
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
    <div className={`flex flex-col gap-1 rounded border p-2 ${item.isArchived ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2">
          {!item.isArchived && <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(item.id)} disabled={disabled || isPending} />}
          <span>
            {itemLabel(item)}
            {item.isArchived && <span className="ml-1 text-xs text-muted-foreground">(archived)</span>}
          </span>
        </label>
        <Button type="button" size="xs" variant="outline" onClick={handleArchiveToggle} disabled={isPending}>
          {item.isArchived ? 'Unarchive' : 'Archive'}
        </Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{item.categoryName}</span>
        <span>{item.aliasCount} alias{item.aliasCount === 1 ? '' : 'es'}</span>
        {item.isStaple && <span>staple</span>}
      </div>
      {!item.isArchived && (
        <select className="w-fit rounded border px-2 py-1 text-xs" value="" onChange={(e) => handleRecategorize(e.target.value)} disabled={isPending}>
          <option value="" disabled>
            Recategorize...
          </option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

function MergePanel({ itemA, itemB, onDone, onCancel }: { itemA: CatalogManagerItem; itemB: CatalogManagerItem; onDone: () => void; onCancel: () => void }) {
  const [survivorId, setSurvivorId] = useState(itemA.id);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const p = await getMergePreviewAction(itemA.id, itemB.id);
      setPreview(p);
    });
  }, [itemA.id, itemB.id]);

  const survivor = survivorId === itemA.id ? itemA : itemB;
  const loser = survivorId === itemA.id ? itemB : itemA;

  function handleConfirm() {
    startTransition(async () => {
      const result = await mergeCatalogItemsAction(survivor.id, loser.id);
      if (result.ok) {
        onDone();
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
        <CardDescription>Pick which one survives -- the other is archived and its history moves to the survivor.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <label className="flex items-center gap-2">
          <input type="radio" checked={survivorId === itemA.id} onChange={() => setSurvivorId(itemA.id)} />
          {itemLabel(itemA)} survives
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={survivorId === itemB.id} onChange={() => setSurvivorId(itemB.id)} />
          {itemLabel(itemB)} survives
        </label>
        {preview && (
          <p className="text-sm text-muted-foreground">
            Combine {totalMovements} purchase{totalMovements === 1 ? '' : 's'} and {totalAliases} alias{totalAliases === 1 ? '' : 'es'} into one item.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
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

  return (
    <main style={{ maxWidth: 640, margin: '8vh auto', padding: '0 1rem' }} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Catalog manager</CardTitle>
          <CardDescription>Merge duplicates, fix categories, archive items you no longer buy.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search catalog..." />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showArchived} onCheckedChange={(c) => setShowArchived(c === true)} />
            Show archived
          </label>

          {selectedItems.length === 2 && !merging && (
            <Button type="button" onClick={() => setMerging(true)}>
              Merge selected
            </Button>
          )}

          {merging && selectedItems.length === 2 && (
            <MergePanel
              itemA={selectedItems[0]}
              itemB={selectedItems[1]}
              onDone={() => {
                setMerging(false);
                setSelectedIds([]);
              }}
              onCancel={() => setMerging(false)}
            />
          )}

          <div className="flex flex-col gap-2">
            {filtered.map((item) => (
              <ItemRow key={item.id} item={item} categories={categories} selected={selectedIds.includes(item.id)} onToggleSelect={toggleSelect} disabled={merging} />
            ))}
            {filtered.length === 0 && <p className="text-sm text-muted-foreground">No items match.</p>}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
