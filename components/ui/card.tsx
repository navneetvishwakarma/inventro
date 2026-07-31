import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  style,
  padding = "var(--space-4)",
  children,
  ...props
}: React.ComponentProps<"div"> & { padding?: string | number }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card text-sm text-card-foreground shadow-sm",
        className
      )}
      style={style}
      {...props}
    >
      <div style={{ padding }}>{children}</div>
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("mb-3 flex flex-col gap-1", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("[font:var(--text-h4)] text-foreground", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("[font:var(--text-body-sm)] text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "mt-3 flex items-center gap-2 border-t border-border pt-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
