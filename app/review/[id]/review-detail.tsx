'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { ReceiptForReview, ReceiptLineForReview, LeafCategory } from '@/lib/review/data';
import { toKolkataDateString } from '@/lib/date';
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
      <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Item name" />
      <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand (optional)" />
      <select className="rounded border px-2 py-1" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)}>
        <option value="uncategorized">Uncategorized</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <Input value={qtyDisplay} onChange={(e) => setQtyDisplay(e.target.value)} placeholder="Qty" />
        <Input value={unitDisplay} onChange={(e) => setUnitDisplay(e.target.value)} placeholder="Unit" />
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
    <div className="flex flex-col gap-2 rounded border p-3">
      <p className="text-sm text-muted-foreground">{line.raw_text}</p>
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
      <Input value={packSize} onChange={(e) => setPackSize(e.target.value)} placeholder="Pack size (optional)" />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => saveAndMatchLineAction(receiptId, line.id, { itemName, brand: brand || null, categorySlug, qtyDisplay: qtyDisplay || null, unitDisplay: unitDisplay || null }))}
        >
          Save & match
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
    <div className="flex flex-col gap-2 rounded border border-dashed p-3">
      <p className="text-sm font-medium">New item — {line.raw_text}</p>
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
      <Input value={packSize} onChange={(e) => setPackSize(e.target.value)} placeholder="Pack size (optional)" />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
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
    <p className="text-sm text-muted-foreground">
      Reviewing {session.position} of {session.total}
      {nextHref && (
        <>
          {' — '}
          <Link href={nextHref} className="underline">
            Skip to next
          </Link>
        </>
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
      <main style={{ maxWidth: 480, margin: '10vh auto', padding: '0 1rem' }}>
        <Card>
          <CardHeader>
            <CardTitle>Committed</CardTitle>
            <CardDescription>This receipt is already in inventory.</CardDescription>
          </CardHeader>
          {/* S-27: a mid-session receipt that's already committed (e.g. a
             stale back-button visit) must not strand the user on a dead-end
             card -- the counter and forward navigation render here too. */}
          {session && (
            <CardContent className="flex flex-col gap-2">
              <SessionCounter session={session} nextHref={null} />
              {nextHref ? (
                <Link href={nextHref} className="underline">
                  Next ({session.position + 1} of {session.total})
                </Link>
              ) : (
                <Link href="/review" className="underline">
                  Back to review queue
                </Link>
              )}
            </CardContent>
          )}
        </Card>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 960, margin: '4vh auto', padding: '0 1rem' }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Document</CardTitle>
          <CardDescription>{receipt.merchant ?? 'Unknown merchant'}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* S-28: raw pasted text has nothing to sign a URL for -- rendered
             directly from the fetched content instead. */}
          {previewText !== null ? (
            <pre className="whitespace-pre-wrap text-sm">{previewText}</pre>
          ) : docUrls.length > 0 ? (
            receipt.mime === 'application/pdf' ? (
              <embed src={docUrls[0]} type="application/pdf" style={{ width: '100%', height: '70vh' }} />
            ) : receipt.mime?.startsWith('image/') ? (
              // S-25: a grouped receipt has 2-3 storage_paths -- every page
              // renders, stacked, in upload order (a plain receipt has
              // exactly one, unchanged from before this story).
              <div className="flex flex-col gap-2">
                {docUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`Receipt page ${i + 1}`} style={{ width: '100%', objectFit: 'contain' }} />
                ))}
              </div>
            ) : (
              <a href={docUrls[0]} target="_blank" rel="noreferrer" className="underline">
                Open original document
              </a>
            )
          ) : (
            <p>No preview available.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review lines</CardTitle>
          <CardDescription>{lines.length} line(s), {excludedCount} excluded.</CardDescription>
          {session && <SessionCounter session={session} nextHref={nextHref} />}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {receipt.near_duplicate_of && (
            <p className="rounded bg-yellow-100 p-2 text-sm text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200">
              Possible duplicate of another receipt (merchant/date/total match) — check before committing.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="purchased-at">Purchase date (required)</Label>
            <div className="flex gap-2">
              <Input id="purchased-at" type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
              <Button onClick={confirmDate} disabled={pending}>
                {receipt.purchased_at_confirmed ? 'Update date' : 'Confirm date'}
              </Button>
            </div>
            {!receipt.purchased_at_confirmed && <p className="text-sm text-amber-700 dark:text-amber-400">Unconfirmed — commit is blocked until this is confirmed.</p>}
            {dateError && <p className="text-sm text-destructive">{dateError}</p>}
          </div>

          {isPastOrder && (
            <div className="rounded bg-blue-50 p-3 dark:bg-blue-950/40">
              <p className="text-sm text-blue-950 dark:text-blue-100">Past order — updates history, not current stock.</p>
              <div className="mt-2 flex items-center gap-2">
                <Checkbox id="past-order-override" checked={pastOrderOverride} onCheckedChange={(checked) => setPastOrderOverride(checked === true)} />
                <Label htmlFor="past-order-override">Still have this on hand today</Label>
              </div>
            </div>
          )}

          {matchedLines.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Matched ({matchedLines.length}) — ready to commit</p>
              {matchedLines.map((line) => (
                <div key={line.id} className="flex justify-between rounded border p-2 text-sm">
                  <span>{lineLabel(line)}</span>
                  <span>
                    {line.qty_base ?? '—'} · ₹{line.unit_price ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {needsReviewLines.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Needs review ({needsReviewLines.length}) — resolve before committing</p>
              {needsReviewLines.map((line) => (
                <NeedsReviewRow key={`${line.id}-${line.review_state}-${line.match_confidence}`} receiptId={receipt.id} line={line} categories={categories} />
              ))}
            </div>
          )}

          {newItemLines.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">New items ({newItemLines.length})</p>
              {newItemLines.map((line) => (
                <NewItemRow key={`${line.id}-${line.review_state}`} receiptId={receipt.id} line={line} categories={categories} />
              ))}
            </div>
          )}

          {excludedCount > 0 && <p className="text-sm text-muted-foreground">{excludedCount} non-inventory row(s) excluded.</p>}

          <Button className="w-full" disabled={!canCommit || pending} onClick={doCommit}>
            {pending ? 'Committing…' : 'Commit to inventory'}
          </Button>
          {commitError && <p className="text-sm text-destructive">{commitError}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
