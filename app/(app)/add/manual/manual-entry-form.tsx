'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ListRow } from '@/components/ui/list-row';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { LeafCategory } from '@/lib/review/data';
import type { CatalogSearchResult } from '@/lib/catalog/search';
import { toKolkataDateString } from '@/lib/date';
import { searchCatalogAction, logExistingItemPurchaseAction, checkForDuplicateAction, createNewItemPurchaseAction } from './actions';

const DEBOUNCE_MS = 250;

function todayString(): string {
  return toKolkataDateString(new Date().toISOString());
}

function resultLabel(r: CatalogSearchResult): string {
  return r.brand ? `${r.canonicalName} (${r.brand})` : r.canonicalName;
}

export function ManualEntryForm({ categories }: { categories: LeafCategory[] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [selected, setSelected] = useState<CatalogSearchResult | null>(null);
  const [qtyBase, setQtyBase] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [dateString, setDateString] = useState(todayString());
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [newBrand, setNewBrand] = useState('');
  const [newCategorySlug, setNewCategorySlug] = useState(categories[0]?.slug ?? '');
  const [newQtyDisplay, setNewQtyDisplay] = useState('1');
  const [newUnitDisplay, setNewUnitDisplay] = useState('piece');
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recency-ranked initial load (empty query) on mount, matching REQ-07's
  // "default typeahead state before the user types anything."
  useEffect(() => {
    startTransition(async () => {
      const r = await searchCatalogAction('');
      setResults(r);
    });
  }, []);

  function onQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    setShowNewItemForm(false);
    setDuplicateWarning(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await searchCatalogAction(value);
        setResults(r);
      });
    }, DEBOUNCE_MS);
  }

  function selectResult(r: CatalogSearchResult) {
    setSelected(r);
    setQtyBase(String(r.lastQtyBase));
    setUnitPrice('');
    setStatus('idle');
    setError(null);
  }

  function handleLogExisting() {
    if (!selected) return;
    const qty = Number(qtyBase);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter a valid quantity');
      return;
    }
    const price = unitPrice.trim() === '' ? null : Number(unitPrice);
    startTransition(async () => {
      const result = await logExistingItemPurchaseAction(selected.catalogItemId, qty, price, dateString);
      if (result.ok) {
        setStatus('success');
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }

  function openNewItemForm() {
    setDuplicateWarning(null);
    startTransition(async () => {
      const dup = await checkForDuplicateAction(query, newBrand.trim() || null);
      if (dup.likelyDuplicate) {
        setDuplicateWarning(`This looks like an existing item: ${dup.existingName}. Search for it above and select it instead.`);
        setShowNewItemForm(false);
      } else {
        setShowNewItemForm(true);
      }
    });
  }

  function handleCreateNew() {
    if (!query.trim() || !newCategorySlug) {
      setError('Enter a name and pick a category');
      return;
    }
    const price = unitPrice.trim() === '' ? null : Number(unitPrice);
    startTransition(async () => {
      const result = await createNewItemPurchaseAction({
        name: query.trim(),
        brand: newBrand.trim() || null,
        categorySlug: newCategorySlug,
        qtyDisplay: newQtyDisplay,
        unitDisplay: newUnitDisplay,
        unitPrice: price,
        dateString,
      });
      if (result.ok) {
        setStatus('success');
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }

  function reset() {
    setQuery('');
    setResults([]);
    setSelected(null);
    setQtyBase('');
    setUnitPrice('');
    setDateString(todayString());
    setShowNewItemForm(false);
    setDuplicateWarning(null);
    setNewBrand('');
    setNewQtyDisplay('1');
    setNewUnitDisplay('piece');
    setStatus('idle');
    setError(null);
    startTransition(async () => {
      const r = await searchCatalogAction('');
      setResults(r);
    });
  }

  if (status === 'success') {
    return (
      <div className="mx-auto w-full max-w-[440px] p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Purchase logged</CardTitle>
            <CardDescription>Inventory and predictions have been updated.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={reset}>Log another</Button>
            <Link href="/" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'self-start')}>
              Back to Today
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[440px] p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Add manually</CardTitle>
          <CardDescription>Search for what you bought, or add a new item.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input
            label="Search item name"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Toor dal"
            autoFocus
          />

          {!selected && !showNewItemForm && (
            <div className="flex flex-col gap-2">
              {results.map((r) => (
                <ListRow
                  key={r.catalogItemId}
                  title={resultLabel(r)}
                  subtitle={r.lastPurchasedAt ? 'purchased before' : 'never purchased'}
                  onClick={() => selectResult(r)}
                />
              ))}
              {results.length === 0 && !isPending && <p className="text-sm text-muted-foreground">No matches.</p>}
              {query.trim() !== '' && (
                <button
                  type="button"
                  onClick={openNewItemForm}
                  className={cn(buttonVariants({ variant: 'tertiary', size: 'sm' }), 'self-start')}
                >
                  Add &quot;{query.trim()}&quot; as a new item
                </button>
              )}
              {duplicateWarning && <Alert tone="warning">{duplicateWarning}</Alert>}
            </div>
          )}

          {selected && (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <strong className="text-[0.875rem]">{resultLabel(selected)}</strong>
              <div className="flex items-center gap-2">
                <Input
                  size="sm"
                  type="number"
                  min={0}
                  step="any"
                  value={qtyBase}
                  onChange={(e) => setQtyBase(e.target.value)}
                  placeholder={`Qty (${selected.baseUnit})`}
                  label={`Qty (${selected.baseUnit})`}
                />
                <Input
                  size="sm"
                  type="number"
                  min={0}
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="Total paid (optional)"
                  label="Total paid (optional)"
                />
              </div>
              <Input size="sm" label="Date" type="date" value={dateString} onChange={(e) => setDateString(e.target.value)} max={todayString()} />
              <Button type="button" onClick={handleLogExisting} disabled={isPending}>
                Log purchase
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)} className="self-start">
                Search again
              </Button>
            </div>
          )}

          {showNewItemForm && (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <strong className="text-[0.875rem]">New item: {query.trim()}</strong>
              <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Brand (optional)" label="Brand (optional)" />
              <Select
                value={newCategorySlug}
                onChange={(e) => setNewCategorySlug(e.target.value)}
                options={categories.map((c) => ({ value: c.slug, label: c.name }))}
                label="Category"
                placeholder="Category"
              />
              <div className="flex gap-2">
                <Input value={newQtyDisplay} onChange={(e) => setNewQtyDisplay(e.target.value)} placeholder="Qty" label="Qty" />
                <Input value={newUnitDisplay} onChange={(e) => setNewUnitDisplay(e.target.value)} placeholder="Unit (e.g. kg, piece)" label="Unit" />
              </div>
              <Input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Total paid (optional)" label="Total paid (optional)" />
              <Input type="date" value={dateString} onChange={(e) => setDateString(e.target.value)} max={todayString()} label="Date" />
              <Button type="button" onClick={handleCreateNew} disabled={isPending}>
                Create item &amp; log purchase
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewItemForm(false)} className="self-start">
                Cancel
              </Button>
            </div>
          )}

          {error && <Alert tone="error">{error}</Alert>}
        </CardContent>
      </Card>
    </div>
  );
}
