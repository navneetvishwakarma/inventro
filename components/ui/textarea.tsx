import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  label?: string
  error?: string
  helperText?: string
}

function Textarea({
  className,
  label,
  error,
  helperText,
  id,
  rows = 4,
  disabled,
  ...props
}: TextareaProps) {
  const generatedId = React.useId()
  const textareaId = id ?? generatedId
  const descriptionId = error || helperText ? `${textareaId}-description` : undefined
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={textareaId} className="text-[13px] font-semibold text-foreground">
          {label}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        rows={rows}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={descriptionId}
        className={cn(
          "w-full resize-y rounded-md border bg-surface px-3 py-2.5 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60",
          error ? "border-error focus-visible:border-error" : "border-border focus-visible:border-primary"
        )}
        {...props}
      />
      {error ? (
        <span id={descriptionId} className="text-xs text-error">{error}</span>
      ) : helperText ? (
        <span id={descriptionId} className="text-xs text-muted-foreground">{helperText}</span>
      ) : null}
    </div>
  )
}

export { Textarea }
