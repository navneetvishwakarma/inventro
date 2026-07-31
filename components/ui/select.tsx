import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<React.ComponentProps<"select">, "value" | "onChange"> {
  label?: string
  error?: string
  helperText?: string
  options: SelectOption[]
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

function Select({
  className,
  label,
  error,
  helperText,
  options,
  placeholder,
  id,
  disabled,
  ...props
}: SelectProps) {
  const generatedId = React.useId()
  const selectId = id ?? generatedId
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={selectId} className="text-[13px] font-semibold text-foreground">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          id={selectId}
          disabled={disabled}
          aria-invalid={!!error}
          className={cn(
            "h-11 w-full min-w-0 appearance-none rounded-md border bg-surface px-3 pr-9 text-[15px] text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60",
            error ? "border-error focus-visible:border-error" : "border-border focus-visible:border-primary"
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      {error ? (
        <span className="text-xs text-error">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-muted-foreground">{helperText}</span>
      ) : null}
    </div>
  )
}

export { Select }
