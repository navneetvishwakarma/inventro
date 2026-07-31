import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

export interface InputProps extends Omit<React.ComponentProps<typeof InputPrimitive>, "size"> {
  label?: string
  error?: string
  helperText?: string
  size?: "sm" | "md"
}

function Input({
  className,
  type,
  label,
  error,
  helperText,
  size = "md",
  disabled,
  id,
  ...props
}: InputProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={inputId} className="text-[13px] font-semibold text-foreground">
          {label}
        </label>
      ) : null}
      <InputPrimitive
        id={inputId}
        type={type}
        data-slot="input"
        disabled={disabled}
        aria-invalid={!!error}
        className={cn(
          "h-11 w-full min-w-0 rounded-md border bg-surface px-3 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60",
          error ? "border-error focus-visible:border-error" : "border-border focus-visible:border-primary",
          size === "sm" && "h-9"
        )}
        {...props}
      />
      {error ? (
        <span className="text-xs text-error">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-muted-foreground">{helperText}</span>
      ) : null}
    </div>
  )
}

export { Input }
