'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
      <main style={{ maxWidth: 480, margin: '10vh auto', padding: '0 1rem' }}>
        <Card>
          <CardHeader>
            <CardTitle>Purchase logged</CardTitle>
            <CardDescription>Inventory and predictions have been updated.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button onClick={reset}>Log another</Button>
            <Link href="/" className="text-sm underline">
              Back to Today
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '10vh auto', padding: '0 1rem' }}>
      <Card>
        <CardHeader>
          <CardTitle>Add manually</CardTitle>
          <CardDescription>Search for what you bought, or add a new item.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Search item name..." autoFocus />

          {!selected && !showNewItemForm && (
            <div className="flex flex-col gap-1">
              {results.map((r) => (
                <button
                  key={r.catalogItemId}
                  type="button"
                  onClick={() => selectResult(r)}
                  className="flex justify-between rounded border p-2 text-left hover:bg-accent"
                >
                  <span>{resultLabel(r)}</span>
                  <span className="text-sm text-muted-foreground">{r.lastPurchasedAt ? 'purchased before' : 'never purchased'}</span>
                </button>
              ))}
              {results.length === 0 && !isPending && <p className="text-sm text-muted-foreground">No matches.</p>}
              {query.trim() !== '' && (
                <button type="button" onClick={openNewItemForm} className="text-sm underline text-left">
                  Add &quot;{query.trim()}&quot; as a new item
                </button>
              )}
              {duplicateWarning && <p className="text-sm text-amber-600">{duplicateWarning}</p>}
            </div>
          )}

          {selected && (
            <div className="flex flex-col gap-2 rounded border p-2">
              <p className="font-medium">{resultLabel(selected)}</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} step="any" value={qtyBase} onChange={(e) => setQtyBase(e.target.value)} placeholder={`Qty (${selected.baseUnit})`} />
                <Input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Price (optional)" />
              </div>
              <Input type="date" value={dateString} onChange={(e) => setDateString(e.target.value)} max={todayString()} />
              <Button type="button" onClick={handleLogExisting} disabled={isPending}>
                Log purchase
              </Button>
              <button type="button" onClick={() => setSelected(null)} className="text-sm underline">
                Search again
              </button>
            </div>
          )}

          {showNewItemForm && (
            <div className="flex flex-col gap-2 rounded border p-2">
              <p className="font-medium">New item: {query.trim()}</p>
              <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Brand (optional)" />
              <select className="rounded border px-2 py-1" value={newCategorySlug} onChange={(e) => setNewCategorySlug(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input value={newQtyDisplay} onChange={(e) => setNewQtyDisplay(e.target.value)} placeholder="Qty" />
                <Input value={newUnitDisplay} onChange={(e) => setNewUnitDisplay(e.target.value)} placeholder="Unit (e.g. kg, piece)" />
              </div>
              <Input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Price (optional)" />
              <Input type="date" value={dateString} onChange={(e) => setDateString(e.target.value)} max={todayString()} />
              <Button type="button" onClick={handleCreateNew} disabled={isPending}>
                Create item &amp; log purchase
              </Button>
              <button type="button" onClick={() => setShowNewItemForm(false)} className="text-sm underline">
                Cancel
              </button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
