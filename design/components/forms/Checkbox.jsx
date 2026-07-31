import React from "react";

export function Checkbox({ checked = false, onChange, label, disabled = false, id }) {
  return (
    <label htmlFor={id} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, font: "400 14px/1.3 var(--font-sans)", color: "var(--color-foreground)" }}>
      <span style={{ position: "relative", width: 18, height: 18, flexShrink: 0 }}>
        <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange && onChange(e.target.checked)} style={{ position: "absolute", inset: 0, opacity: 0, margin: 0, cursor: disabled ? "not-allowed" : "pointer" }} />
        <span style={{
          position: "absolute", inset: 0, borderRadius: "var(--radius-sm)",
          border: `1.5px solid ${checked ? "var(--color-primary)" : "var(--color-border-strong)"}`,
          background: checked ? "var(--color-primary)" : "var(--color-surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)",
        }}>
          {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2 5 8.7 9.5 3.5" stroke="var(--color-primary-foreground)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
      </span>
      {label}
    </label>
  );
}
