"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  ChartNoAxesColumn,
  House,
  type LucideIcon,
  Package,
  Plus,
} from "lucide-react"

import { cn } from "@/lib/utils"

export interface TabBarItem {
  key: string
  label: string
  href: string
}

export interface TabBarProps {
  items: TabBarItem[]
  className?: string
}

const TAB_ICONS: Record<string, LucideIcon> = {
  today: House,
  inventory: Package,
  add: Plus,
  plan: CalendarDays,
  insights: ChartNoAxesColumn,
}

function TabBar({ items, className }: TabBarProps) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "flex h-16 border-t border-border bg-surface pb-[var(--safe-bottom)]",
        className
      )}
    >
      {items.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
        const isCenter = item.key === "add"
        const Icon = TAB_ICONS[item.key] ?? House
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground no-underline",
              isActive && "text-primary"
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center",
                isCenter ? "size-[34px] rounded-full bg-primary text-primary-foreground" : "size-[22px]"
              )}
            >
              <Icon className="size-[18px]" strokeWidth={isActive || isCenter ? 2.25 : 2} aria-hidden="true" />
            </span>
            <span className={cn("text-[10.5px]", isActive && "font-semibold")}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export { TabBar }
