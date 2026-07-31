"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export interface NavItem {
  key: string
  label: string
  href: string
  count?: number
}

export interface SidebarProps {
  items: NavItem[]
  householdName?: string
  className?: string
}

function Sidebar({ items, householdName = "Household", className }: SidebarProps) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "flex h-full w-[220px] shrink-0 flex-col gap-1 border-r border-border bg-surface px-3 py-5",
        className
      )}
    >
      <div className="px-2.5 pb-4 text-base font-bold text-foreground">{householdName}</div>
      {items.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-[38px] items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground no-underline transition-colors hover:bg-surface-sunken",
              isActive && "bg-primary-subtle font-semibold text-primary-subtle-foreground hover:bg-primary-subtle"
            )}
          >
            {item.label}
            {item.count ? (
              <span className="ml-auto font-mono text-[11px] font-semibold text-foreground-subtle">{item.count}</span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

export { Sidebar }
