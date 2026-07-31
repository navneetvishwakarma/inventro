"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface CheckboxProps {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  label?: React.ReactNode
  disabled?: boolean
  id?: string
  name?: string
  value?: string
  className?: string
}

function Checkbox({ checked, defaultChecked, onChange, label, disabled, id, name, value, className }: CheckboxProps) {
  const generatedId = React.useId()
  const checkboxId = id ?? generatedId
  const control = (
    <CheckboxPrimitive.Root
      id={checkboxId}
      name={name}
      value={value}
      data-slot="checkbox"
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onCheckedChange={onChange}
      className={cn(
        "peer relative flex size-[18px] shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface outline-none transition-colors focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary data-checked:bg-primary",
        className
      )}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-primary-foreground [&>svg]:size-3"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
  if (!label) return control
  return (
    <label
      htmlFor={checkboxId}
      className={cn("inline-flex items-center gap-2 text-sm text-foreground", disabled && "cursor-not-allowed opacity-50")}
    >
      {control}
      {label}
    </label>
  )
}

export { Checkbox }
