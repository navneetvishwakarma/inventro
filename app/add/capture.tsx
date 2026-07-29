'use client';

import { useRef, useState, useTransition, type DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { preprocessFile } from '@/lib/receipts/preprocess';
import { uploadReceiptsAction, type UploadResult } from './actions';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.html,.mhtml';

export function AddCapture() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing'>('idle');
  const [results, setResults] = useState<UploadResult[]>([]);
  const [, startTransition] = useTransition();

  function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setStatus('processing');
    setResults([]);

    startTransition(async () => {
      const formData = new FormData();
      for (const file of files) {
        const processed = await preprocessFile(file);
        formData.append('files', processed, processed.name);
      }
      const uploadResults = await uploadReceiptsAction(formData);
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
        </CardContent>
      </Card>
    </main>
  );
}
