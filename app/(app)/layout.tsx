import { Sidebar, type NavItem } from "@/components/ui/sidebar";
import { TabBar, type TabBarItem } from "@/components/ui/tab-bar";
import { getHousehold } from "@/lib/onboarding/data";
import { getReviewQueue } from "@/lib/review/data";

// Mirrors app/(app)/page.tsx's force-dynamic rationale -- household name
// and the review-queue badge count must reflect the current request, not a
// build-time snapshot.
export const dynamic = "force-dynamic";

const SIDEBAR_ITEMS: NavItem[] = [
  { key: "today", label: "Today", href: "/" },
  { key: "add", label: "Add", href: "/add" },
  { key: "review", label: "Review", href: "/review" },
  { key: "inventory", label: "Inventory", href: "/inventory" },
  { key: "plan", label: "Plan", href: "/plan" },
  { key: "shopping-list", label: "Shopping list", href: "/shopping-list" },
  { key: "insights", label: "Insights", href: "/insights" },
  { key: "catalog", label: "Catalog", href: "/catalog" },
  { key: "settings", label: "Settings", href: "/settings" },
];

const TABBAR_ITEMS: TabBarItem[] = [
  { key: "today", label: "Today", href: "/" },
  { key: "inventory", label: "Inventory", href: "/inventory" },
  { key: "add", label: "Add", href: "/add" },
  { key: "plan", label: "Plan", href: "/plan" },
  { key: "insights", label: "Insights", href: "/insights" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [household, reviewQueue] = await Promise.all([getHousehold(), getReviewQueue()]);

  const sidebarItems = SIDEBAR_ITEMS.map((item) =>
    item.key === "review" && reviewQueue.length > 0 ? { ...item, count: reviewQueue.length } : item
  );

  return (
    <div className="flex min-h-full flex-1">
      <div className="hidden lg:block">
        <Sidebar items={sidebarItems} householdName={household.name} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 pb-16 lg:pb-0">{children}</main>
        <div className="fixed inset-x-0 bottom-0 lg:hidden">
          <TabBar items={TABBAR_ITEMS} />
        </div>
      </div>
    </div>
  );
}
