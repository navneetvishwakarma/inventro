import React from "react";

export function Switch({ checked = false, onChange, label, disabled = false, id }) {
  return (
    <label htmlFor={id} style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, font: "400 14px/1.3 var(--font-sans)", color: "var(--color-foreground)" }}>
      <span style={{ position: "relative", width: 40, height: 24, flexShrink: 0 }}>
        <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange && onChange(e.target.checked)} style={{ position: "absolute", inset: 0, opacity: 0, margin: 0, cursor: disabled ? "not-allowed" : "pointer" }} />
        <span style={{
          position: "absolute", inset: 0, borderRadius: "var(--radius-full)",
          background: checked ? "var(--color-primary)" : "var(--color-border-strong)",
          transition: "background var(--duration-fast) var(--ease-standard)",
        }}>
          <span style={{
            position: "absolute", top: 3, left: checked ? 19 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff",
            boxShadow: "var(--shadow-sm)", transition: "left var(--duration-fast) var(--ease-standard)",
          }} />
        </span>
      </span>
      {label}
    </label>
  );
}
