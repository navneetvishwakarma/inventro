import * as React from "react"

import { cn } from "@/lib/utils"

export type BadgeTone = "neutral" | "brand" | "gold" | "success" | "warning" | "error" | "info"

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-muted-foreground",
  brand: "bg-primary-subtle text-primary-subtle-foreground",
  gold: "bg-secondary-subtle text-secondary-subtle-foreground",
  success: "bg-success-subtle text-success-foreground",
  warning: "bg-warning-subtle text-warning-foreground",
  error: "bg-error-subtle text-error-foreground",
  info: "bg-info-subtle text-info-foreground",
}

export interface BadgeProps {
  children?: React.ReactNode
  tone?: BadgeTone
  className?: string
}

function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-semibold whitespace-nowrap tracking-[0.01em]",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export { Badge }
