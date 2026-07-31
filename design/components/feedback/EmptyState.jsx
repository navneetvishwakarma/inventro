import React from "react";

export function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8, padding: "40px 20px", color: "var(--color-foreground-muted)" }}>
      {icon && <span style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-foreground-subtle)" }}>{icon}</span>}
      <strong style={{ font: "600 15px/1.3 var(--font-sans)", color: "var(--color-foreground)" }}>{title}</strong>
      {description && <span style={{ font: "400 14px/1.5 var(--font-sans)", maxWidth: 320 }}>{description}</span>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
