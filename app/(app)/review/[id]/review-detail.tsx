'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ListRow } from '@/components/ui/list-row';
import { cn } from '@/lib/utils';
import type { ReceiptForReview, ReceiptLineForReview, LeafCategory } from '@/lib/review/data';
import { toKolkataDateString } from '@/lib/date';
import { formatBaseQty } from '@/lib/inventory/format';
import { formatMoney } from '@/lib/format/money';
import type { BaseUnit } from '@/lib/receipts/canonicalize';
import { confirmPurchaseDateAction, saveAndMatchLineAction, confirmAsNewItemAction, markLineNonInventoryAction, commitReceiptAction } from './actions';

function todayString(): string {
  return toKolkataDateString(new Date().toISOString());
}

// Kolkata calendar day, not a raw UTC slice -- a purchased_at stored near
// local midnight would otherwise render (and, if re-confirmed, persist) the
// wrong day (see lib/date.ts).
function toDateInputValue(iso: string | null): string {
  return iso ? toKolkataDateString(iso) : todayString();
}

function lineLabel(line: ReceiptLineForReview): string {
  const name = line.catalog_items?.canonical_name ?? line.item_name ?? line.raw_text;
  return line.catalog_items?.brand ? `${name} (${line.catalog_items.brand})` : name;
}

function EditableLineFields({
  itemName,
  setItemName,
  brand,
  setBrand,
  categorySlug,
  setCategorySlug,
  qtyDisplay,
  setQtyDisplay,
  unitDisplay,
  setUnitDisplay,
  categories,
}: {
  itemName: string;
  setItemName: (v: string) => void;
  brand: string;
  setBrand: (v: string) => void;
  categorySlug: string;
  setCategorySlug: (v: string) => void;
  qtyDisplay: string;
  setQtyDisplay: (v: string) => void;
  unitDisplay: string;
  setUnitDisplay: (v: string) => void;
  categories: LeafCategory[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Item name" label="Item name" size="sm" />
      <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand (optional)" label="Brand (optional)" size="sm" />
      <Select
        value={categorySlug}
        onChange={(e) => setCategorySlug(e.target.value)}
        options={[{ value: 'uncategorized', label: 'Uncategorized' }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]}
        label="Category"
      />
      <div className="flex gap-2">
        <Input value={qtyDisplay} onChange={(e) => setQtyDisplay(e.target.value)} placeholder="Qty" label="Qty" size="sm" />
        <Input value={unitDisplay} onChange={(e) => setUnitDisplay(e.target.value)} placeholder="Unit" label="Unit" size="sm" />
      </div>
    </div>
  );
}

function NeedsReviewRow({ receiptId, line, categories }: { receiptId: string; line: ReceiptLineForReview; categories: LeafCategory[] }) {
  const [itemName, setItemName] = useState(line.item_name ?? '');
  const [brand, setBrand] = useState(line.brand ?? '');
  const [categorySlug, setCategorySlug] = useState(line.category_slug ?? 'uncategorized');
  const [qtyDisplay, setQtyDisplay] = useState(line.qty_display ?? '');
  const [unitDisplay, setUnitDisplay] = useState(line.unit_display ?? '');
  const [packSize, setPackSize] = useState(line.pack_size ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      setError(result.ok ? null : (result.error ?? 'Failed'));
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-warning bg-warning-subtle p-3">
      <span className="text-xs text-muted-foreground">Raw text: &ldquo;{line.raw_text}&rdquo;</span>
      <EditableLineFields
        itemName={itemName}
        setItemName={setItemName}
        brand={brand}
        setBrand={setBrand}
        categorySlug={categorySlug}
        setCategorySlug={setCategorySlug}
        qtyDisplay={qtyDisplay}
        setQtyDisplay={setQtyDisplay}
        unitDisplay={unitDisplay}
        setUnitDisplay={setUnitDisplay}
        categories={categories}
      />
      <Input value={packSize} onChange={(e) => setPackSize(e.target.value)} aria-label="Pack size (optional)" placeholder="Pack size (optional)" size="sm" />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => saveAndMatchLineAction(receiptId, line.id, { itemName, brand: brand || null, categorySlug, qtyDisplay: qtyDisplay || null, unitDisplay: unitDisplay || null }))}
        >
          Save &amp; match
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(() =>
              confirmAsNewItemAction(receiptId, line.id, {
                itemName,
                brand: brand || null,
                categorySlug,
                qtyDisplay: qtyDisplay || null,
                unitDisplay: unitDisplay || null,
                packSize: packSize || null,
              }),
            )
          }
        >
          Confirm as new item
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => markLineNonInventoryAction(receiptId, line.id))}>
          Mark non-inventory
        </Button>
      </div>
    </div>
  );
}

