import React from "react";

const SIZES = {
  sm: { height: 32, padding: "0 12px", font: "600 13px/1 var(--font-sans)", gap: 6, radius: "var(--radius-md)" },
  md: { height: 40, padding: "0 16px", font: "600 14px/1 var(--font-sans)", gap: 8, radius: "var(--radius-md)" },
  lg: { height: 48, padding: "0 20px", font: "600 15px/1 var(--font-sans)", gap: 8, radius: "var(--radius-lg)" },
  icon: { height: 40, width: 40, padding: 0, font: "600 14px/1 var(--font-sans)", gap: 0, radius: "var(--radius-md)" },
};

function paletteFor(variant) {
  switch (variant) {
    case "primary":
      return { bg: "var(--color-primary)", bgHover: "var(--color-primary-hover)", bgActive: "var(--color-primary-active)", fg: "var(--color-primary-foreground)", border: "transparent" };
    case "secondary":
      return { bg: "var(--color-secondary)", bgHover: "var(--color-secondary-hover)", bgActive: "var(--gold-700)", fg: "var(--color-secondary-foreground)", border: "transparent" };
    case "tertiary":
      return { bg: "transparent", bgHover: "var(--color-tertiary-subtle)", bgActive: "var(--color-tertiary-subtle)", fg: "var(--color-tertiary)", border: "transparent" };
    case "outline":
      return { bg: "var(--color-surface)", bgHover: "var(--color-surface-sunken)", bgActive: "var(--color-surface-sunken)", fg: "var(--color-foreground)", border: "var(--color-border-strong)" };
    case "ghost":
      return { bg: "transparent", bgHover: "var(--color-surface-sunken)", bgActive: "var(--color-surface-sunken)", fg: "var(--color-foreground)", border: "transparent" };
    case "destructive":
      return { bg: "var(--color-error-subtle)", bgHover: "color-mix(in oklch, var(--color-error-subtle), var(--color-error) 20%)", bgActive: "color-mix(in oklch, var(--color-error-subtle), var(--color-error) 35%)", fg: "var(--color-error-foreground)", border: "transparent" };
    default:
      return { bg: "var(--color-primary)", bgHover: "var(--color-primary-hover)", bgActive: "var(--color-primary-active)", fg: "var(--color-primary-foreground)", border: "transparent" };
  }
}

export function Button({ variant = "primary", size = "md", icon = null, iconPosition = "start", loading = false, disabled = false, children, onClick, type = "button", style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const s = SIZES[size] || SIZES.md;
  const p = paletteFor(variant);
  const isDisabled = disabled || loading;
  const bg = isDisabled ? p.bg : active ? p.bgActive : hover ? p.bgHover : p.bg;
  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: s.gap,
        height: s.height, width: s.width, padding: s.padding, font: s.font, borderRadius: s.radius,
        background: bg, color: p.fg, border: `1px solid ${p.border}`,
        cursor: isDisabled ? "not-allowed" : "pointer", opacity: isDisabled && !loading ? 0.5 : 1,
        transition: `background var(--duration-fast) var(--ease-standard), transform var(--duration-instant) var(--ease-standard)`,
        transform: active && !isDisabled ? "translateY(1px)" : "none",
        outline: "none", boxShadow: "none", whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <span style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid currentColor`, borderTopColor: "transparent", animation: "inv-spin 0.6s linear infinite" }} />
      ) : (
        <>
          {icon && iconPosition === "start" && <span style={{ display: "inline-flex", width: 16, height: 16 }}>{icon}</span>}
          {size !== "icon" && children}
          {icon && iconPosition === "end" && <span style={{ display: "inline-flex", width: 16, height: 16 }}>{icon}</span>}
          {size === "icon" && !icon && children}
        </>
      )}
      <style>{`@keyframes inv-spin{to{transform:rotate(360deg)}}`}</style>
    </button>
  );
}
