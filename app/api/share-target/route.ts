import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { uploadReceiptFile } from '@/lib/receipts/storage';
import { extensionOf, isAcceptedExtension } from '@/lib/receipts/formats';
import { createIngestJob } from '@/lib/receipts/ingest';
import { runExtraction } from '@/lib/llm/extract';
import { hashFileBytes, findDuplicateReceipt } from '@/lib/receipts/dedup';
import { getTodayReceiptCount, allowedCountInBatch } from '@/lib/receipts/guard';

// S-35/REQ-27: Android Web Share Target handler. Reached when a user shares
// a photo/PDF from another app (Photos, Gmail, a browser) to the installed
// PWA -- registered in public/manifest.webmanifest's share_target. This is
// a real top-level browser POST navigation, not a React Server Action call,
// so it can't reuse uploadReceiptsAction directly; it calls the same
// underlying lib functions that action calls instead. Files arrive exactly
// as the OS share sheet handed them off -- no client-side HEIC->JPEG
// conversion or downscaling runs on this path (that preprocessing lives in
// app/add/capture.tsx, a browser-only step with no equivalent here; shared
// images from Android's native apps are JPEG/PNG in practice, not HEIC).
//
// Stays behind the existing passcode gate (proxy.ts) like every other data
// route -- an unauthenticated share attempt gets the same bare 401 as any
// other unauthenticated request, with no redirect back to /gate (that would
// require the gate to special-case this route, which A26's "returns 401"
// acceptance criterion doesn't allow for any other route either). Documented
// residual risk: a share attempt before ever completing /gate once has no
// graceful recovery path -- consistent with how this app treats every other
// unauthenticated request, not a gap unique to this route.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.redirect(new URL('/add', request.url), 303);
  }

  const countBeforeBatch = await getTodayReceiptCount();
  let acceptedInBatch = 0;
  const acceptedIds: string[] = [];

  for (const file of files) {
    const ext = extensionOf(file.name);
    if (!isAcceptedExtension(ext)) continue;

    // Same guard as uploadReceiptsAction: checked before any hashing/
    // Storage/dedup work, so a blocked file costs nothing.
    if (allowedCountInBatch(countBeforeBatch + acceptedInBatch, 1) === 0) continue;

    try {
      const bytes = await file.arrayBuffer();
      const contentHash = hashFileBytes(bytes);

      const duplicateId = await findDuplicateReceipt(contentHash);
      if (duplicateId) continue;

      const { id } = await uploadReceiptFile(bytes, ext, contentHash);
      await createIngestJob(id);
      after(() => runExtraction(id));
      acceptedInBatch++;
      acceptedIds.push(id);
    } catch {
      // A single failed file in a shared batch shouldn't block the rest --
      // matches uploadReceiptsAction's per-file try/catch.
      continue;
    }
  }

  // Web Share Target requires the response to be a real page navigation
  // (this is a top-level browser POST, not a fetch a client script reads),
  // so land the user on /review the same way a successful manual upload's
  // "Review receipt(s)" link would -- no way to report per-file failures
  // back to the user here beyond that; a fully-failed share falls back to
  // /add so they're not stranded on a blank redirect target.
  if (acceptedIds.length === 0) {
    return NextResponse.redirect(new URL('/add', request.url), 303);
  }
  if (acceptedIds.length === 1) {
    return NextResponse.redirect(new URL(`/review/${acceptedIds[0]}`, request.url), 303);
  }
  return NextResponse.redirect(new URL(`/review/${acceptedIds[0]}?session=${acceptedIds.join(',')}`, request.url), 303);
}