function NewItemRow({ receiptId, line, categories }: { receiptId: string; line: ReceiptLineForReview; categories: LeafCategory[] }) {
  const [itemName, setItemName] = useState(line.item_name ?? '');
  const [brand, setBrand] = useState(line.brand ?? '');
  const [categorySlug, setCategorySlug] = useState(line.category_slug ?? 'uncategorized');
  const [qtyDisplay, setQtyDisplay] = useState(line.qty_display ?? '');
  const [unitDisplay, setUnitDisplay] = useState(line.unit_display ?? '');
  const [packSize, setPackSize] = useState(line.pack_size ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      setError(result.ok ? null : (result.error ?? 'Failed'));
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-border-strong p-3">
      <strong className="text-sm">New item — {line.raw_text}</strong>
      <EditableLineFields
        itemName={itemName}
        setItemName={setItemName}
        brand={brand}
        setBrand={setBrand}
        categorySlug={categorySlug}
        setCategorySlug={setCategorySlug}
        qtyDisplay={qtyDisplay}
        setQtyDisplay={setQtyDisplay}
        unitDisplay={unitDisplay}
        setUnitDisplay={setUnitDisplay}
        categories={categories}
      />
      <Input value={packSize} onChange={(e) => setPackSize(e.target.value)} aria-label="Pack size (optional)" placeholder="Pack size (optional)" size="sm" />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() =>
              confirmAsNewItemAction(receiptId, line.id, {
                itemName,
                brand: brand || null,
                categorySlug,
                qtyDisplay: qtyDisplay || null,
                unitDisplay: unitDisplay || null,
                packSize: packSize || null,
              }),
            )
          }
        >
          Confirm as new item
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => saveAndMatchLineAction(receiptId, line.id, { itemName, brand: brand || null, categorySlug, qtyDisplay: qtyDisplay || null, unitDisplay: unitDisplay || null }))}
        >
          Actually, match existing
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => markLineNonInventoryAction(receiptId, line.id))}>
          Mark non-inventory
        </Button>
      </div>
    </div>
  );
}

// S-27: a pure UI navigation aid built from the `session` search param --
// never trusted for anything but "what to render/link to next" (commit
// validation still happens entirely server-side against the DB row).
// advisor-caught bug: `allIds` must be the FULL session list, forwarded
// unchanged on every navigation -- see the comment in page.tsx's
// parseSession for why a sliced "remaining ids" subset breaks the counter.
export type ReviewSession = { position: number; total: number; nextId: string | null; allIds: string[] };

function SessionCounter({ session, nextHref }: { session: ReviewSession; nextHref: string | null }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Badge tone="neutral">
        Reviewing {session.position} of {session.total}
      </Badge>
      {nextHref && (
        <Link href={nextHref} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Skip to next
        </Link>
      )}
    </p>
  );
}

