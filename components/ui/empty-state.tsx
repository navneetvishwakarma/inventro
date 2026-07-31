import * as React from "react"

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-muted-foreground">
      {icon ? (
        <span className="flex size-10 items-center justify-center text-foreground-subtle" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <strong className="text-[15px] font-semibold text-foreground">{title}</strong>
      {description ? <span className="max-w-80 text-sm">{description}</span> : null}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
