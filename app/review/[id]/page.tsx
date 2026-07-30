import { notFound, redirect } from 'next/navigation';
import { getHousehold } from '@/lib/onboarding/data';
import { getReceiptForReview, getReceiptLines, getLeafCategories, getStockEpoch, getDocumentPreviewUrl } from '@/lib/review/data';
import { ReviewDetail } from './review-detail';

export const dynamic = 'force-dynamic';

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const household = await getHousehold();
  if (!household.onboarded_at) redirect('/onboarding');

  const receipt = await getReceiptForReview(id);
  if (!receipt) notFound();

  const [lines, categories, stockEpoch, docUrl] = await Promise.all([
    getReceiptLines(id),
    getLeafCategories(),
    getStockEpoch(),
    receipt.storage_paths[0] ? getDocumentPreviewUrl(receipt.storage_paths[0]) : Promise.resolve(null),
  ]);

  return <ReviewDetail receipt={receipt} lines={lines} categories={categories} stockEpoch={stockEpoch} docUrl={docUrl} />;
}
