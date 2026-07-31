import React from "react";

export function Radio({ checked = false, onChange, label, name, disabled = false, id }) {
  return (
    <label htmlFor={id} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, font: "400 14px/1.3 var(--font-sans)", color: "var(--color-foreground)" }}>
      <span style={{ position: "relative", width: 18, height: 18, flexShrink: 0 }}>
        <input id={id} type="radio" name={name} checked={checked} disabled={disabled} onChange={() => onChange && onChange()} style={{ position: "absolute", inset: 0, opacity: 0, margin: 0, cursor: disabled ? "not-allowed" : "pointer" }} />
        <span style={{
          position: "absolute", inset: 0, borderRadius: "var(--radius-full)",
          border: `1.5px solid ${checked ? "var(--color-primary)" : "var(--color-border-strong)"}`,
          background: "var(--color-surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "border-color var(--duration-fast) var(--ease-standard)",
        }}>
          {checked && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--color-primary)" }} />}
        </span>
      </span>
      {label}
    </label>
  );
}
