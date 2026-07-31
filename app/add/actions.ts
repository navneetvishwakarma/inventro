'use server';

import { after } from 'next/server';
import { uploadReceiptFile, uploadGroupedReceiptFiles } from '@/lib/receipts/storage';
import { extensionOf, isAcceptedExtension, isImageExtension, type AcceptedExtension } from '@/lib/receipts/formats';
import { createIngestJob } from '@/lib/receipts/ingest';
import { runExtraction } from '@/lib/llm/extract';
import { hashFileBytes, hashCombinedFileBytes, findDuplicateReceipt } from '@/lib/receipts/dedup';
import { getTodayReceiptCount, allowedCountInBatch, DAILY_INGEST_HARD_STOP } from '@/lib/receipts/guard';

const DAILY_LIMIT_ERROR = `Daily ingestion limit (${DAILY_INGEST_HARD_STOP} receipts) reached -- try again tomorrow`;

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

  // S-34/REQ-25: fetched ONCE per batch (not per file) and incremented
  // locally as files are actually accepted below -- a batch straddling the
  // 100 boundary partially succeeds rather than all-or-nothing. Duplicate-
  // rejected files never increment this (they never create a receipts row
  // or cost anything), matching what the count itself measures.
  const countBeforeBatch = await getTodayReceiptCount();
  let acceptedInBatch = 0;

  for (const file of files) {
    const ext = extensionOf(file.name);
    if (!isAcceptedExtension(ext)) {
      results.push({ fileName: file.name, ok: false, error: 'Unsupported file type' });
      continue;
    }

    // Checked before any hashing/Storage/dedup work -- a blocked file costs
    // nothing at all, not even a dedup lookup. Reuses the same boundary
    // function the guard's edge cases are unit-tested against (batchSize=1
    // per file, since acceptance is decided one file at a time here).
    if (allowedCountInBatch(countBeforeBatch + acceptedInBatch, 1) === 0) {
      results.push({ fileName: file.name, ok: false, error: DAILY_LIMIT_ERROR });
      continue;
    }

    try {
      const bytes = await file.arrayBuffer();
      const contentHash = hashFileBytes(bytes);

      const duplicateId = await findDuplicateReceipt(contentHash);
      if (duplicateId) {
        results.push({ fileName: file.name, ok: false, error: 'Already uploaded (duplicate)' });
        continue;
      }

      const { id } = await uploadReceiptFile(bytes, ext, contentHash);
      await createIngestJob(id);
      after(() => runExtraction(id));
      acceptedInBatch++;
      results.push({ fileName: file.name, ok: true, receiptId: id });
    } catch {
      results.push({ fileName: file.name, ok: false, error: 'Upload failed' });
    }
  }

  return results;
}

// S-25: grouped upload for the "these are screenshots of one order" toggle.
// Re-validates the client's grouping choice server-side (never trusts it
// alone, same posture as uploadReceiptsAction's extension re-check): exactly
// 2-3 files, every one an image extension. Produces ONE receipts row / ONE
// ingest job / ONE extraction call, never N -- that's the entire point of
// grouping (A24, no triple-counting).
export async function uploadGroupedReceiptAction(formData: FormData): Promise<UploadResult[]> {
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);

  if (files.length < 2 || files.length > 3) {
    return [{ fileName: files.map((f) => f.name).join(', ') || 'grouped upload', ok: false, error: 'Group must be 2-3 images' }];
  }

  const withExt = files.map((f) => ({ file: f, ext: extensionOf(f.name) }));
  const invalid = withExt.find(({ ext }) => !isAcceptedExtension(ext) || !isImageExtension(ext));
  if (invalid) {
    return [{ fileName: invalid.file.name, ok: false, error: 'Grouped files must all be images' }];
  }

  const groupName = files.map((f) => f.name).join(', ');

  // S-34/REQ-25: a grouped upload is still exactly one receipts row/one
  // extraction call, so a single check against today's count (no local
  // batch increment needed, unlike uploadReceiptsAction's N-file loop).
  const countBeforeUpload = await getTodayReceiptCount();
  if (allowedCountInBatch(countBeforeUpload, 1) === 0) {
    return [{ fileName: groupName, ok: false, error: DAILY_LIMIT_ERROR }];
  }

  try {
    const bytesList = await Promise.all(files.map((f) => f.arrayBuffer()));
    const contentHash = hashCombinedFileBytes(bytesList);

    const duplicateId = await findDuplicateReceipt(contentHash);
    if (duplicateId) {
      return [{ fileName: groupName, ok: false, error: 'Already uploaded (duplicate)' }];
    }

    const filesWithExt = bytesList.map((bytes, i) => ({ bytes, ext: withExt[i].ext as AcceptedExtension }));
    const { id } = await uploadGroupedReceiptFiles(filesWithExt, contentHash);
    await createIngestJob(id);
    after(() => runExtraction(id));
    return [{ fileName: groupName, ok: true, receiptId: id }];
  } catch {
    return [{ fileName: groupName, ok: false, error: 'Upload failed' }];
  }
}
