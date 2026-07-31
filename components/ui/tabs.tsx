import * as React from "react"

import { cn } from "@/lib/utils"

export interface TabItem {
  value: string
  label: string
  count?: number
}

export interface TabsProps {
  items: TabItem[]
  active: string
  onChange?: (value: string) => void
  className?: string
}

// A flat filter/segmented control, not a full ARIA tabs widget -- the
// design system's Tabs has no aria-controls/tabpanel wiring, so `role="tab"`
// without a linked panel would be an invalid ARIA pattern. Uses a
// `role="group"` of toggle buttons instead.
function Tabs({ items, active, onChange, className }: TabsProps) {
  return (
    <div role="group" className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((item) => {
        const isActive = item.value === active;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange?.(item.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] text-muted-foreground transition-colors",
              isActive
                ? "border-primary bg-primary-subtle font-semibold text-primary-subtle-foreground"
                : "border-border bg-surface"
            )}
          >
            {item.label}
            {item.count !== undefined ? <span className="font-mono text-[11px] font-semibold">({item.count})</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export { Tabs }
