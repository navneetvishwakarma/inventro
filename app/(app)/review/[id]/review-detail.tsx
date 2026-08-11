'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2Icon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { MobileTopBar } from '@/components/ui/mobile-top-bar';
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
import { confirmPurchaseDateAction, saveAndMatchLineAction, confirmAsNewItemAction, markLineNonInventoryAction, commitReceiptAction, retryExtractionAction } from './actions';

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
        // 'uncategorized' is itself a real seeded leaf category (working
        // spec: the deliberate escape hatch for an unresolved line) --
        // filtered out of the fetched list since it's already the
        // hardcoded first option below; keeping both produced two
        // options with the same value/key.
        options={[{ value: 'uncategorized', label: 'Uncategorized' }, ...categories.filter((c) => c.slug !== 'uncategorized').map((c) => ({ value: c.slug, label: c.name }))]}
        label="Category"
      />
      <div className="flex gap-2">
        <Input value={qtyDisplay} onChange={(e) => setQtyDisplay(e.target.value)} placeholder="Qty" label="Qty" size="sm" />
        <Input value={unitDisplay} onChange={(e) => setUnitDisplay(e.target.value)} placeholder="Unit" label="Unit" size="sm" />
      </div>
    </div>
  );
}

function NeedsReviewRow({ receiptId, line, categories, reportDirty }: { receiptId: string; line: ReceiptLineForReview; categories: LeafCategory[]; reportDirty: (lineId: string, dirty: boolean) => void }) {
  const [itemName, setItemName] = useState(line.item_name ?? '');
  const [brand, setBrand] = useState(line.brand ?? '');
  const [categorySlug, setCategorySlug] = useState(line.category_slug ?? 'uncategorized');
  const [qtyDisplay, setQtyDisplay] = useState(line.qty_display ?? '');
  const [unitDisplay, setUnitDisplay] = useState(line.unit_display ?? '');
  const [packSize, setPackSize] = useState(line.pack_size ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // S-90: reported on every field change, and cleared on unmount -- a
  // successful save changes `line.review_state`, which changes this row's
  // React `key` (see the .map() call sites below) and unmounts the old
  // instance, so the cleanup here also covers "saved successfully" without
  // needing to special-case the `run()` result.
  useEffect(() => {
    const dirty =
      itemName !== (line.item_name ?? '') ||
      brand !== (line.brand ?? '') ||
      categorySlug !== (line.category_slug ?? 'uncategorized') ||
      qtyDisplay !== (line.qty_display ?? '') ||
      unitDisplay !== (line.unit_display ?? '') ||
      packSize !== (line.pack_size ?? '');
    reportDirty(line.id, dirty);
    return () => reportDirty(line.id, false);
  }, [itemName, brand, categorySlug, qtyDisplay, unitDisplay, packSize, line, reportDirty]);

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

// S-68: a matched line (>=0.62 trigram confidence) used to render as an
// inert ListRow -- only needs_review lines were clickable. A confidently
// -wrong auto-match then committed silently, with the only correction path
// afterward being the much heavier Catalog merge flow. Reuses
// NeedsReviewRow's exact reassignment form once expanded, rather than
// building a second edit UI -- the interaction (Save & match / Confirm as
// new item / Mark non-inventory) is identical, only the entry point
// (collapsed ListRow vs. always-open) differs.
function MatchedLineRow({ receiptId, line, categories, reportDirty }: { receiptId: string; line: ReceiptLineForReview; categories: LeafCategory[]; reportDirty: (lineId: string, dirty: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="block w-full cursor-pointer text-left">
        <ListRow
          title={lineLabel(line)}
          subtitle={`${line.qty_base !== null && line.catalog_items ? formatBaseQty(line.qty_base, line.catalog_items.base_unit as BaseUnit, null) : '—'} · ${line.unit_price !== null ? formatMoney(line.unit_price) : '—'}`}
          trailing={<Badge tone="success">Matched</Badge>}
        />
      </button>
    );
  }

  return <NeedsReviewRow receiptId={receiptId} line={line} categories={categories} reportDirty={reportDirty} />;
}

function NewItemRow({ receiptId, line, categories, reportDirty }: { receiptId: string; line: ReceiptLineForReview; categories: LeafCategory[]; reportDirty: (lineId: string, dirty: boolean) => void }) {
  const [itemName, setItemName] = useState(line.item_name ?? '');
  const [brand, setBrand] = useState(line.brand ?? '');
  const [categorySlug, setCategorySlug] = useState(line.category_slug ?? 'uncategorized');
  const [qtyDisplay, setQtyDisplay] = useState(line.qty_display ?? '');
  const [unitDisplay, setUnitDisplay] = useState(line.unit_display ?? '');
  const [packSize, setPackSize] = useState(line.pack_size ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // S-90: see NeedsReviewRow's identical effect for why unmount-on-save
  // (via the key-forced remount in the .map() below) is sufficient cleanup.
  useEffect(() => {
    const dirty =
      itemName !== (line.item_name ?? '') ||
      brand !== (line.brand ?? '') ||
      categorySlug !== (line.category_slug ?? 'uncategorized') ||
      qtyDisplay !== (line.qty_display ?? '') ||
      unitDisplay !== (line.unit_display ?? '') ||
      packSize !== (line.pack_size ?? '');
    reportDirty(line.id, dirty);
    return () => reportDirty(line.id, false);
  }, [itemName, brand, categorySlug, qtyDisplay, unitDisplay, packSize, line, reportDirty]);

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

function SessionCounter({
  session,
  nextHref,
  onNavigateAttempt,
}: {
  session: ReviewSession;
  nextHref: string | null;
  // S-90: same guard the top-level component wires into MobileTopBar's back
  // link -- undefined on the read-only status cards (ProcessingCard/
  // FailedCard), which never render editable rows so nothing can be dirty.
  onNavigateAttempt?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Badge tone="neutral">
        Reviewing {session.position} of {session.total}
      </Badge>
      {nextHref && (
        <Link href={nextHref} onClick={onNavigateAttempt} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Skip to next
        </Link>
      )}
    </p>
  );
}

// S-67: a receipt still being parsed (ingest_jobs.state 'queued' or
// 'processing') has no review_state-tagged lines yet -- rendering the full
// editable form would show an empty, seemingly-broken review UI instead of
// an accurate "still working on it".
function ProcessingCard({ session }: { session: ReviewSession | null }) {
  return (
    <div className="mx-auto w-full max-w-[440px] p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Still parsing</CardTitle>
          <CardDescription>This receipt hasn&apos;t finished extraction yet -- check back in a moment.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
          {session && <SessionCounter session={session} nextHref={null} />}
          <Link href="/review" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'self-start')}>
            Back to review queue
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

// S-67: ingest_jobs.state='failed' -- extraction exhausted its escalation
// ladder (lib/llm/extract.ts) with no usable lines. Retry re-runs the exact
// same extraction path a fresh upload uses; manual entry is the existing
// standalone fallback (REQ-24) for a receipt extraction can't handle at all.
function FailedCard({ receiptId, ingestError, session }: { receiptId: string; ingestError: string | null; session: ReviewSession | null }) {
  const [pending, startTransition] = useTransition();
  const [retried, setRetried] = useState(false);

  function retry() {
    startTransition(async () => {
      await retryExtractionAction(receiptId);
      setRetried(true);
    });
  }

  return (
    <div className="mx-auto w-full max-w-[440px] p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Extraction failed</CardTitle>
          <CardDescription>{ingestError ?? 'This receipt could not be parsed automatically.'}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {retried ? (
            <Alert tone="info">Retrying -- check back in a moment.</Alert>
          ) : (
            <Alert tone="error">Retry, or enter this receipt&apos;s items manually.</Alert>
          )}
          {session && <SessionCounter session={session} nextHref={null} />}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending || retried} onClick={retry}>
              {pending ? 'Retrying…' : 'Retry extraction'}
            </Button>
            <Link href="/add/manual" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Enter manually
            </Link>
            <Link href="/review" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Back to review queue
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
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

  // S-90: a ref, not state -- this is read only at navigation-click time, so
  // there's no reason to re-render the whole page on every keystroke in a
  // row's fields. Rows register/unregister themselves by line id via
  // `reportDirty`; the set's size is the only thing the guard cares about.
  const dirtyLineIdsRef = useRef<Set<string>>(new Set());
  const reportDirty = useCallback((lineId: string, dirty: boolean) => {
    if (dirty) dirtyLineIdsRef.current.add(lineId);
    else dirtyLineIdsRef.current.delete(lineId);
  }, []);

  // S-90: window.confirm, deliberately not ConfirmPanel (S-69's shared
  // inline-confirm card). ConfirmPanel exists for destructive ledger-writing
  // actions (consume, wipe, merge) where the app deliberately avoids the
  // browser-native dialog's opaque styling for something the user is
  // committing to. This isn't that -- it's a "leave without saving?" nav
  // guard, the exact scenario window.confirm is the expected, native pattern
  // for, and nothing is written to the ledger either way. Rendering
  // ConfirmPanel here would also require blocking Link's default navigation
  // unconditionally and reproducing it after an inline confirm click --
  // strictly more code for a less familiar interaction on a lower-stakes
  // action than the cases S-69 was solving for.
  const confirmDiscardIfDirty = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (dirtyLineIdsRef.current.size === 0) return;
    const leave = window.confirm('You have unsaved edits on this receipt. Leave without saving them?');
    if (!leave) {
      e.preventDefault();
    } else {
      dirtyLineIdsRef.current.clear();
    }
  }, []);

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
  const hasCommittableLines = matchedLines.length + newItemLines.length > 0;
  const canCommit = receipt.purchased_at_confirmed && receipt.purchased_at !== null && needsReviewLines.length === 0 && hasCommittableLines;
  const disabledReason = needsReviewLines.length > 0
    ? 'Disabled until every "needs review" line above is resolved.'
    : !hasCommittableLines
      ? 'Disabled -- this receipt has no items to commit.'
      : 'Disabled until the purchase date is confirmed.';

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

  // S-67: ingestState is null only for a receipt whose ingest_jobs row
  // predates this story (defensive, not an expected steady-state) -- treated
  // as "still processing" rather than silently falling through to the full
  // edit UI on a receipt with no lines yet.
  // S-90: MobileTopBar used to be rendered by page.tsx as a sibling of this
  // component -- moved inside so its back link can share this component's
  // dirty-tracking ref via `confirmDiscardIfDirty`. A Server Component
  // (page.tsx) can't hold that ref or pass a closure into a Client
  // Component's onClick, so the two had to live in the same client tree.
  // Harmless on the Processing/Failed/Committed branches below: nothing
  // dirty can exist there (no editable rows render), so the guard is a
  // no-op and behaves exactly as the plain Link did before this story.
  if (receipt.status !== 'committed' && receipt.status !== 'parsed') {
    return (
      <>
        <MobileTopBar title="Review receipt" backHref="/review" onBackClick={confirmDiscardIfDirty} />
        {receipt.ingestState === 'failed' ? (
          <FailedCard receiptId={receipt.id} ingestError={receipt.ingestError} session={session} />
        ) : (
          <ProcessingCard session={session} />
        )}
      </>
    );
  }

  if (receipt.status === 'committed') {
    return (
      <>
        <MobileTopBar title="Review receipt" backHref="/review" onBackClick={confirmDiscardIfDirty} />
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
      </>
    );
  }

  return (
    <>
    <MobileTopBar title="Review receipt" backHref="/review" onBackClick={confirmDiscardIfDirty} />
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
          {session && <SessionCounter session={session} nextHref={nextHref} onNavigateAttempt={confirmDiscardIfDirty} />}
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
              <p className="text-sm font-semibold">Matched ({matchedLines.length}) — ready to commit, tap to correct</p>
              {matchedLines.map((line) => (
                <MatchedLineRow key={`${line.id}-${line.review_state}-${line.match_confidence}`} receiptId={receipt.id} line={line} categories={categories} reportDirty={reportDirty} />
              ))}
            </div>
          )}

          {needsReviewLines.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Needs review ({needsReviewLines.length}) — resolve before committing</p>
              {needsReviewLines.map((line) => (
                <NeedsReviewRow key={`${line.id}-${line.review_state}-${line.match_confidence}`} receiptId={receipt.id} line={line} categories={categories} reportDirty={reportDirty} />
              ))}
            </div>
          )}

          {newItemLines.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">New items ({newItemLines.length})</p>
              {newItemLines.map((line) => (
                <NewItemRow key={`${line.id}-${line.review_state}`} receiptId={receipt.id} line={line} categories={categories} reportDirty={reportDirty} />
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
                {disabledReason}
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
          {disabledReason}
        </p>
      )}
      {commitError && <Alert tone="error">{commitError}</Alert>}
    </div>
    </>
  );
}
