'use server';

import { after } from 'next/server';
import { uploadReceiptFile } from '@/lib/receipts/storage';
import { extensionOf, isAcceptedExtension } from '@/lib/receipts/formats';
import { createIngestJob } from '@/lib/receipts/ingest';
import { runExtraction } from '@/lib/llm/extract';

export type UploadResult = { fileName: string; ok: true; receiptId: string } | { fileName: string; ok: false; error: string };

// Receives already client-preprocessed files (HEIC->JPEG, downscaled — see
// app/add/capture.tsx) as one Server Action call for the whole batch, so N
// selected files become N receipts rows in one round trip. Re-validates the
// extension server-side rather than trusting the client (defense-in-depth,
// not because the client UI can't already be trusted for its own use, but
// because a Server Action is a public endpoint regardless of which UI calls it).
//
// Extraction (S-06) runs via after() so the upload response returns
// immediately (working spec Journey 2: "upload should return instantly")
// while the LLM call continues in this same function invocation's extended
// lifetime — no separate queue/worker service (tech-stack.md).
export async function uploadReceiptsAction(formData: FormData): Promise<UploadResult[]> {
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  const results: UploadResult[] = [];

  for (const file of files) {
    const ext = extensionOf(file.name);
    if (!isAcceptedExtension(ext)) {
      results.push({ fileName: file.name, ok: false, error: 'Unsupported file type' });
      continue;
    }

    try {
      const bytes = await file.arrayBuffer();
      const { id } = await uploadReceiptFile(bytes, ext);
      await createIngestJob(id);
      after(() => runExtraction(id));
      results.push({ fileName: file.name, ok: true, receiptId: id });
    } catch {
      results.push({ fileName: file.name, ok: false, error: 'Upload failed' });
    }
  }

  return results;
}
