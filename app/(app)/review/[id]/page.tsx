import { notFound, redirect } from 'next/navigation';
import { MobileTopBar } from '@/components/ui/mobile-top-bar';
import { getHousehold } from '@/lib/onboarding/data';
import { getReceiptForReview, getReceiptLines, getLeafCategories, getStockEpoch, getDocumentPreviewUrl, getDocumentPreviewText } from '@/lib/review/data';
import { ReviewDetail, type ReviewSession } from './review-detail';

export const dynamic = 'force-dynamic';

// S-27: `session` is a comma-separated id list from a multi-file upload
// batch (app/add/capture.tsx) -- purely a UI navigation aid, never trusted
// for anything but "what to render/link to next". Absent or malformed ->
// null, and the page renders exactly as it did before this story.
//
// advisor-caught bug: the FULL id list must always be forwarded to the next
// page's `session` param, never a sliced "remaining" subset -- slicing made
// each hop recompute position/total against a shrinking list, so "1 of 3"
// became "1 of 2" then "1 of 1" instead of "1 of 3" -> "2 of 3" -> "3 of 3".
// `allIds` is forwarded unchanged on every link/redirect; `indexOf` here is
// what derives this page's own position each time.
function parseSession(sessionParam: string | undefined, currentId: string): ReviewSession | null {
  if (!sessionParam) return null;
  const ids = sessionParam.split(',').filter(Boolean);
  const index = ids.indexOf(currentId);
  if (index === -1) return null;
  return {
    position: index + 1,
    total: ids.length,
    nextId: ids[index + 1] ?? null,
    allIds: ids,
  };
}

export default async function ReviewDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ session?: string }> }) {
  const { id } = await params;
  const { session: sessionParam } = await searchParams;

  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  const receipt = await getReceiptForReview(id);
  if (!receipt) notFound();

  const isTextReceipt = receipt.mime === 'text/plain';

  const [lines, categories, stockEpoch, docUrls, previewText] = await Promise.all([
    getReceiptLines(id),
    getLeafCategories(),
    getStockEpoch(),
    // S-25: every storage_paths entry gets a signed URL (a grouped receipt
    // has 2-3; a plain receipt has exactly one, unchanged from before).
    // A missing/deleted storage object must not take down the whole page --
    // the review-lines panel (the actual work) has nothing to do with the
    // document preview, so a preview failure degrades to the existing "No
    // preview available." state (review-detail.tsx:374) instead of an
    // unhandled rejection stalling the entire request.
    isTextReceipt
      ? Promise.resolve([])
      : Promise.all(receipt.storage_paths.map((p) => getDocumentPreviewUrl(p).catch(() => null))).then((urls) =>
          urls.filter((u): u is string => u !== null),
        ),
    isTextReceipt && receipt.storage_paths[0] ? getDocumentPreviewText(receipt.storage_paths[0]).catch(() => null) : Promise.resolve(null),
  ]);

  const session = parseSession(sessionParam, id);

  return (
    <>
      <MobileTopBar title="Review receipt" backHref="/review" />
      <ReviewDetail receipt={receipt} lines={lines} categories={categories} stockEpoch={stockEpoch} docUrls={docUrls} previewText={previewText} session={session} />
    </>
  );
}
