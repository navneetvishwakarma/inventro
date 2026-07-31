import React from "react";

export function Tabs({ items, active, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((it) => {
        const isActive = it.value === active;
        return (
          <button key={it.value} onClick={() => onChange && onChange(it.value)} style={{
            display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
            borderRadius: "var(--radius-full)", border: `1px solid ${isActive ? "var(--color-primary)" : "var(--color-border)"}`,
            background: isActive ? "var(--color-primary-subtle)" : "var(--color-surface)",
            color: isActive ? "var(--color-primary-subtle-foreground)" : "var(--color-foreground-muted)",
            font: isActive ? "600 13px/1 var(--font-sans)" : "400 13px/1 var(--font-sans)", cursor: "pointer",
          }}>
            {it.label}{it.count !== undefined ? <span style={{ font: "600 11px/1 var(--font-mono)" }}>({it.count})</span> : null}
          </button>
        );
      })}
    </div>
  );
}
