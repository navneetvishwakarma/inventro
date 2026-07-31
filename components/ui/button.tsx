import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold transition-colors outline-none select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-[var(--gold-700)]",
        tertiary: "bg-transparent text-tertiary hover:bg-tertiary-subtle active:bg-tertiary-subtle",
        outline: "border border-border-strong bg-surface text-foreground hover:bg-surface-sunken",
        ghost: "bg-transparent text-foreground hover:bg-surface-sunken",
        destructive:
          "bg-error-subtle text-error hover:bg-[color-mix(in_oklch,var(--color-error-subtle),var(--color-error)_20%)] active:bg-[color-mix(in_oklch,var(--color-error-subtle),var(--color-error)_35%)]",
      },
      size: {
        sm: "h-8 gap-1.5 rounded-md px-3 text-[13px]",
        md: "h-10 gap-2 rounded-md px-4 text-sm",
        lg: "h-12 gap-2 rounded-lg px-5 text-[15px]",
        icon: "size-11 rounded-md",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

type ButtonProps = Omit<ButtonPrimitive.Props, "children"> &
  VariantProps<typeof buttonVariants> & {
    icon?: React.ReactNode
    iconPosition?: "start" | "end"
    loading?: boolean
    children?: React.ReactNode
  }

function Button({
  className,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "start",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <Loader2Icon className="animate-spin" aria-hidden="true" />
      ) : (
        <>
          {icon && iconPosition === "start" ? icon : null}
          {size === "icon" ? (!icon ? children : null) : children}
          {icon && iconPosition === "end" ? icon : null}
        </>
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
