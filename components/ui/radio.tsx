import * as React from "react"

import { cn } from "@/lib/utils"

export interface RadioProps {
  checked?: boolean
  onChange?: () => void
  label?: React.ReactNode
  name?: string
  disabled?: boolean
  id?: string
  className?: string
}

function Radio({ checked, onChange, label, name, disabled, id, className }: RadioProps) {
  const generatedId = React.useId()
  const radioId = id ?? generatedId
  return (
    <label
      htmlFor={radioId}
      className={cn(
        "inline-flex items-center gap-2 text-sm text-foreground",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className
      )}
    >
      <span className="relative flex size-[18px] shrink-0 items-center justify-center">
        <input
          id={radioId}
          type="radio"
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="absolute inset-0 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full border transition-colors",
            checked ? "border-primary" : "border-border-strong"
          )}
        />
        {checked ? <span className="pointer-events-none absolute size-[9px] rounded-full bg-primary" /> : null}
      </span>
      {label}
    </label>
  )
}

export { Radio }
