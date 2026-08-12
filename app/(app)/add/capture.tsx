'use client';

import { useEffect, useRef, useState, useTransition, type DragEvent } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { preprocessFile } from '@/lib/receipts/preprocess';
import { extensionOf, isImageExtension } from '@/lib/receipts/formats';
import { subscribeStagedFile } from '@/lib/receipts/paste-staging';
import { uploadReceiptsAction, uploadGroupedReceiptAction, type UploadResult } from './actions';
import { AddPasteText } from './paste-text';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.html,.mhtml';

export function AddCapture() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing'>('idle');
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isGrouped, setIsGrouped] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // S-26: a paste staged while elsewhere (module singleton delivers it on
  // this mount) or a live paste while already on /add both land here, and
  // flow through the exact same handleFiles() pipeline as file-picker/drop.
  // Re-subscribes whenever `isGrouped` changes (advisor-caught bug: a `[]`
  // dep array here would freeze the callback's closure on isGrouped's value
  // at mount, so pasting with the toggle ON would silently upload ungrouped
  // instead of showing the 2-3-images validation error).
  useEffect(() => {
    return subscribeStagedFile((file) => handleFiles([file]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGrouped]);

  function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setGroupError(null);

    if (isGrouped) {
      if (files.length < 2 || files.length > 3) {
        setGroupError('Select 2-3 images for a grouped order.');
        return;
      }
      if (files.some((f) => !isImageExtension(extensionOf(f.name)))) {
        setGroupError('Grouped files must all be images.');
        return;
      }
    }

    setStatus('processing');
    setResults([]);

    startTransition(async () => {
      try {
        const formData = new FormData();
        const preprocessFailures: UploadResult[] = [];

        for (const file of files) {
          try {
            const processed = await preprocessFile(file);
            formData.append('files', processed, processed.name);
          } catch {
            preprocessFailures.push({ fileName: file.name, ok: false, error: "couldn't process image" });
          }
        }

        const processedFiles = formData.getAll('files').filter((f): f is File => f instanceof File);

        // S-25's group is one indivisible unit -- a partial group (2 of 3
        // selected images) must never silently upload as if the user chose
        // 2. Skip the network call entirely and fail every file in the
        // group, not just the one that didn't preprocess.
        if (isGrouped && preprocessFailures.length > 0) {
          setGroupError("One or more images couldn't be processed -- try the group again.");
          setResults([
            ...processedFiles.map((f): UploadResult => ({ fileName: f.name, ok: false, error: 'Group upload skipped' })),
            ...preprocessFailures,
          ]);
        } else if (processedFiles.length > 0) {
          const uploadResults = isGrouped ? await uploadGroupedReceiptAction(formData) : await uploadReceiptsAction(formData);
          setResults([...uploadResults, ...preprocessFailures]);
        } else {
          setResults(preprocessFailures);
        }
      } finally {
        setStatus('idle');
      }
    });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }

  const okIds = results.filter((r): r is UploadResult & { ok: true } => r.ok).map((r) => r.receiptId);
  const reviewHref = okIds.length > 1 ? `/review/${okIds[0]}?session=${okIds.join(',')}` : `/review/${okIds[0]}`;

  return (
    <div className="mx-auto w-full max-w-[440px] p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a receipt</CardTitle>
          <CardDescription>Photo, file, or drag it in — PDF, JPG, PNG, WEBP, HEIC, HTML/MHTML.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Checkbox
            id="group-toggle"
            checked={isGrouped}
            onChange={(checked) => setIsGrouped(checked)}
            disabled={status === 'processing'}
            label="These are screenshots of one order (2-3 images)"
          />
          {groupError && <Alert tone="error">{groupError}</Alert>}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col gap-2 rounded-lg border-[1.5px] border-dashed p-5 transition-colors',
              isDragging ? 'border-primary bg-primary-subtle' : 'border-border-strong bg-surface-sunken'
            )}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => cameraInputRef.current?.click()} disabled={status === 'processing'}>
                Take photo
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={status === 'processing'}>
                Choose files
              </Button>
            </div>
            <p className="hidden text-xs text-foreground-subtle sm:block">Or drag files anywhere in this zone.</p>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />

          {status === 'processing' && <p className="text-sm text-muted-foreground">Got it — processing…</p>}

          {results.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {results.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span>{r.fileName}</span>
                  <Badge tone={r.ok ? 'success' : 'error'}>{r.ok ? 'Uploaded' : `Failed — ${r.error}`}</Badge>
                </li>
              ))}
            </ul>
          )}

          {/* S-27: multiple successful uploads in one batch get a sequential
             review link carrying every id as the `session` param, so the
             review flow can show a running "X of Y" counter. */}
          {okIds.length > 0 && (
            <Link href={reviewHref} className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'self-start')}>
              {okIds.length > 1 ? `Review ${okIds.length} receipts` : 'Review receipt'}
            </Link>
          )}

          <AddPasteText onSubmit={handleFiles} disabled={status === 'processing'} />

          {/* S-29: no receipt to photograph -- search the catalog and log a
             purchase directly. */}
          <Link href="/add/manual" className={cn(buttonVariants({ variant: 'tertiary', size: 'sm' }), 'self-start')}>
            Add manually
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
