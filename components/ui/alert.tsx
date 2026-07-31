import * as React from "react"

import { cn } from "@/lib/utils"

export type AlertTone = "info" | "warning" | "success" | "error"

const TONE_CLASSES: Record<AlertTone, string> = {
  info: "bg-info-subtle text-info-foreground border-[var(--blue-300)]",
  warning: "bg-warning-subtle text-warning-foreground border-[var(--gold-300)]",
  success: "bg-success-subtle text-success-foreground border-[var(--success-300)]",
  error: "bg-error-subtle text-error-foreground border-[var(--red-300)]",
}

export interface AlertProps {
  tone?: AlertTone
  title?: string
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

function Alert({ tone = "info", title, children, action, className }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex flex-col gap-1.5 rounded-md border px-3.5 py-3", TONE_CLASSES[tone], className)}
    >
      {title ? <strong className="text-[13px] font-semibold">{title}</strong> : null}
      <span className="text-[13px] leading-snug">{children}</span>
      {action ? <div className="mt-0.5">{action}</div> : null}
    </div>
  )
}

export { Alert }
