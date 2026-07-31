import React from "react";

export function Textarea({ label, error, helperText, rows = 4, disabled = false, style, ...rest }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {label && <label style={{ font: "600 13px/1.3 var(--font-sans)", color: "var(--color-foreground)" }}>{label}</label>}
      <textarea
        rows={rows}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", padding: "10px 12px", font: "400 15px/1.5 var(--font-sans)", resize: "vertical",
          background: disabled ? "var(--color-surface-sunken)" : "var(--color-surface)",
          color: "var(--color-foreground)",
          border: `1px solid ${error ? "var(--color-error)" : focused ? "var(--color-primary)" : "var(--color-border)"}`,
          borderRadius: "var(--radius-md)", outline: "none",
          boxShadow: focused ? "var(--ring-focus)" : "none",
          transition: "border-color var(--duration-fast) var(--ease-standard)",
          ...style,
        }}
        {...rest}
      />
      {error ? <span style={{ font: "400 12px/1.3 var(--font-sans)", color: "var(--color-error)" }}>{error}</span>
        : helperText ? <span style={{ font: "400 12px/1.3 var(--font-sans)", color: "var(--color-foreground-muted)" }}>{helperText}</span> : null}
    </div>
  );
}
