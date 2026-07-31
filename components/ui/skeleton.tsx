import * as React from "react"

import { cn } from "@/lib/utils"

export interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: string
  className?: string
}

function Skeleton({ width = "100%", height = 16, radius = "var(--radius-sm)", className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-shimmer bg-[length:200%_100%]", className)}
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundImage:
          "linear-gradient(90deg, var(--surface-sunken) 25%, var(--border) 50%, var(--surface-sunken) 75%)",
      }}
    />
  )
}

export { Skeleton }
