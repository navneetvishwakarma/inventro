import React from "react";

export function Input({ label, error, helperText, size = "md", disabled = false, style, ...rest }) {
  const [focused, setFocused] = React.useState(false);
  const height = size === "sm" ? 36 : 44;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {label && <label style={{ font: "600 13px/1.3 var(--font-sans)", color: "var(--color-foreground)" }}>{label}</label>}
      <input
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height, width: "100%", padding: "0 12px", font: "400 15px/1.4 var(--font-sans)",
          background: disabled ? "var(--color-surface-sunken)" : "var(--color-surface)",
          color: "var(--color-foreground)",
          border: `1px solid ${error ? "var(--color-error)" : focused ? "var(--color-primary)" : "var(--color-border)"}`,
          borderRadius: "var(--radius-md)", outline: "none",
          boxShadow: focused ? (error ? "0 0 0 3px color-mix(in oklch, var(--color-error) 25%, transparent)" : "var(--ring-focus)") : "none",
          transition: "border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
          cursor: disabled ? "not-allowed" : "text", opacity: disabled ? 0.6 : 1,
          ...style,
        }}
        {...rest}
      />
      {error ? (
        <span style={{ font: "400 12px/1.3 var(--font-sans)", color: "var(--color-error)" }}>{error}</span>
      ) : helperText ? (
        <span style={{ font: "400 12px/1.3 var(--font-sans)", color: "var(--color-foreground-muted)" }}>{helperText}</span>
      ) : null}
    </div>
  );
}
