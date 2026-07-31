"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

export interface SwitchProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  label?: React.ReactNode
  disabled?: boolean
  id?: string
  className?: string
}

function Switch({ checked, onChange, label, disabled, id, className }: SwitchProps) {
  const generatedId = React.useId()
  const switchId = id ?? generatedId
  const control = (
    <SwitchPrimitive.Root
      id={switchId}
      data-slot="switch"
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-border-strong outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary",
        className
      )}
    >
      <SwitchPrimitive.Thumb className="block size-[18px] translate-x-[3px] rounded-full bg-white shadow-sm transition-transform data-checked:translate-x-[19px]" />
    </SwitchPrimitive.Root>
  )
  if (!label) return control
  return (
    <label
      htmlFor={switchId}
      className={cn("inline-flex items-center gap-2.5 text-sm text-foreground", disabled && "cursor-not-allowed opacity-50")}
    >
      {control}
      {label}
    </label>
  )
}

export { Switch }
