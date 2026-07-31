import React from "react";

export function Select({ label, error, helperText, options = [], placeholder, disabled = false, style, ...rest }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {label && <label style={{ font: "600 13px/1.3 var(--font-sans)", color: "var(--color-foreground)" }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <select
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          defaultValue=""
          style={{
            height: 44, width: "100%", padding: "0 36px 0 12px", font: "400 15px/1.4 var(--font-sans)", appearance: "none",
            background: disabled ? "var(--color-surface-sunken)" : "var(--color-surface)",
            color: "var(--color-foreground)",
            border: `1px solid ${error ? "var(--color-error)" : focused ? "var(--color-primary)" : "var(--color-border)"}`,
            borderRadius: "var(--radius-md)", outline: "none",
            boxShadow: focused ? "var(--ring-focus)" : "none",
            cursor: disabled ? "not-allowed" : "pointer",
            ...style,
          }}
          {...rest}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--color-foreground-muted)", fontSize: 10 }}>▾</span>
      </div>
      {error ? <span style={{ font: "400 12px/1.3 var(--font-sans)", color: "var(--color-error)" }}>{error}</span>
        : helperText ? <span style={{ font: "400 12px/1.3 var(--font-sans)", color: "var(--color-foreground-muted)" }}>{helperText}</span> : null}
    </div>
  );
}
