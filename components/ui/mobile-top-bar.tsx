import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"

export interface MobileTopBarProps {
  title: React.ReactNode
  backHref?: string
  // S-90: lets a page intercept the back tap (e.g. an unsaved-edit guard)
  // without owning the Link itself -- optional and unused by every other
  // caller, so this is additive. Standard Link onClick semantics: call
  // preventDefault() inside to cancel the navigation.
  onBackClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  className?: string
}

// Only visible below lg (Sidebar takes over above it, per app/(app)/layout.tsx's
// existing breakpoint split) -- gives mobile users page orientation once the
// desktop-only Sidebar disappears.
function MobileTopBar({ title, backHref, onBackClick, className }: MobileTopBarProps) {
  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-4 lg:hidden",
        className
      )}
    >
      {backHref ? (
        <Link href={backHref} onClick={onBackClick} aria-label="Back" className="-ml-2 flex size-11 shrink-0 items-center justify-center text-foreground-muted no-underline">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
      ) : null}
      <span className="truncate [font:var(--text-h6)] text-foreground">{title}</span>
    </div>
  )
}

export { MobileTopBar }
