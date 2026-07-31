import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

export interface ListRowProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  meta?: React.ReactNode[]
  trailing?: React.ReactNode
  href?: string
  onClick?: () => void
  className?: string
}

function ListRow({ title, subtitle, meta = [], trailing, href, onClick, className }: ListRowProps) {
  const classes = cn(
    "flex flex-col gap-1 rounded-md border border-border px-3 py-3 text-inherit no-underline transition-colors",
    (href || onClick) && "cursor-pointer hover:bg-surface-sunken",
    className
  )
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {trailing}
      </div>
      {subtitle ? <span className="text-[0.875rem] text-muted-foreground">{subtitle}</span> : null}
      {meta.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {meta.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
      ) : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classes}>
        {content}
      </Link>
    )
  }
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={classes}
    >
      {content}
    </div>
  )
}

export { ListRow }