export function ReviewDetail({
  receipt,
  lines,
  categories,
  stockEpoch,
  docUrls,
  previewText,
  session,
}: {
  receipt: ReceiptForReview;
  lines: ReceiptLineForReview[];
  categories: LeafCategory[];
  stockEpoch: string;
  docUrls: string[];
  previewText: string | null;
  session: ReviewSession | null;
}) {
  const router = useRouter();
  const [dateInput, setDateInput] = useState(toDateInputValue(receipt.purchased_at));
  const [pastOrderOverride, setPastOrderOverride] = useState(false);
  const [pending, startTransition] = useTransition();
  const [dateError, setDateError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  // S-27: where "Next" goes after a successful commit -- the current
  // receipt's own id is already consumed, so only the ids after it remain.
  const nextHref = session?.nextId ? `/review/${session.nextId}?session=${session.allIds.join(',')}` : null;

  const excludedCount = useMemo(() => lines.filter((l) => l.review_state === 'excluded').length, [lines]);
  const matchedLines = useMemo(() => lines.filter((l) => l.review_state === 'matched'), [lines]);
  const needsReviewLines = useMemo(() => lines.filter((l) => l.review_state === 'needs_review'), [lines]);
  const newItemLines = useMemo(() => lines.filter((l) => l.review_state === 'new_item'), [lines]);

  // Raw instant comparison, deliberately NOT a calendar-day comparison --
  // this must agree with what actually determines v_current_stock inclusion
  // (ADR-0001: `occurred_at >= stock_epoch`, a plain instant filter, and
  // commit_receipt() writes the purchase movement at exactly this
  // purchased_at instant). It's correct now that purchased_at itself is
  // constructed as Kolkata midnight (lib/date.ts's kolkataDateStringToInstant)
  // instead of UTC midnight -- that instant-construction bug, not the
  // comparison, was what advisor review caught. A calendar-day comparison
  // here would disagree with the ledger's own filter on days stock_epoch
  // was set partway through (banner hidden, but the movement still silently
  // excluded) -- tried that first, verification caught it, reverted.
  const isPastOrder = receipt.purchased_at_confirmed && receipt.purchased_at !== null && new Date(receipt.purchased_at) < new Date(stockEpoch);
  const canCommit = receipt.purchased_at_confirmed && receipt.purchased_at !== null && needsReviewLines.length === 0;

  function confirmDate() {
    startTransition(async () => {
      const result = await confirmPurchaseDateAction(receipt.id, dateInput);
      setDateError(result.ok ? null : (result.error ?? 'Failed'));
    });
  }

  function doCommit() {
    startTransition(async () => {
      const result = await commitReceiptAction(receipt.id, pastOrderOverride);
      setCommitError(result.ok ? null : (result.error ?? 'Failed'));
      // S-27: auto-advance through a multi-file review session after a
      // successful commit; a session-less visit (the pre-E-10 entry point)
      // stays on this page exactly as before.
      if (result.ok && session) {
        router.push(session.nextId ? `/review/${session.nextId}?session=${session.allIds.join(',')}` : '/review');
      }
    });
  }

  if (receipt.status === 'committed') {
    return (
      <div className="mx-auto w-full max-w-[440px] p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Committed</CardTitle>
            <CardDescription>This receipt is already in inventory.</CardDescription>
          </CardHeader>
          {/* S-27: a mid-session receipt that's already committed (e.g. a
             stale back-button visit) must not strand the user on a dead-end
             card -- the counter and forward navigation render here too. */}
          {session && (
            <CardContent>
              <SessionCounter session={session} nextHref={null} />
              {nextHref ? (
                <Link href={nextHref} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'self-start')}>
                  Next ({session.position + 1} of {session.total})
                </Link>
              ) : (
                <Link href="/review" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'self-start')}>
                  Back to review queue
                </Link>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  return (
    <>
    <div className="flex w-full flex-col gap-3 p-4 pb-24 md:flex-row md:gap-6 md:p-6 md:pb-6">
      <Card className="md:w-[320px] md:shrink-0">
        <CardHeader>
          <CardTitle>Document</CardTitle>
          <CardDescription>{receipt.merchant ?? 'Unknown merchant'}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* S-28: raw pasted text has nothing to sign a URL for -- rendered
             directly from the fetched content instead. */}
          {previewText !== null ? (
            <pre className="rounded-md border border-border bg-surface-sunken p-3 text-sm whitespace-pre-wrap">{previewText}</pre>
          ) : docUrls.length > 0 ? (
            receipt.mime === 'application/pdf' ? (
              <embed src={docUrls[0]} type="application/pdf" className="h-[70vh] w-full rounded-md border border-border" />
            ) : receipt.mime?.startsWith('image/') ? (
              // S-25: a grouped receipt has 2-3 storage_paths -- every page
              // renders, stacked, in upload order (a plain receipt has
              // exactly one, unchanged from before this story).
              <div className="flex flex-col gap-2">
                {docUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`Receipt page ${i + 1}`} className="w-full rounded-md border border-border object-contain" />
                ))}
              </div>
            ) : (
              <a href={docUrls[0]} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'tertiary', size: 'sm' }), 'self-start')}>
                Open original document
              </a>
            )
          ) : (
            <p className="text-sm text-muted-foreground">No preview available.</p>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 md:flex-1">
        <CardHeader>
          <CardTitle>Review lines</CardTitle>
          <CardDescription>
            {lines.length} line(s), {excludedCount} excluded.
          </CardDescription>
          {session && <SessionCounter session={session} nextHref={nextHref} />}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {receipt.near_duplicate_of && (
            <Alert tone="warning">Possible duplicate of another receipt (merchant/date/total match) — check before committing.</Alert>
          )}

          <div className="flex flex-col gap-2 rounded-md border-2 border-border-strong p-3">
            <Label htmlFor="purchased-at">Purchase date (required)</Label>
            <div className="flex items-end gap-2">
              <Input id="purchased-at" type="date" size="sm" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
              <Button variant="outline" size="sm" onClick={confirmDate} disabled={pending}>
                {receipt.purchased_at_confirmed ? 'Update date' : 'Confirm date'}
              </Button>
            </div>
            {!receipt.purchased_at_confirmed && <Alert tone="warning">Unconfirmed — commit is blocked until this is confirmed.</Alert>}
            {dateError && <Alert tone="error">{dateError}</Alert>}
          </div>

          {isPastOrder && (
            <Alert
              tone="info"
              title="Past order"
              action={
                <Checkbox
                  id="past-order-override"
                  checked={pastOrderOverride}
                  onChange={(checked) => setPastOrderOverride(checked)}
                  label="Still have this on hand today"
                />
              }
            >
              Updates history, not current stock.
            </Alert>
          )}

          {matchedLines.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold">Matched ({matchedLines.length}) — ready to commit</p>
              {matchedLines.map((line) => (
                <ListRow
                  key={line.id}
                  title={lineLabel(line)}
                  subtitle={`${line.qty_base !== null && line.catalog_items ? formatBaseQty(line.qty_base, line.catalog_items.base_unit as BaseUnit, null) : '—'} · ${line.unit_price !== null ? formatMoney(line.unit_price) : '—'}`}
                  trailing={<Badge tone="success">Matched</Badge>}
                />
              ))}
            </div>
          )}

          {needsReviewLines.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Needs review ({needsReviewLines.length}) — resolve before committing</p>
              {needsReviewLines.map((line) => (
                <NeedsReviewRow key={`${line.id}-${line.review_state}-${line.match_confidence}`} receiptId={receipt.id} line={line} categories={categories} />
              ))}
            </div>
          )}

          {newItemLines.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">New items ({newItemLines.length})</p>
              {newItemLines.map((line) => (
                <NewItemRow key={`${line.id}-${line.review_state}`} receiptId={receipt.id} line={line} categories={categories} />
              ))}
            </div>
          )}

          {excludedCount > 0 && <p className="text-sm text-muted-foreground">{excludedCount} non-inventory row(s) excluded.</p>}

          <div className="hidden flex-col gap-1 md:flex">
            <Button className="w-full" disabled={!canCommit || pending} onClick={doCommit}>
              {pending ? 'Committing…' : 'Commit to inventory'}
            </Button>
            {!canCommit && !pending && (
              <p className="text-xs text-foreground-subtle">
                {needsReviewLines.length > 0 ? 'Disabled until every "needs review" line above is resolved.' : 'Disabled until the purchase date is confirmed.'}
              </p>
            )}
          </div>
          {commitError && <Alert tone="error" className="hidden md:block">{commitError}</Alert>}
        </CardContent>
      </Card>
    </div>
    <div className="fixed inset-x-0 bottom-16 z-10 flex flex-col gap-1 border-t border-border bg-surface p-3 md:hidden">
      <Button className="w-full" disabled={!canCommit || pending} onClick={doCommit}>
        {pending ? 'Committing…' : 'Commit to inventory'}
      </Button>
      {!canCommit && !pending && (
        <p className="text-xs text-foreground-subtle">
          {needsReviewLines.length > 0 ? 'Disabled until every "needs review" line above is resolved.' : 'Disabled until the purchase date is confirmed.'}
        </p>
      )}
      {commitError && <Alert tone="error">{commitError}</Alert>}
    </div>
    </>
  );
}
