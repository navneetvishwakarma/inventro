import React from "react";

export function ListRow({ title, subtitle, meta = [], trailing, href, onClick }) {
  const Tag = href ? "a" : "div";
  return (
    <Tag href={href} onClick={onClick} style={{
      display: "flex", flexDirection: "column", gap: 4, padding: 12, borderRadius: "var(--radius-md)",
      border: "1px solid var(--color-border)", textDecoration: "none", color: "inherit", cursor: href || onClick ? "pointer" : "default",
      transition: "background var(--duration-fast) var(--ease-standard)",
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-surface-sunken)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ font: "600 14px/1.3 var(--font-sans)", color: "var(--color-foreground)" }}>{title}</span>
        {trailing}
      </div>
      {subtitle && <span style={{ font: "var(--text-body-sm)", color: "var(--color-foreground-muted)" }}>{subtitle}</span>}
      {meta.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, font: "var(--text-caption)", color: "var(--color-foreground-muted)" }}>
          {meta.map((m, i) => <span key={i}>{m}</span>)}
        </div>
      )}
    </Tag>
  );
}
