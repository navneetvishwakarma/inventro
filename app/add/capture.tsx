'use client';

import { useEffect, useRef, useState, useTransition, type DragEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
      const formData = new FormData();
      for (const file of files) {
        const processed = await preprocessFile(file);
        formData.append('files', processed, processed.name);
      }
      const uploadResults = isGrouped ? await uploadGroupedReceiptAction(formData) : await uploadReceiptsAction(formData);
      setResults(uploadResults);
      setStatus('idle');
    });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }

  return (
    <main style={{ maxWidth: 480, margin: '10vh auto', padding: '0 1rem' }}>
      <Card>
        <CardHeader>
          <CardTitle>Add a receipt</CardTitle>
          <CardDescription>Photo, file, or drag it in — PDF, JPG, PNG, WEBP, HEIC, HTML/MHTML.</CardDescription>
        </CardHeader>
        <CardContent
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className="flex flex-col gap-4"
          style={{
            border: isDragging ? '2px dashed #666' : '2px dashed transparent',
            borderRadius: 8,
            padding: '1rem',
          }}
        >
          <div className="flex items-center gap-2">
            <Checkbox id="group-toggle" checked={isGrouped} onCheckedChange={(checked) => setIsGrouped(checked === true)} disabled={status === 'processing'} />
            <Label htmlFor="group-toggle">These are screenshots of one order (2-3 images)</Label>
          </div>
          {groupError && <p className="text-sm text-red-600">{groupError}</p>}

          <div className="flex gap-2">
            <Button onClick={() => cameraInputRef.current?.click()} disabled={status === 'processing'}>
              Take Photo
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={status === 'processing'}>
              Choose Files
            </Button>
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

          {status === 'processing' && <p>Got it — processing…</p>}

          {results.length > 0 && (
            <ul className="flex flex-col gap-1">
              {results.map((r, i) => (
                <li key={i}>
                  {r.fileName}: {r.ok ? 'uploaded' : `failed — ${r.error}`}
                </li>
              ))}
            </ul>
          )}

          {/* S-27: multiple successful uploads in one batch get a sequential
             review link carrying every id as the `session` param, so the
             review flow can show a running "X of Y" counter. */}
          {(() => {
            const okIds = results.filter((r): r is UploadResult & { ok: true } => r.ok).map((r) => r.receiptId);
            if (okIds.length === 0) return null;
            const href = okIds.length > 1 ? `/review/${okIds[0]}?session=${okIds.join(',')}` : `/review/${okIds[0]}`;
            return (
              <Link href={href} className="text-sm underline">
                {okIds.length > 1 ? `Review ${okIds.length} receipts` : 'Review receipt'}
              </Link>
            );
          })()}

          <AddPasteText onSubmit={handleFiles} disabled={status === 'processing'} />

          {/* S-29: no receipt to photograph -- search the catalog and log a
             purchase directly. */}
          <Link href="/add/manual" className="text-sm underline">
            Add manually
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
