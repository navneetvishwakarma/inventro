'use client';

import { useRouter } from 'next/navigation';
import { Tabs, type TabItem } from '@/components/ui/tabs';

export function PlanBucketTabs({ items, active }: { items: TabItem[]; active: string }) {
  const router = useRouter();
  return <Tabs items={items} active={active} onChange={(value) => router.push(`/plan?bucket=${value}`)} />;
}
